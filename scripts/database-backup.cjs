"use strict";
const fs=require("node:fs"),path=require("node:path");
const {snapshot,encryptBackup,decryptBackup,restore}=require("../operations.cjs");
const app=require("../server.cjs");
(async()=>{
  const [action,filename,confirmation]=process.argv.slice(2);
  if(!["create","verify","restore"].includes(action))throw Error("Usage: node scripts/database-backup.cjs create|verify|restore [file] [--confirm-restore]");
  if(!process.env.BACKUP_ENCRYPTION_KEY)throw Error("Set BACKUP_ENCRYPTION_KEY before running this command.");
  if(action==="create"){
    await app.initialize();
    const directory=path.resolve(__dirname,"../backups");fs.mkdirSync(directory,{recursive:true});
    const output=path.join(directory,new Date().toISOString().replace(/[:.]/g,"-")+".bnkbackup");
    fs.writeFileSync(output,encryptBackup(await snapshot(app.database),process.env.BACKUP_ENCRYPTION_KEY),{flag:"wx",mode:0o600});
    console.log("Encrypted backup created: "+output);
  }else{
    if(!filename)throw Error("Specify an encrypted backup file.");
    const data=decryptBackup(fs.readFileSync(path.resolve(filename)),process.env.BACKUP_ENCRYPTION_KEY);
    if(action==="verify"){console.log("Backup authentication and format verified; no database was changed.");return;}
    if(confirmation!=="--confirm-restore")throw Error("Restore replaces database records. Run against a separate test database first, then supply --confirm-restore when ready.");
    await app.initialize();await restore(app.database,data);await app.contentStore.audit(null,"backup.restore","database");console.log("Database restored. All admin sessions were invalidated.");
  }
})().catch(error=>{console.error(error.message);process.exitCode=1}).finally(()=>app.closeDatabase());
