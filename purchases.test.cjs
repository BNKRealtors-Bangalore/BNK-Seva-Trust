"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path"),crypto=require("node:crypto"),http=require("node:http");
const {createDatabase}=require("./database.cjs");
const {purchaseSchema,createPurchaseService}=require("./purchases.cjs");
test("purchase checkout stores private itemized orders and requires payment verification",async t=>{
  const filename=path.join(os.tmpdir(),"bnk-purchases-"+crypto.randomUUID()+".sqlite");
  const database=createDatabase({root:__dirname,env:{DATABASE_PATH:filename}});
  await database.exec(purchaseSchema);
  const content={records:{store:[{id:"camphor",name:"Camphor",price:101,status:"Active"},{id:"draft",name:"Draft",price:10,status:"Draft"}]}};
  const service=createPurchaseService({
    database,getSiteContent:async()=>content,getPricingConfig:async()=>({storePrices:{box:1499}}),
    getSessionUser:async(req,roles)=>{const role=req.headers["x-test-role"];return role&&(!roles||roles.includes(role))?{role}:null;},
    readJSON:async req=>{let data="";for await(const chunk of req)data+=chunk;return JSON.parse(data);},
    sendJSON:(res,status,data)=>{res.writeHead(status,{"Content-Type":"application/json"});res.end(JSON.stringify(data));}
  });
  const server=http.createServer(async(req,res)=>{
    try{if(!await service.handle(req,res,new URL(req.url,"http://localhost"))){res.writeHead(404);res.end();}}
    catch(error){res.writeHead(error.statusCode||400,{"Content-Type":"application/json"});res.end(JSON.stringify({error:error.message}));}
  });
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  const base="http://127.0.0.1:"+server.address().port;
  const request=async(route,body,role,method=body?"POST":"GET")=>{
    const res=await fetch(base+route,{method,headers:{"Content-Type":"application/json",...(role?{"x-test-role":role}:{})},...(body?{body:JSON.stringify(body)}:{})});
    return {status:res.status,data:await res.json().catch(()=>({}))};
  };
  const buyer={name:"Test Buyer",phone:"+919876543210",email:"buyer@example.org",address:"Test delivery address",items:[{id:"camphor",quantity:2},{id:"box",quantity:1}]};
  try{
    await t.test("validates contact details, availability and quantities",async()=>{
      assert.equal((await request("/api/purchases",{...buyer,address:""})).status,400);
      assert.equal((await request("/api/purchases",{...buyer,email:"bad"})).status,400);
      for(const items of [[{id:"camphor",quantity:-1}],[{id:"camphor",quantity:1.5}],[{id:"draft",quantity:1}],[{id:"missing",quantity:1}]]){
        assert.equal((await request("/api/purchases",{...buyer,items})).status,400);
      }
    });
    const created=await request("/api/purchases",{...buyer,totalPaise:1,items:buyer.items.map(item=>({...item,price:1}))});
    assert.equal(created.status,201);
    const {purchase,paymentToken}=created.data;
    await t.test("uses catalog prices and snapshots each quantity",()=>{
      assert.equal(purchase.totalPaise,170100);
      assert.equal(purchase.items[0].quantity,2);
      assert.equal(purchase.items[0].lineTotalPaise,20200);
      assert.equal(purchase.status,"Awaiting Payment");
      assert.ok(!JSON.stringify(purchase).includes(buyer.address));
    });
    await t.test("keeps buyer details private and requires payment capability",async()=>{
      assert.equal((await request("/api/admin/purchases")).status,401);
      assert.equal((await request("/api/purchases/"+purchase.id+"/payment",{paymentToken:"wrong",reference:"UPI-TEST"})).status,403);
      assert.equal((await request("/api/admin/purchases/"+purchase.id,{status:"Verified"},"Admin","PATCH")).status,400);
    });
    await t.test("submitting a reference stays pending and retries are idempotent",async()=>{
      const body={paymentToken,reference:"UPI-TEST"};
      assert.equal((await request("/api/purchases/"+purchase.id+"/payment",body)).data.purchase.status,"Pending Verification");
      assert.equal((await request("/api/purchases/"+purchase.id+"/payment",body)).status,200);
      assert.equal((await request("/api/purchases/"+purchase.id+"/payment",{paymentToken,reference:"OTHER"})).status,409);
      const another=await request("/api/purchases",buyer);
      assert.equal((await request("/api/purchases/"+another.data.purchase.id+"/payment",{paymentToken:another.data.paymentToken,reference:"UPI-TEST"})).status,409);
    });
    await t.test("admin sees delivery details and can verify; viewer cannot modify",async()=>{
      const list=await request("/api/admin/purchases",null,"Admin");
      const record=list.data.purchases.find(item=>item.id===purchase.id);
      assert.equal(record.address,buyer.address);assert.equal(record.items[0].name,"Camphor");assert.equal(record.reference,"UPI-TEST");
      assert.ok(!JSON.stringify(list.data).includes(paymentToken));assert.ok(!JSON.stringify(list.data).includes("payment_token_hash"));
      assert.equal((await request("/api/admin/purchases/"+purchase.id,{status:"Verified"},"Viewer","PATCH")).status,403);
      assert.equal((await request("/api/admin/purchases/"+purchase.id,{status:"Verified"},"Admin","PATCH")).status,200);
      const updated=await request("/api/admin/purchases",null,"Admin");
      assert.equal(updated.data.purchases.find(item=>item.id===purchase.id).status,"Verified");
    });
    await t.test("purchase snapshots survive catalog edits and public lookup is unavailable",async()=>{
      content.records.store[0].price=999;
      const list=await request("/api/admin/purchases",null,"Admin");
      assert.equal(list.data.purchases.find(item=>item.id===purchase.id).items[0].unitPricePaise,10100);
      assert.equal((await request("/api/purchases/"+purchase.id)).status,404);
    });
  }finally{await new Promise(resolve=>server.close(resolve));database.close();for(const suffix of ["","-shm","-wal"])fs.rmSync(filename+suffix,{force:true});}
});
