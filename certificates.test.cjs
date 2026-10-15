"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path"),crypto=require("node:crypto");
const {createDatabase}=require("./database.cjs");
const {certificateSchema,createCertificateService}=require("./certificates.cjs");
test("certificate email requires admin verification and avoids duplicate delivery",async()=>{
  const filename=path.join(os.tmpdir(),"bnk-certificates-"+crypto.randomUUID()+".sqlite");
  const database=createDatabase({root:__dirname,env:{DATABASE_PATH:filename}});
  await database.exec(certificateSchema);
  const donor={id:"donation_test",name:"A <Donor>",phone:"9876543210",amount:501,purpose:"Meals & service",status:"Pending",email:"donor@example.org"};
  const records=[donor],sent=[];
  const env={};
  let providerMode="ok";
  const service=createCertificateService({database,env,getSiteContent:async()=>({records:{donations:records}}),getSessionUser:async request=>request.admin?{role:"Admin"}:null,sendJSON:(response,status,data)=>{response.status=status;response.data=data;},transportFactory:()=>({sendMail:async message=>{
    sent.push(message);
    if(providerMode==="network")throw Error("Timeout");
    if(providerMode==="rejected"){const error=Error("Rejected");error.code="EAUTH";throw error;}
    return {messageId:"message-"+sent.length,accepted:[message.to]};
  }})
  });
  try{
    await service.sync(records);await service.processQueue();
    assert.equal((await database.prepare("SELECT * FROM email_certificate_deliveries").all()).length,0);
    donor.status="Verified";
    await service.sync(records);await service.processQueue();
    let row=await database.prepare("SELECT * FROM email_certificate_deliveries WHERE donation_id=?").get(donor.id);
    assert.equal(row.status,"Setup required");assert.equal(sent.length,0);
    Object.assign(env,{SMTP_HOST:"smtp.gmail.com",SMTP_USER:"Bnksevatrust@gmail.com",SMTP_PASS:"fake-test-password",SMTP_FROM:"BNK Seva Trust <Bnksevatrust@gmail.com>",SMTP_SECURE:"true",PUBLIC_SITE_URL:"https://example.org"});
    await service.sync(records);
    assert.equal(sent.length,0,"Saving verification queues email without sending inside the save request");
    await service.processQueue();
    assert.equal(sent.length,1);
    assert.equal(sent[0].to,"donor@example.org");
    assert.equal(sent[0].attachments[0].contentType,"image/svg+xml");
    assert.ok(sent[0].text.includes(row.token));
    await service.sync(records);await service.processQueue();await service.send(donor.id);
    assert.equal(sent.length,1);
    row=await database.prepare("SELECT * FROM email_certificate_deliveries WHERE donation_id=?").get(donor.id);
    assert.equal(row.status,"Submitted to email server");
    const response={writeHead(status,headers){this.status=status;this.headers=headers},end(body){this.body=body}};
    await service.handle({method:"GET"},response,new URL("https://example.org/api/certificates/"+row.token));
    assert.equal(response.status,200);assert.ok(response.body.includes("A &lt;Donor&gt;"));assert.ok(!response.body.includes(donor.phone));
    donor.status="Pending";await service.handle({method:"GET"},response,new URL("https://example.org/api/certificates/"+row.token));assert.equal(response.status,404);
    donor.status="Verified";
    const adminResponse={};await service.handle({method:"GET"},adminResponse,new URL("https://example.org/api/admin/certificates"));assert.equal(adminResponse.status,401);
    await service.handle({method:"GET",admin:true},adminResponse,new URL("https://example.org/api/admin/certificates"));assert.ok(!JSON.stringify(adminResponse.data).includes(row.token));
    records.push({...donor,id:"no-email",email:""});
    await service.sync(records);await service.processQueue();assert.equal(sent.length,1);
    providerMode="network";records.push({...donor,id:"ambiguous"});
    await service.sync(records);await service.processQueue();
    assert.equal((await database.prepare("SELECT status FROM email_certificate_deliveries WHERE donation_id='ambiguous'").get()).status,"Check mail provider");
    const count=sent.length;await service.sync(records);await service.processQueue();await service.send("ambiguous");assert.equal(sent.length,count);
    providerMode="rejected";records.push({...donor,id:"rejected"});await service.sync(records);await service.processQueue();
    assert.equal((await database.prepare("SELECT status FROM email_certificate_deliveries WHERE donation_id='rejected'").get()).status,"Failed");
    providerMode="ok";await service.send("rejected");
    assert.equal((await database.prepare("SELECT status FROM email_certificate_deliveries WHERE donation_id='rejected'").get()).status,"Submitted to email server");
    await database.prepare("UPDATE email_certificate_deliveries SET status='Sending',updated_at=? WHERE donation_id='rejected'").run(new Date(Date.now()-600000).toISOString());
    const beforeRecovery=sent.length;await service.processQueue();
    assert.equal((await database.prepare("SELECT status FROM email_certificate_deliveries WHERE donation_id='rejected'").get()).status,"Check mail provider");assert.equal(sent.length,beforeRecovery);
  }finally{database.close();for(const suffix of ["","-wal","-shm"])fs.rmSync(filename+suffix,{force:true});}
});
test("QR donation submission does not show a receipt or certificate before verification",()=>{
  const source=fs.readFileSync("donation.js","utf8");
  const handler=source.slice(source.indexOf("const savePendingDonation"),source.indexOf('referenceInput.addEventListener("input"'));
  assert.ok(!handler.includes("displayReceipt("));
  assert.ok(!source.includes("whatsappConsent"));
  assert.ok(handler.includes("pending verification"));
});
