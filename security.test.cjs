"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path"),crypto=require("node:crypto");
const {publicContent,securitySchema,createSecurity,sameOrigin}=require("./security.cjs");
const {createDatabase}=require("./database.cjs");
test("public content excludes personal records, drafts, stock and hidden fields",()=>{
  const secret="PRIVATE-DO-NOT-PUBLISH";
  const records={donations:[{name:secret,email:secret}],csr:[{phone:secret}],partners:[{email:secret}],volunteers:[{phone:secret}],beneficiaries:[{notes:secret}],users:[{password:secret}],store:[{id:"active",name:"Camphor",price:101,status:"Active",email:secret,stock:19},{id:"draft",name:secret,status:"Draft"}],stories:[{id:"story",status:"Published",name:"Public donor",quote:"Seva",email:secret},{id:"draft-story",status:"Draft",name:secret}],updates:[],initiatives:[]};
  const result=publicContent({records,milestones:[{name:"Vision",status:"Completed",privateNote:secret}],goal:100,templeNote:"Public fundraising note"});
  assert.ok(!JSON.stringify(result).includes(secret));
  assert.deepEqual(Object.keys(result.records).sort(),["initiatives","store","stories","updates"]);
  assert.equal(result.records.store[0].name,"Camphor");
  assert.equal(result.records.store[0].stock,undefined);
});
test("cross-site requests are rejected while same-origin requests remain valid",()=>{
  assert.equal(sameOrigin({headers:{host:"example.org",origin:"https://attacker.example"}}),false);
  assert.equal(sameOrigin({headers:{host:"example.org",origin:"https://example.org"}}),true);
  assert.equal(sameOrigin({headers:{"sec-fetch-site":"cross-site",host:"example.org"}}),false);
});
test("login request limits persist across instances without storing raw IP addresses",async()=>{
  const filename=path.join(os.tmpdir(),"bnk-security-"+crypto.randomUUID()+".sqlite");
  const db=createDatabase({root:__dirname,env:{DATABASE_PATH:filename}});await db.exec(securitySchema);
  const guard=createSecurity({database:db,env:{}});
  const req={method:"POST",headers:{"content-type":"application/json"},socket:{remoteAddress:"192.0.2.15"}};
  const response={writeHead(code,headers){this.code=code;this.headers=headers},end(){}};
  const url=new URL("https://example.org/api/admin/login");
  try{for(let i=0;i<20;i++)assert.equal(await guard.guard(req,response,url),true);
    const next=createSecurity({database:db,env:{}});
    assert.equal(await next.guard(req,response,url),false);assert.equal(response.code,429);
    assert.ok(!JSON.stringify(await db.prepare("SELECT * FROM request_limits").all()).includes("192.0.2.15"));
    assert.equal(await guard.guard({...req,headers:{host:"example.org",origin:"https://attacker.example"}},response,url),false);assert.equal(response.code,403);
  }finally{db.close();fs.rmSync(filename,{force:true});}
});
test("admin browser persistence excludes private tables and passwords",()=>{
  const html=require('./page-source.cjs').pageSource('admin.html');assert.ok(html.includes("/api/admin/site-content"));
  assert.ok(!html.includes("localStorage.setItem(KEY,JSON.stringify(state))"));
  assert.ok(!html.includes("image/svg+xml"));
});
