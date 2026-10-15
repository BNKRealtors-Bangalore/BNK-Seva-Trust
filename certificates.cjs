"use strict";
const crypto=require("node:crypto");
const certificateSchema="CREATE TABLE IF NOT EXISTS email_certificate_deliveries (donation_id TEXT PRIMARY KEY, token TEXT NOT NULL UNIQUE, snapshot TEXT NOT NULL, email TEXT NOT NULL, status TEXT NOT NULL, message_id TEXT, last_error TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)";
const escape=value=>String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
function certificateSVG(record) {
  const name=record.visibility==="anonymous"?"Anonymous Sevak":record.name;
  const amount="INR "+Number(record.amount).toLocaleString("en-IN");
  const date=new Date(record.verifiedAt).toLocaleDateString("en-IN",{timeZone:"Asia/Kolkata",day:"numeric",month:"long",year:"numeric"});
  return '<?xml version="1.0" encoding="UTF-8"?>'+
  '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1100" viewBox="0 0 1600 1100">'+
  '<rect width="1600" height="1100" fill="#fff8e8"/><rect x="55" y="55" width="1490" height="990" rx="22" fill="none" stroke="#b78a42" stroke-width="7"/><rect x="80" y="80" width="1440" height="940" rx="16" fill="none" stroke="#d8ad65" stroke-width="2"/>'+
  '<g text-anchor="middle" font-family="Georgia,serif" fill="#800b23"><text x="800" y="195" font-size="38" letter-spacing="8">BNK SEVA TRUST</text><text x="800" y="330" font-size="92">Certificate of Seva</text><text x="800" y="430" font-size="32" fill="#655449">Presented with gratitude to</text>'+
  '<text x="800" y="535" font-size="58" textLength="'+Math.min(1200,Math.max(180,String(name).length*32))+'" lengthAdjust="spacingAndGlyphs">'+escape(name)+'</text>'+
  '<text x="800" y="630" font-size="32" fill="#655449">for a verified contribution of</text><text x="800" y="715" font-size="60">'+escape(amount)+'</text>'+
  '<text x="800" y="790" font-size="28" textLength="'+Math.min(1200,Math.max(200,String(record.purpose||record.type).length*15))+'" lengthAdjust="spacingAndGlyphs">'+escape(record.purpose||record.type)+'</text>'+
  '<text x="800" y="895" font-size="23" fill="#655449">Certificate: '+escape(record.id)+' | '+escape(date)+'</text><text x="800" y="965" font-size="28" font-style="italic">Love everyone. Serve everyone. Remember God.</text></g></svg>';
}
function createCertificateService({database,getSiteContent,getSessionUser,sendJSON,env=process.env,transportFactory}) {
  const validEmail=value=>typeof value==="string"&&value.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  function configured(){return env.CERTIFICATE_EMAIL_ENABLED!=="false"&&Boolean(env.SMTP_HOST&&env.SMTP_USER&&env.SMTP_PASS&&env.SMTP_FROM);}
  let transport;
  function mailer(){
    if(!transport)transport=(transportFactory||require("nodemailer").createTransport)({
      host:env.SMTP_HOST,port:Number(env.SMTP_PORT||465),secure:env.SMTP_SECURE==="true",
      auth:{user:env.SMTP_USER,pass:env.SMTP_PASS},connectionTimeout:10000,greetingTimeout:10000,socketTimeout:15000
    });
    return transport;
  }
  async function issue(record){
    if(record.status!=="Verified"||!validEmail(record.email))return;
    const now=new Date().toISOString();
    const snapshot={id:record.id,name:record.name,amount:record.amount,purpose:record.purpose,type:record.type,visibility:record.visibility,verifiedAt:now};
    await database.prepare("INSERT INTO email_certificate_deliveries(donation_id,token,snapshot,email,status,created_at,updated_at) VALUES(?,?,?,?, 'Ready',?,?) ON CONFLICT(donation_id) DO NOTHING")
      .run(record.id,crypto.randomBytes(32).toString("hex"),JSON.stringify(snapshot),record.email.trim().toLowerCase(),now,now);
  }
  async function send(id){
    const content=await getSiteContent(),record=content.records.donations.find(item=>item.id===id);
    if(!record||record.status!=="Verified"||!validEmail(record.email))return;
    await issue(record);
    if(!configured()){
      await database.prepare("UPDATE email_certificate_deliveries SET status='Setup required',updated_at=? WHERE donation_id=? AND status IN ('Ready','Setup required')").run(new Date().toISOString(),id);return;
    }
    const row=await database.prepare("UPDATE email_certificate_deliveries SET status='Sending',email=?,last_error=NULL,updated_at=? WHERE donation_id=? AND status IN ('Ready','Setup required','Failed') RETURNING *").get(record.email.trim().toLowerCase(),new Date().toISOString(),id);
    if(!row)return;
    try{
      const record=JSON.parse(row.snapshot);
      const url=/^https:\/\/[^/]+\/?$/.test(env.PUBLIC_SITE_URL||"")?env.PUBLIC_SITE_URL.replace(/\/$/,"")+"/api/certificates/"+row.token:null;
      const text="Dear "+record.name+",\n\nBNK Seva Trust has verified your donation of INR "+Number(record.amount).toLocaleString("en-IN")+". Your Certificate of Seva is attached."+(url?"\n\nDownload your certificate: "+url:"")+"\n\nThank you for your seva.\nBNK Seva Trust";
      const result=await mailer().sendMail({
        from:env.SMTP_FROM,to:row.email,replyTo:env.SMTP_USER,subject:"Your Certificate of Seva - BNK Seva Trust",
        text,html:"<p>Dear "+escape(record.name)+",</p><p>BNK Seva Trust has verified your donation of <strong>INR "+escape(Number(record.amount).toLocaleString("en-IN"))+"</strong>. Your Certificate of Seva is attached.</p>"+(url?'<p><a href="'+escape(url)+'">Download your certificate</a></p>':"")+"<p>Thank you for your seva.<br>BNK Seva Trust</p>",
        attachments:[{filename:"BNK-Seva-Certificate.svg",content:Buffer.from(certificateSVG(record)),contentType:"image/svg+xml"}],
        disableFileAccess:true,disableUrlAccess:true
      });
      const accepted=result.messageId&&result.accepted?.length>0;
      await database.prepare("UPDATE email_certificate_deliveries SET status=?,message_id=?,last_error=?,updated_at=? WHERE donation_id=?")
        .run(accepted?"Submitted to email server":"Check mail provider",result.messageId||null,accepted?null:"Email acceptance is unclear; check the sender mailbox before retrying.",new Date().toISOString(),id);
    }catch(error){
      const definite=["EAUTH","EENVELOPE","EMESSAGE"].includes(error.code)||Number(error.responseCode)>=400;
      await database.prepare("UPDATE email_certificate_deliveries SET status=?,last_error=?,updated_at=? WHERE donation_id=?")
        .run(definite?"Failed":"Check mail provider",definite?"Email rejected. Check SMTP authentication and recipient address.":"Connection interrupted; check the sender mailbox before retrying to avoid duplicates.",new Date().toISOString(),id);
    }
  }
  async function sync(records,previousRecords=[]){
    const previous=new Map(previousRecords.map(record=>[record.id,record]));
    const ready=[];
    for(const record of records){
      if(record.status!=="Verified"||!validEmail(record.email))continue;
      if(previous.get(record.id)?.status!=="Verified")await issue(record);
      const row=await database.prepare("SELECT status FROM email_certificate_deliveries WHERE donation_id=?").get(record.id);
      if(row&&["Ready","Setup required"].includes(row.status))ready.push(record.id);
    }
    let next=0;
    await Promise.all(Array.from({length:Math.min(3,ready.length)},async()=>{while(next<ready.length)await send(ready[next++]);}));
  }
  async function handle(request,response,url){
    const download=url.pathname.match(/^\/api\/certificates\/([a-f0-9]{64})$/);
    if(download&&request.method==="GET"){
      const row=await database.prepare("SELECT * FROM email_certificate_deliveries WHERE token=?").get(download[1]);
      const content=await getSiteContent();
      if(!row||!content.records.donations.some(item=>item.id===row.donation_id&&item.status==="Verified")){sendJSON(response,404,{error:"Certificate unavailable."});return true;}
      response.writeHead(200,{"Content-Type":"image/svg+xml; charset=utf-8","Content-Disposition":'attachment; filename="BNK-Seva-Certificate.svg"',"Cache-Control":"no-store","Referrer-Policy":"no-referrer","X-Content-Type-Options":"nosniff","Content-Security-Policy":"default-src 'none'; style-src 'unsafe-inline'; sandbox"});
      response.end(certificateSVG(JSON.parse(row.snapshot)));return true;
    }
    if(url.pathname==="/api/admin/certificates"&&request.method==="GET"){
      if(!await getSessionUser(request)){sendJSON(response,401,{error:"Login required."});return true;}
      const rows=await database.prepare("SELECT donation_id,email,status,last_error,created_at,updated_at FROM email_certificate_deliveries ORDER BY created_at DESC LIMIT 1000").all();
      const content=await getSiteContent();
      const certificates=rows.map(row=>({...row,name:content.records.donations.find(d=>d.id===row.donation_id)?.name||"Donor"}));
      for(const donor of content.records.donations.filter(d=>d.status==="Verified"&&!rows.some(row=>row.donation_id===d.id)))
        certificates.push({donation_id:donor.id,name:donor.name,email:donor.email||"",status:validEmail(donor.email)?"Not issued":"Invalid email address"});
      sendJSON(response,200,{configured:configured(),certificates});return true;
    }
    const retry=url.pathname.match(/^\/api\/admin\/certificates\/([^/]+)\/send$/);
    if(retry&&request.method==="POST"){
      if(!await getSessionUser(request,["Admin","Editor"])){sendJSON(response,403,{error:"Admin or Editor role required."});return true;}
      await send(retry[1]);sendJSON(response,200,{ok:true});return true;
    }
    return false;
  }
  return{sync,handle,send};
}
module.exports={certificateSchema,createCertificateService,certificateSVG};
