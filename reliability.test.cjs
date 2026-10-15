"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path"),crypto=require("node:crypto");
const filename=path.join(os.tmpdir(),"bnk-reliability-"+crypto.randomUUID()+".sqlite");
Object.assign(process.env,{DATABASE_PATH:filename,TURSO_DATABASE_URL:"",TURSO_AUTH_TOKEN:"",VERCEL:"",ADMIN_EMAIL:"audit@example.org",ADMIN_PASSWORD:"test-password-for-audit",CERTIFICATE_EMAIL_ENABLED:"false"});
const app=require("./server.cjs");
const {snapshot,encryptBackup,decryptBackup,restore,createOperations,authorizedCron}=require("./operations.cjs");
let base,adminCookie;
async function request(route,body,cookie,method=body?"POST":"GET"){
 const response=await fetch(base+route,{method,headers:{"Content-Type":"application/json",...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});
 return{status:response.status,data:await response.json(),cookie:response.headers.get("set-cookie")?.split(";")[0]};
}
test.before(async()=>{await app.initialize();await new Promise(resolve=>app.server.listen(0,"127.0.0.1",resolve));base="http://127.0.0.1:"+app.server.address().port;const login=await request("/api/admin/login",{email:"audit@example.org",password:"test-password-for-audit"});assert.equal(login.status,200);adminCookie=login.cookie;});
test.after(async()=>{await new Promise(resolve=>app.server.close(resolve));app.closeDatabase();for(const suffix of ["","-wal","-shm"])fs.rmSync(filename+suffix,{force:true});});
const donor={name:"Test Donor",phone:"9876543210",email:"donor@example.org",amount:501,type:"General Donation",reference:"UPI-UNIQUE-100"};
test("more than 200 records survive normalized storage and paginated retrieval",async()=>{
 const content=await app.getSiteContent();content.records.donations=Array.from({length:225},(_,i)=>({...donor,id:"donor_"+i,reference:"UPI-HISTORY-"+i,status:"Pending"}));
 await app.saveSiteContent(content);
 assert.equal((await app.getSiteContent()).records.donations.length,225);
 const page=await request("/api/admin/records/donations?offset=200&limit=50",null,adminCookie);
 assert.equal(page.status,200);assert.equal(page.data.total,225);assert.equal(page.data.records.length,25);
});
test("stale publishing and record edits cannot overwrite newer website submissions",async()=>{
 const before=await app.getSiteContent();
 const submitted=await request("/api/public-submissions/donation",donor);assert.equal(submitted.status,201);
 const stale=await request("/api/admin/site-content",before,adminCookie,"PUT");assert.equal(stale.status,409);
 const edit=await request("/api/admin/records/donations/donor_0",{version:before._version,record:{...donor,id:"donor_0"}},adminCookie,"PATCH");assert.equal(edit.status,409);
 const latest=await app.getSiteContent();assert.equal(latest.records.donations.length,226);assert.ok(latest.records.donations.some(r=>r.id===submitted.data.record.id));
 const good=await request("/api/admin/records/donations/donor_0",{version:latest._version,record:{...latest.records.donations.find(r=>r.id==="donor_0"),name:"Updated"}},adminCookie,"PATCH");assert.equal(good.status,200);
 assert.equal(good.data.records.donations.length,226);
 const audit=await request("/api/admin/audit",null,adminCookie);assert.ok(audit.data.events.some(e=>e.action==="record.save"&&e.target==="donations/donor_0"));
});
test("QR donations reject malformed contact details and duplicate normalized references",async()=>{
 assert.equal((await request("/api/public-submissions/donation",{...donor,email:"bad",reference:"UPI-NEW-200"})).status,400);
 assert.equal((await request("/api/public-submissions/donation",{...donor,reference:" upi-unique-100 "})).status,400);
 assert.equal((await request("/api/public-submissions/donation",{...donor,phone:"abc",reference:"UPI-NEW-200"})).status,400);
});
test("finite stock is reserved atomically, zero is unavailable, and verification deducts once",async()=>{
 const content=await app.getSiteContent();content.records.store=[{id:"limited",name:"Limited",price:100,stock:1,status:"Active"},{id:"zero",name:"Zero",price:100,stock:0,status:"Active"}];await app.saveSiteContent(content);
 const buyer={name:"Buyer",phone:"9876543210",email:"buyer@example.org",address:"A test address",items:[{id:"limited",quantity:1}]};
 assert.equal((await request("/api/purchases",{...buyer,items:[{id:"zero",quantity:1}]})).status,400);
 const results=await Promise.all([request("/api/purchases",buyer),request("/api/purchases",buyer)]);
 assert.deepEqual(results.map(r=>r.status).sort(),[201,400]);const created=results.find(r=>r.status===201);
 assert.ok(created.cookie);const id=created.data.purchase.id;
 const resumed=await request("/api/purchases/"+id+"/session",null,created.cookie);assert.equal(resumed.status,200);assert.ok(!JSON.stringify(resumed.data).includes(buyer.address));
 assert.equal((await request("/api/purchases/"+id+"/session")).status,403);
 assert.equal((await request("/api/purchases/"+id+"/payment",{reference:"UPI-STOCK-100"},created.cookie)).status,200);
 for(let i=0;i<2;i++)assert.equal((await request("/api/admin/purchases/"+id,{status:"Verified"},adminCookie,"PATCH")).status,200);
 assert.equal((await app.getSiteContent()).records.store.find(r=>r.id==="limited").stock,0);
 assert.equal((await request("/api/admin/purchases/"+id,{status:"Rejected"},adminCookie,"PATCH")).status,409);
});
test("new admin users enforce the same password policy as password changes",async()=>{
 const result=await request("/api/admin/users",{users:[{email:"new@example.org",name:"New User",role:"Viewer",password:"short"}]},adminCookie,"PUT");assert.equal(result.status,400);
});
test("encrypted complete backups authenticate, restore data, and invalidate sessions",async()=>{
 const data=await snapshot(app.database),key=crypto.randomBytes(32).toString("base64"),encrypted=encryptBackup(data,key);
 assert.ok(!encrypted.toString().includes(donor.email));assert.deepEqual(decryptBackup(encrypted,key),data);
 assert.throws(()=>decryptBackup(encrypted,crypto.randomBytes(32).toString("base64")));
 const tampered=JSON.parse(encrypted);tampered.data=(tampered.data[0]==="A"?"B":"A")+tampered.data.slice(1);assert.throws(()=>decryptBackup(Buffer.from(JSON.stringify(tampered)),key));
 const before=(await app.getSiteContent()).records.donations.length;
 await app.database.prepare("DELETE FROM site_records WHERE collection='donations'").run();
 await restore(app.database,decryptBackup(encrypted,key));assert.equal((await app.getSiteContent()).records.donations.length,before);
 assert.equal((await request("/api/admin/site-content",null,adminCookie)).status,401);
});
test("scheduled backups use encrypted content and private storage; cron is authenticated",async()=>{
 const env={BACKUP_ENCRYPTION_KEY:crypto.randomBytes(32).toString("base64"),BACKUP_BLOB_STORE_ID:"private-store",BACKUP_BLOB_READ_WRITE_TOKEN:"test-private-token",CRON_SECRET:"test-cron-secret"};let uploaded;
 const service=createOperations({database:app.database,env,certificateService:{processQueue:async()=>({processed:0})},blobPut:async(name,body,options)=>{uploaded={body,options};return{pathname:name}}});
 assert.equal((await service.backup()).status,"Complete");assert.equal(uploaded.options.access,"private");assert.equal(uploaded.options.storeId,"private-store");assert.ok(decryptBackup(uploaded.body,env.BACKUP_ENCRYPTION_KEY).tables.purchases.length>0);
 assert.equal(authorizedCron({headers:{}},env),false);assert.equal(authorizedCron({headers:{authorization:"Bearer test-cron-secret"}},env),true);
});
