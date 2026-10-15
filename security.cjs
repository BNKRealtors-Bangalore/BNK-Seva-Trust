"use strict";
const crypto=require("node:crypto");
const publicFields={
  initiatives:["id","name","campaignName","location","date","image","status","description"],
  updates:["id","name","category","status","description","image","date"],
  store:["id","name","category","price","image","description","status"],
  stories:["id","name","quote","image","category","status","description"]
};
function publicContent(content){
  const statuses={initiatives:["Active","Completed","Planned"],updates:["Published"],store:["Active"],stories:["Published"]};
  const records={};
  for(const [key,fields]of Object.entries(publicFields)){
    records[key]=(content.records?.[key]||[]).filter(row=>statuses[key].includes(row.status)).map(row=>Object.fromEntries(fields.filter(field=>row[field]!==undefined).map(field=>[field,row[field]])));
  }
  records.store=records.store.map(row=>{
    const source=content.records.store.find(product=>product.id===row.id);
    return {...row,available:source.stock===""||source.stock===undefined||source.stock===null||Number(source.stock)>0};
  });
  return{records,milestones:(content.milestones||[]).map(({name,status})=>({name,status})),goal:content.goal,templeNote:content.templeNote};
}
const securitySchema="CREATE TABLE IF NOT EXISTS request_limits (key TEXT NOT NULL, bucket INTEGER NOT NULL, hits INTEGER NOT NULL, expires INTEGER NOT NULL, PRIMARY KEY(key,bucket))";
function sameOrigin(request){
  if(request.headers["sec-fetch-site"]==="cross-site")return false;
  const origin=request.headers.origin;
  if(!origin)return true;
  try{return new URL(origin).host===request.headers.host&&["https:","http:"].includes(new URL(origin).protocol)}catch{return false}
}
function createSecurity({database,env=process.env}){
  async function guard(request,response,url){
    if(!url.pathname.startsWith("/api/"))return true;
    if(!["GET","HEAD","OPTIONS"].includes(request.method)&&!url.pathname.startsWith("/api/webhooks/")){
      if(!sameOrigin(request)){response.writeHead(403,{"Content-Type":"application/json","Cache-Control":"no-store"});response.end(JSON.stringify({error:"This request must come from this website."}));return false;}
      const type=String(request.headers["content-type"]||"").split(";")[0];
      const hasBody=Number(request.headers["content-length"]||0)>0||request.headers["transfer-encoding"]||request.body;
      if(hasBody&&type!=="application/json"&&!(url.pathname==="/api/admin/upload-image"&&type==="multipart/form-data")){
        response.writeHead(415,{"Content-Type":"application/json","Cache-Control":"no-store"});response.end(JSON.stringify({error:"Use a supported request content type."}));return false;
      }
    }
    let limit=0,windowSeconds=900,group="";
    if(url.pathname==="/api/admin/login"){limit=20;group="login";}
    else if(url.pathname==="/api/newsletter/subscribe"){limit=20;windowSeconds=3600;group="newsletter";}
    else if(url.pathname.startsWith("/api/public-submissions/")&&request.method==="POST"){limit=30;windowSeconds=3600;group="submissions";}
    else if(url.pathname.startsWith("/api/purchases")&&request.method==="POST"){limit=40;windowSeconds=3600;group="purchases";}
    else if(url.pathname==="/api/donations/order"&&request.method==="POST"){limit=20;windowSeconds=3600;group="donation-orders";}
    else if(url.pathname==="/api/payments/verify"&&request.method==="POST"){limit=60;windowSeconds=3600;group="payment-verification";}
    if(!limit)return true;
    const ip=env.VERCEL?String(request.headers["x-forwarded-for"]||request.socket?.remoteAddress||"unknown").split(",")[0].trim():request.socket?.remoteAddress||"local";
    const key=crypto.createHash("sha256").update(group+":"+ip).digest("hex");
    const now=Math.floor(Date.now()/1000),bucket=Math.floor(now/windowSeconds);
    const result=await database.prepare("INSERT INTO request_limits(key,bucket,hits,expires) VALUES(?,?,1,?) ON CONFLICT(key,bucket) DO UPDATE SET hits=hits+1 RETURNING hits").get(key,bucket,(bucket+1)*windowSeconds);
    if(Math.random()<.02)await database.prepare("DELETE FROM request_limits WHERE expires<?").run(now);
    if(result.hits>limit){response.writeHead(429,{"Content-Type":"application/json","Cache-Control":"no-store","Retry-After":String((bucket+1)*windowSeconds-now)});response.end(JSON.stringify({error:"Too many requests. Please try again later."}));return false}
    return true;
  }
  return{guard};
}
const securityHeaders={
  "X-Content-Type-Options":"nosniff","X-Frame-Options":"DENY","Referrer-Policy":"no-referrer",
  "Permissions-Policy":"camera=(), microphone=(), geolocation=()",
  "Content-Security-Policy":"object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"
};
module.exports={publicContent,securitySchema,createSecurity,securityHeaders,sameOrigin};
