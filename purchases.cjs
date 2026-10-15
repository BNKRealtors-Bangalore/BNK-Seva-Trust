"use strict";
const crypto = require("node:crypto");

const purchaseSchema = [
  "CREATE TABLE IF NOT EXISTS purchases (",
  "id TEXT PRIMARY KEY, buyer_name TEXT NOT NULL, phone TEXT NOT NULL, email TEXT NOT NULL, address TEXT NOT NULL,",
  "items_json TEXT NOT NULL, total_paise INTEGER NOT NULL CHECK(total_paise > 0), payment_reference TEXT UNIQUE,",
  "status TEXT NOT NULL DEFAULT 'Awaiting Payment' CHECK(status IN ('Awaiting Payment','Pending Verification','Verified','Rejected')),",
  "payment_token_hash TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL",
  ");"
].join("\n");
const builtInNames = {
  box:"Baba Blessings Box", frame:"Neem Karoli Baba Photo Frame", chalisa:"Hanuman Chalisa",
  books:"Spiritual Books", mala:"Tulsi Mala", incense:"Sandalwood Incense",
  idol:"Devotional Idol", merch:"BNK Seva Trust T-Shirt"
};
const hash = value => crypto.createHash("sha256").update(value).digest("hex");
const fail = (message, statusCode = 400) => { const error = new Error(message);error.statusCode=statusCode;throw error; };
function requiredText(input, label, max) {
  if(typeof input !== "string" || !input.trim() || input.trim().length > max) fail("Enter a valid "+label+".");
  return input.trim();
}
function publicOrder(row) {
  return {id:row.id, items:JSON.parse(row.items_json), totalPaise:row.total_paise, status:row.status, createdAt:row.created_at};
}
function createPurchaseService({database, getSiteContent, getPricingConfig, getSessionUser, readJSON, sendJSON}) {
  async function create(input) {
    const name=requiredText(input?.name,"name",120);
    const phone=requiredText(input.phone,"phone number",30);
    const email=requiredText(input.email,"email",254).toLowerCase();
    const address=requiredText(input.address,"delivery address",1000);
    if(!/^\+?[\d\s()-]{7,30}$/.test(phone) || phone.replace(/\D/g,"").length<7) fail("Enter a valid phone number.");
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail("Enter a valid email.");
    if(!Array.isArray(input.items)||!input.items.length||input.items.length>30) fail("Your cart must contain between 1 and 30 products.");
    return database.transaction(async()=>{
      const content=await getSiteContent(), pricing=await getPricingConfig();
      const catalog=new Map(Object.entries(builtInNames).map(([id,name])=>[id,{id,name,price:pricing.storePrices[id],status:"Active"}]));
      for(const product of content.records.store) catalog.set(product.id,product);
      const seen=new Set();
      const items=input.items.map(item=>{
        if(typeof item?.id!=="string"||seen.has(item.id)) fail("Invalid or repeated product in cart.");
        seen.add(item.id);
        const product=catalog.get(item.id), quantity=item.quantity;
        if(!product||product.status!=="Active") fail("A product in your cart is no longer available. Refresh the store.");
        if(!Number.isInteger(quantity)||quantity<1||quantity>99) fail("Each product quantity must be between 1 and 99.");
        const unitPricePaise=Math.round(Number(product.price)*100);
        if(!Number.isSafeInteger(unitPricePaise)||unitPricePaise<1) fail("A product price is unavailable.");
        if(Number(product.stock)>0&&quantity>Number(product.stock)) fail("Requested quantity is unavailable for "+product.name+".");
        return {id:product.id,name:product.name,quantity,unitPricePaise,lineTotalPaise:unitPricePaise*quantity};
      });
      const totalPaise=items.reduce((sum,item)=>sum+item.lineTotalPaise,0);
      if(!Number.isSafeInteger(totalPaise)||totalPaise>1000000000) fail("Cart total is too large.");
      const id="BNKP-"+crypto.randomUUID(),paymentToken=crypto.randomBytes(32).toString("base64url"),now=new Date().toISOString();
      await database.prepare("INSERT INTO purchases (id,buyer_name,phone,email,address,items_json,total_paise,payment_token_hash,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)")
        .run(id,name,phone,email,address,JSON.stringify(items),totalPaise,hash(paymentToken),now,now);
      return {purchase:publicOrder({id,items_json:JSON.stringify(items),total_paise:totalPaise,status:"Awaiting Payment",created_at:now}),paymentToken};
    });
  }
  async function handle(request,response,url) {
    if(url.pathname==="/api/purchases"&&request.method==="POST") {
      sendJSON(response,201,await create(await readJSON(request)));return true;
    }
    const paymentMatch=url.pathname.match(/^\/api\/purchases\/([^/]+)\/payment$/);
    if(paymentMatch&&request.method==="POST") {
      const input=await readJSON(request);
      const token=typeof input?.paymentToken==="string"?input.paymentToken:"";
      const reference=requiredText(input?.reference,"UPI transaction/reference ID",120);
      const purchase=await database.transaction(async()=>{
        const row=await database.prepare("SELECT * FROM purchases WHERE id=?").get(paymentMatch[1]);
        if(!row||hash(token)!==row.payment_token_hash) fail("Purchase not found or invalid payment session.",403);
        if(row.payment_reference) {
          if(row.payment_reference!==reference) fail("A different payment reference is already recorded.",409);
          return publicOrder(row);
        }
        if(await database.prepare("SELECT id FROM purchases WHERE payment_reference=?").get(reference)) fail("This payment reference is already linked to another purchase.",409);
        await database.prepare("UPDATE purchases SET payment_reference=?,status='Pending Verification',updated_at=? WHERE id=?")
          .run(reference,new Date().toISOString(),row.id);
        return publicOrder({...row,status:"Pending Verification"});
      });
      sendJSON(response,200,{purchase});return true;
    }
    if(url.pathname==="/api/admin/purchases"&&request.method==="GET") {
      if(!await getSessionUser(request)) fail("Login required.",401);
      const rows=await database.prepare("SELECT * FROM purchases ORDER BY created_at DESC LIMIT 1000").all();
      sendJSON(response,200,{purchases:rows.map(row=>({...publicOrder(row),name:row.buyer_name,phone:row.phone,email:row.email,address:row.address,reference:row.payment_reference||"",updatedAt:row.updated_at}))});return true;
    }
    const adminMatch=url.pathname.match(/^\/api\/admin\/purchases\/([^/]+)$/);
    if(adminMatch&&request.method==="PATCH") {
      if(!await getSessionUser(request,["Admin","Editor"])) fail("Admin or Editor role required.",403);
      const input=await readJSON(request);
      if(!["Verified","Rejected","Pending Verification"].includes(input?.status)) fail("Choose a valid purchase status.");
      await database.transaction(async()=>{
        const row=await database.prepare("SELECT * FROM purchases WHERE id=?").get(adminMatch[1]);
        if(!row) fail("Purchase not found.",404);
        if(!row.payment_reference) fail("Payment reference is required before verifying a purchase.");
        await database.prepare("UPDATE purchases SET status=?,updated_at=? WHERE id=?").run(input.status,new Date().toISOString(),row.id);
      });
      sendJSON(response,200,{ok:true});return true;
    }
    return false;
  }
  return {handle};
}
module.exports={purchaseSchema,createPurchaseService};
