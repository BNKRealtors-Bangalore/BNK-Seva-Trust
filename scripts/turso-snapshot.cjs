"use strict";
// Pre-migration backup: never import server.cjs or initialize/modify the live schema.
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto"),zlib=require("node:zlib");
const root=path.resolve(__dirname,"..");
const magic="BNK-TURSO-SQL-1";
const quote=value=>'"'+String(value).replace(/"/g,'""')+'"';
function readEnvironment(){
 const filename=path.join(root,".env"),text=fs.existsSync(filename)?fs.readFileSync(filename,"utf8"):"",env={};
 for(const line of text.split(/\r?\n/)){const m=line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);if(m)env[m[1]]=m[2].replace(/^(["'])(.*)\1$/,"$2");}
 return {env:{...env,...process.env},filename,text};
}
function keyFrom(value){
 const key=/^[a-f0-9]{64}$/i.test(value||"")?Buffer.from(value,"hex"):Buffer.from(value||"","base64");
 if(key.length!==32)throw Error("Configure a valid 32-byte BACKUP_ENCRYPTION_KEY in .env.");
 return key;
}
function literal(value){
 if(value===null)return "NULL";
 if(typeof value==="bigint")return value.toString();
 if(typeof value==="number"){if(!Number.isFinite(value))throw Error("Unsupported non-finite database number.");return String(value);}
 if(value instanceof ArrayBuffer||ArrayBuffer.isView(value))return "X'"+Buffer.from(value instanceof ArrayBuffer?value:value.buffer,value.byteOffset||0,value.byteLength).toString("hex")+"'";
 if(typeof value==="string")return value.includes("\0")?"CAST(X'"+Buffer.from(value).toString("hex")+"' AS TEXT)":"'"+value.replace(/'/g,"''")+"'";
 throw Error("Unsupported database value; refusing an incomplete backup.");
}
async function exportSQL(client){
 const transaction=await client.transaction("read");
 try{
  const schema=(await transaction.execute("SELECT type,name,sql FROM sqlite_schema WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY CASE type WHEN 'table' THEN 0 WHEN 'index' THEN 1 WHEN 'view' THEN 2 ELSE 3 END,name")).rows;
  const tables=schema.filter(row=>row.type==="table"),statements=["PRAGMA foreign_keys=OFF;","BEGIN TRANSACTION;"],counts={};
  for(const table of tables){
   statements.push(table.sql+";");
   const columns=(await transaction.execute("PRAGMA table_info("+quote(table.name)+")")).rows.map(row=>String(row.name));
   if(!columns.length)throw Error("Could not inspect a database table.");
   const selected=columns.map(quote).join(","),prefix="INSERT INTO "+quote(table.name)+" ("+selected+") VALUES (";
   let offset=0;
   for(;;){
    const rows=(await transaction.execute({sql:"SELECT "+selected+" FROM "+quote(table.name)+" LIMIT ? OFFSET ?",args:[500,offset]})).rows;
    for(const row of rows)statements.push(prefix+columns.map(column=>literal(row[column])).join(",")+");");
    offset+=rows.length;if(rows.length<500)break;
   }
   counts[table.name]=offset;
  }
  // Preserve AUTOINCREMENT high-water marks even when the highest row was deleted.
  const sequence=(await transaction.execute("SELECT name FROM sqlite_schema WHERE name='sqlite_sequence'")).rows;
  if(sequence.length){statements.push("DELETE FROM sqlite_sequence;");for(const row of (await transaction.execute("SELECT name,seq FROM sqlite_sequence")).rows)statements.push("INSERT INTO sqlite_sequence VALUES("+literal(row.name)+","+literal(row.seq)+");");}
  for(const item of schema.filter(row=>row.type!=="table"))statements.push(item.sql+";");
  statements.push("COMMIT;");await transaction.commit();
  return {sql:statements.join("\n")+"\n",counts};
 }catch(error){if(!transaction.closed)await transaction.rollback();throw error;}
 finally{transaction.close();}
}
function verifySQL(snapshot){
 const {DatabaseSync}=require("node:sqlite"),database=new DatabaseSync(":memory:");
 try{
  database.exec(snapshot.sql);
  if(database.prepare("PRAGMA integrity_check").get().integrity_check!=="ok")throw Error("Backup integrity verification failed.");
  if(database.prepare("PRAGMA foreign_key_check").all().length)throw Error("Backup has foreign-key inconsistencies; review before using it.");
  for(const [name,count]of Object.entries(snapshot.counts))if(Number(database.prepare("SELECT COUNT(*) AS count FROM "+quote(name)).get().count)!==count)throw Error("Backup row count mismatch.");
 }finally{database.close();}
}
function encrypt(snapshot,key){
 const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv("aes-256-gcm",key,iv);cipher.setAAD(Buffer.from(magic));
 const compressed=zlib.gzipSync(Buffer.from(JSON.stringify(snapshot)));
 const data=Buffer.concat([cipher.update(compressed),cipher.final()]);
 return Buffer.from(JSON.stringify({format:magic,iv:iv.toString("base64"),tag:cipher.getAuthTag().toString("base64"),data:data.toString("base64")}));
}
function decrypt(buffer,key){
 const input=JSON.parse(buffer.toString("utf8"));if(input.format!==magic)throw Error("Unsupported snapshot format.");
 const decipher=crypto.createDecipheriv("aes-256-gcm",key,Buffer.from(input.iv,"base64"));decipher.setAAD(Buffer.from(magic));decipher.setAuthTag(Buffer.from(input.tag,"base64"));
 return JSON.parse(zlib.gunzipSync(Buffer.concat([decipher.update(Buffer.from(input.data,"base64")),decipher.final()])).toString("utf8"));
}
async function main(){
 const [action="create",file,destination]=process.argv.slice(2),settings=readEnvironment();
 if(!["create","verify","decrypt"].includes(action))throw Error("Usage: node scripts/turso-snapshot.cjs create|verify|decrypt [backup-file] [output-file]");
 let client;
 try{
  if(action==="verify"||action==="decrypt"){
   if(!file)throw Error("Specify the encrypted backup file.");
   const snapshot=decrypt(fs.readFileSync(path.resolve(file)),keyFrom(settings.env.BACKUP_ENCRYPTION_KEY));verifySQL(snapshot);
   if(action==="decrypt"){
    if(!destination)throw Error("Specify a private recovery SQL output file inside backups.");
    const output=path.resolve(destination),relative=path.relative(path.join(root,"backups"),output);
    if(!relative||relative.startsWith("..")||path.isAbsolute(relative))throw Error("Recovery SQL output must stay inside the private backups directory.");
    fs.writeFileSync(output,snapshot.sql,{flag:"wx",mode:0o600});console.log("Verified recovery SQL saved inside backups; keep it private.");
   }else console.log("Encrypted backup authenticated; in-memory restore and integrity checks passed.");
   return;
  }
  if(!settings.env.TURSO_DATABASE_URL||!settings.env.TURSO_AUTH_TOKEN)throw Error("Configure TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in local .env first.");
  const {createClient}=require("@libsql/client/http");
  client=createClient({url:settings.env.TURSO_DATABASE_URL,authToken:settings.env.TURSO_AUTH_TOKEN,intMode:"bigint"});
  const snapshot=await exportSQL(client);verifySQL(snapshot);
  // Generate the key only after a successful read, and never print it.
  let keyValue=settings.env.BACKUP_ENCRYPTION_KEY;
  if(!keyValue){keyValue=crypto.randomBytes(32).toString("base64");const next=settings.text.replace(/^\s*BACKUP_ENCRYPTION_KEY\s*=.*$/gm,"");fs.writeFileSync(settings.filename,next.trimEnd()+"\nBACKUP_ENCRYPTION_KEY="+keyValue+"\n",{mode:0o600});}
  const encrypted=encrypt({...snapshot,createdAt:new Date().toISOString()},keyFrom(keyValue));
  verifySQL(decrypt(encrypted,keyFrom(keyValue)));
  const directory=path.join(root,"backups");fs.mkdirSync(directory,{recursive:true});
  const output=path.join(directory,"turso-before-migration-"+new Date().toISOString().replace(/[:.]/g,"-")+".sql.enc");
  fs.writeFileSync(output,encrypted,{flag:"wx",mode:0o600});verifySQL(decrypt(fs.readFileSync(output),keyFrom(keyValue)));
  console.log(JSON.stringify({file:output,tables:Object.keys(snapshot.counts).length,rows:Object.values(snapshot.counts).reduce((a,b)=>a+b,0),bytes:encrypted.length,verified:true,keyLocation:"Local .env (BACKUP_ENCRYPTION_KEY); value not displayed",remoteWrites:false}));
 }finally{client?.close();}
}
module.exports={exportSQL,verifySQL,encrypt,decrypt,literal};
if(require.main===module)main().catch(error=>{
 // Do not echo provider errors, URLs, SQL, rows, or credential-bearing objects.
 console.error(error.code==="SERVER_ERROR"||error.code==="HRANA_WEBSOCKET_ERROR"?"Turso request failed. Check database access and retry.":error.code?"Backup could not complete ("+String(error.code).replace(/[^A-Z0-9_]/gi,"")+"). No remote writes were performed.":"Backup could not complete. Check connectivity, database credentials, and the backup encryption key. No remote writes were performed.");process.exitCode=1;
});
