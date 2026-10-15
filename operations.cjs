"use strict";
const crypto=require("node:crypto");
const tables=["donations","receipt_counters","app_config","admin_users","newsletter_subscribers","site_records","site_content_meta","donation_references","purchases","purchase_reservations","email_certificate_deliveries","admin_audit"];
function encryptionKey(value){
  const text=String(value||"");
  const key=/^[a-f0-9]{64}$/i.test(text)?Buffer.from(text,"hex"):Buffer.from(text,"base64");
  if(key.length!==32)throw Error("BACKUP_ENCRYPTION_KEY must encode exactly 32 random bytes.");
  return key;
}
async function snapshot(database){
  return database.transaction(async()=>{
    const data={};
    for(const table of tables)data[table]=(await database.prepare('SELECT * FROM "'+table+'"').all()).map(row=>({...row}));
    return {format:1,createdAt:new Date().toISOString(),tables:data};
  });
}
function encryptBackup(snapshot,keyValue){
  const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv("aes-256-gcm",encryptionKey(keyValue),iv);
  cipher.setAAD(Buffer.from("BNK-BACKUP-1"));
  const ciphertext=Buffer.concat([cipher.update(JSON.stringify(snapshot)),cipher.final()]);
  return Buffer.from(JSON.stringify({format:"BNK-BACKUP-1",iv:iv.toString("base64"),tag:cipher.getAuthTag().toString("base64"),data:ciphertext.toString("base64")}));
}
function decryptBackup(buffer,keyValue){
  const input=JSON.parse(buffer.toString("utf8"));
  if(input.format!=="BNK-BACKUP-1")throw Error("Unsupported backup format.");
  const decipher=crypto.createDecipheriv("aes-256-gcm",encryptionKey(keyValue),Buffer.from(input.iv,"base64"));
  decipher.setAAD(Buffer.from(input.format));decipher.setAuthTag(Buffer.from(input.tag,"base64"));
  const data=JSON.parse(Buffer.concat([decipher.update(Buffer.from(input.data,"base64")),decipher.final()]).toString("utf8"));
  if(data.format!==1||!data.tables||tables.some(table=>!Array.isArray(data.tables[table])))throw Error("Incomplete database backup.");
  return data;
}
async function restore(database,data){
  // Column names are checked against the destination schema, never executed from a backup.
  const columns={};
  for(const table of tables)columns[table]=new Set((await database.prepare('PRAGMA table_info("'+table+'")').all()).map(row=>row.name));
  for(const table of tables)for(const row of data.tables[table])if(Object.keys(row).some(key=>!columns[table].has(key)))throw Error("Backup schema does not match "+table+".");
  await database.transaction(async()=>{
    await database.prepare("DELETE FROM admin_sessions").run();
    for(const table of [...tables].reverse())await database.prepare('DELETE FROM "'+table+'"').run();
    for(const table of tables)for(const row of data.tables[table]){
      const keys=Object.keys(row);
      await database.prepare('INSERT INTO "'+table+'" ('+keys.map(key=>'"'+key+'"').join(",")+') VALUES ('+keys.map(()=>"?").join(",")+')').run(...keys.map(key=>row[key]));
    }
  });
}
function authorizedCron(request,env=process.env){
  if(!env.CRON_SECRET)return false;
  const actual=crypto.createHash("sha256").update(String(request.headers.authorization||"")).digest();
  const expected=crypto.createHash("sha256").update("Bearer "+env.CRON_SECRET).digest();
  return crypto.timingSafeEqual(actual,expected);
}
function createOperations({database,certificateService,sendJSON,getSessionUser,audit,env=process.env,blobPut}){
  async function backup(){
    if(!env.BACKUP_ENCRYPTION_KEY||!env.BACKUP_BLOB_STORE_ID||!(env.BACKUP_BLOB_READ_WRITE_TOKEN||env.VERCEL_OIDC_TOKEN))return {status:"Setup required"};
    const body=encryptBackup(await snapshot(database),env.BACKUP_ENCRYPTION_KEY);
    // A separate PRIVATE store is required; never use the public image-upload token.
    const put=blobPut||require("@vercel/blob").put;
    const blob=await put("database/"+new Date().toISOString().replace(/[:.]/g,"-")+".bnkbackup",body,{access:"private",storeId:env.BACKUP_BLOB_STORE_ID,token:env.BACKUP_BLOB_READ_WRITE_TOKEN,addRandomSuffix:true,contentType:"application/octet-stream"});
    await database.prepare("INSERT INTO app_config(key,value,updated_at) VALUES('last_backup',?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at").run(JSON.stringify({status:"Complete",pathname:blob.pathname}),new Date().toISOString());
    return {status:"Complete"};
  }
  async function handle(request,response,url){
    if(url.pathname==="/api/cron/maintenance"&&request.method==="GET"){
      if(!authorizedCron(request,env)){sendJSON(response,401,{error:"Unauthorized."});return true;}
      const result={certificates:await certificateService.processQueue()};
      try{result.backup=await backup()}catch{result.backup={status:"Failed"};console.error("Encrypted database backup failed; check backup service configuration.");}
      await database.prepare("INSERT INTO app_config(key,value,updated_at) VALUES('last_maintenance',?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at").run(JSON.stringify(result),new Date().toISOString());
      sendJSON(response,result.backup.status==="Failed"?503:200,result);return true;
    }
    if(url.pathname==="/api/admin/operations"&&request.method==="GET"){
      if(!await getSessionUser(request,["Admin"])){sendJSON(response,403,{error:"Admin role required."});return true;}
      const rows=await database.prepare("SELECT key,value,updated_at FROM app_config WHERE key IN ('last_backup','last_maintenance')").all();
      sendJSON(response,200,{backupConfigured:Boolean(env.BACKUP_ENCRYPTION_KEY&&env.BACKUP_BLOB_STORE_ID&&(env.BACKUP_BLOB_READ_WRITE_TOKEN||env.VERCEL_OIDC_TOKEN)),cronConfigured:Boolean(env.CRON_SECRET),checks:rows.map(row=>({key:row.key,status:JSON.parse(row.value).status||JSON.parse(row.value).backup?.status||"Finished",updatedAt:row.updated_at}))});return true;
    }
    if(url.pathname==="/api/admin/backup"&&request.method==="POST"){
      const actor=await getSessionUser(request,["Admin"]);
      if(!actor){sendJSON(response,403,{error:"Admin role required."});return true;}
      const result=await backup();await audit(actor,"backup.create","database");sendJSON(response,result.status==="Complete"?200:503,result);return true;
    }
    return false;
  }
  return{handle,backup};
}
module.exports={tables,snapshot,encryptBackup,decryptBackup,restore,authorizedCron,createOperations};
