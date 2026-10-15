"use strict";
const crypto = require("node:crypto");

const purchaseSchema = [
  "CREATE TABLE IF NOT EXISTS purchases (",
  "id TEXT PRIMARY KEY, buyer_name TEXT NOT NULL, phone TEXT NOT NULL, email TEXT NOT NULL, address TEXT NOT NULL,",
  "items_json TEXT NOT NULL, total_paise INTEGER NOT NULL CHECK(total_paise > 0), payment_reference TEXT UNIQUE,",
  "status TEXT NOT NULL DEFAULT 'Awaiting Payment' CHECK(status IN ('Awaiting Payment','Pending Verification','Verified','Rejected')),",
  "payment_token_hash TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL",
  ");",
  "CREATE TABLE IF NOT EXISTS purchase_reservations(purchase_id TEXT NOT NULL,product_id TEXT NOT NULL,quantity INTEGER NOT NULL,expires_at TEXT NOT NULL,PRIMARY KEY(purchase_id,product_id));"
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
  return {id:row.id, items:JSON.parse(row.items_json), totalPaise:row.total_paise, status:row.status==="Awaiting Payment"&&Date.now()-Date.parse(row.created_at)>86400000?"Expired":row.status, createdAt:row.created_at};
}
function createPurchaseService({database, getSiteContent, getPricingConfig, getSessionUser, readJSON, sendJSON,adjustInventory=async()=>{},audit=async()=>{},isReferenceUsed=async()=>false,env=process.env}) {
  const cookieName=id=>"bnk_purchase_"+id.replace(/[^a-zA-Z0-9]/g,"");
  function tokenFor(request,id,input={}) {
    if(typeof input.paymentToken==="string"&&input.paymentToken)return input.paymentToken;
    const value=String(request.headers?.cookie||"").split(";").map(x=>x.trim()).find(x=>x.startsWith(cookieName(id)+"="));
    return value?value.slice(value.indexOf("=")+1):"";
  }
  async function checkStock(product,quantity,excluding="") {
    if(product.stock===undefined||product.stock===null||product.stock==="")return;
    const reserved=await database.prepare("SELECT COALESCE(SUM(quantity),0) AS quantity FROM purchase_reservations WHERE product_id=? AND purchase_id<>? AND expires_at>?").get(product.id,excluding,new Date().toISOString());
    if(!Number.isInteger(Number(product.stock))||Number(product.stock)-Number(reserved.quantity)<quantity)fail("Requested quantity is unavailable for "+product.name+".");
  }
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
      const items=[];
      for(const item of input.items){
        if(typeof item?.id!=="string"||seen.has(item.id)) fail("Invalid or repeated product in cart.");
        seen.add(item.id);
        const product=catalog.get(item.id), quantity=item.quantity;
        if(!product||product.status!=="Active") fail("A product in your cart is no longer available. Refresh the store.");
        if(!Number.isInteger(quantity)||quantity<1||quantity>99) fail("Each product quantity must be between 1 and 99.");
        const unitPricePaise=Math.round(Number(product.price)*100);
        if(!Number.isSafeInteger(unitPricePaise)||unitPricePaise<1) fail("A product price is unavailable.");
        await checkStock(product,quantity);
        items.push({id:product.id,name:product.name,quantity,unitPricePaise,lineTotalPaise:unitPricePaise*quantity});
      }
      const totalPaise=items.reduce((sum,item)=>sum+item.lineTotalPaise,0);
      if(!Number.isSafeInteger(totalPaise)||totalPaise>1000000000) fail("Cart total is too large.");
      const id="BNKP-"+crypto.randomUUID(),paymentToken=crypto.randomBytes(32).toString("base64url"),now=new Date().toISOString();
      await database.prepare("INSERT INTO purchases (id,buyer_name,phone,email,address,items_json,total_paise,payment_token_hash,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)")
        .run(id,name,phone,email,address,JSON.stringify(items),totalPaise,hash(paymentToken),now,now);
      for(const item of items)await database.prepare("INSERT INTO purchase_reservations VALUES(?,?,?,?)").run(id,item.id,item.quantity,new Date(Date.now()+86400000).toISOString());
      return {purchase:publicOrder({id,items_json:JSON.stringify(items),total_paise:totalPaise,status:"Awaiting Payment",created_at:now}),paymentToken};
    });
  }
  async function handle(request,response,url) {
    if(url.pathname==="/api/purchases"&&request.method==="POST") {
      const result=await create(await readJSON(request));
      sendJSON(response,201,result,{"Set-Cookie":cookieName(result.purchase.id)+"="+result.paymentToken+"; Path=/api/purchases; HttpOnly; SameSite=Strict; Max-Age=604800"+(env.VERCEL?"; Secure":"")});return true;
    }
    const resume=url.pathname.match(/^\/api\/purchases\/([^/]+)\/session$/);
    if(resume&&request.method==="GET") {
      const row=await database.prepare("SELECT * FROM purchases WHERE id=?").get(resume[1]);
      if(!row||hash(tokenFor(request,row.id))!==row.payment_token_hash)fail("Purchase session unavailable.",403);
      sendJSON(response,200,{purchase:publicOrder(row)});return true;
    }
    const paymentMatch=url.pathname.match(/^\/api\/purchases\/([^/]+)\/payment$/);
    if(paymentMatch&&request.method==="POST") {
      const input=await readJSON(request);
      const token=tokenFor(request,paymentMatch[1],input);
      const reference=requiredText(input?.reference,"UPI transaction/reference ID",120).replace(/\s/g,"").toUpperCase();
      if(!/^[A-Z0-9_-]{6,120}$/.test(reference))fail("Enter a valid UPI transaction reference.");
      const purchase=await database.transaction(async()=>{
        const row=await database.prepare("SELECT * FROM purchases WHERE id=?").get(paymentMatch[1]);
        if(!row||hash(token)!==row.payment_token_hash) fail("Purchase not found or invalid payment session.",403);
        if(row.payment_reference) {
          if(row.payment_reference!==reference) fail("A different payment reference is already recorded.",409);
          return publicOrder(row);
        }
        if(await database.prepare("SELECT id FROM purchases WHERE payment_reference=?").get(reference)) fail("This payment reference is already linked to another purchase.",409);
        if(await isReferenceUsed(reference))fail("This payment reference is already linked to a donation.",409);
        if(Date.now()-Date.parse(row.created_at)>86400000)fail("This checkout reservation expired. Contact the Trust if you already paid.",409);
        await database.prepare("UPDATE purchase_reservations SET expires_at=? WHERE purchase_id=?").run("9999-12-31T23:59:59.999Z",row.id);
        await database.prepare("UPDATE purchases SET payment_reference=?,status='Pending Verification',updated_at=? WHERE id=?")
          .run(reference,new Date().toISOString(),row.id);
        return publicOrder({...row,status:"Pending Verification"});
      });
      sendJSON(response,200,{purchase});return true;
    }
    if(url.pathname==="/api/admin/purchases"&&request.method==="GET") {
      if(!await getSessionUser(request)) fail("Login required.",401);
      const offset=Math.max(0,Math.floor(Number(url.searchParams.get("offset"))||0)),limit=Math.min(200,Math.max(1,Math.floor(Number(url.searchParams.get("limit"))||50)));
      const rows=await database.prepare("SELECT * FROM purchases ORDER BY created_at DESC,id LIMIT ? OFFSET ?").all(limit,offset);
      const total=Number((await database.prepare("SELECT COUNT(*) AS total FROM purchases").get()).total);
      sendJSON(response,200,{total,offset,limit,purchases:rows.map(row=>({...publicOrder(row),name:row.buyer_name,phone:row.phone,email:row.email,address:row.address,reference:row.payment_reference||"",updatedAt:row.updated_at}))});return true;
    }
    const adminMatch=url.pathname.match(/^\/api\/admin\/purchases\/([^/]+)$/);
    if(adminMatch&&request.method==="PATCH") {
      const actor=await getSessionUser(request,["Admin","Editor"]);
      if(!actor) fail("Admin or Editor role required.",403);
      const input=await readJSON(request);
      if(!["Verified","Rejected","Pending Verification"].includes(input?.status)) fail("Choose a valid purchase status.");
      await database.transaction(async()=>{
        const row=await database.prepare("SELECT * FROM purchases WHERE id=?").get(adminMatch[1]);
        if(!row) fail("Purchase not found.",404);
        if(!row.payment_reference) fail("Payment reference is required before verifying a purchase.");
        if(row.status==="Verified"&&input.status!=="Verified")fail("Verified purchases are final. Record a refund separately instead of changing payment history.",409);
        if(row.status!==input.status) {
          const items=JSON.parse(row.items_json);
          if(input.status==="Verified") {
            const content=await getSiteContent();
            for(const item of items){const product=content.records.store.find(p=>p.id===item.id);if(product)await checkStock(product,item.quantity,row.id);}
            await adjustInventory(items);
          }
          if(input.status==="Verified"||input.status==="Rejected")await database.prepare("DELETE FROM purchase_reservations WHERE purchase_id=?").run(row.id);
          if(input.status==="Pending Verification"&&row.status==="Rejected") {
            const content=await getSiteContent();
            for(const item of items){const product=content.records.store.find(p=>p.id===item.id);if(product)await checkStock(product,item.quantity,row.id);await database.prepare("INSERT OR REPLACE INTO purchase_reservations VALUES(?,?,?,?)").run(row.id,item.id,item.quantity,"9999-12-31T23:59:59.999Z");}
          }
          await audit(actor,"purchase."+input.status,row.id);
        }
        await database.prepare("UPDATE purchases SET status=?,updated_at=? WHERE id=?").run(input.status,new Date().toISOString(),row.id);
      });
      sendJSON(response,200,{ok:true});return true;
    }
    return false;
  }
  return {handle};
}
module.exports={purchaseSchema,createPurchaseService};
