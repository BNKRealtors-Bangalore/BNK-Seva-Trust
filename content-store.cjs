"use strict";
const crypto = require("node:crypto");
const contentSchema = `
CREATE TABLE IF NOT EXISTS site_records(collection TEXT NOT NULL,id TEXT NOT NULL,data TEXT NOT NULL,position INTEGER NOT NULL,PRIMARY KEY(collection,id));
CREATE INDEX IF NOT EXISTS site_records_order ON site_records(collection,position);
CREATE TABLE IF NOT EXISTS site_content_meta(id INTEGER PRIMARY KEY CHECK(id=1),version INTEGER NOT NULL,metadata TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS donation_references(reference TEXT PRIMARY KEY,record_id TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS admin_audit(id TEXT PRIMARY KEY,actor_id TEXT NOT NULL,action TEXT NOT NULL,target TEXT NOT NULL,created_at TEXT NOT NULL);
`;
function conflict(message="Records changed since you loaded this page. Reload the latest records before saving.") {
  const error=new Error(message);error.statusCode=409;throw error;
}
function createContentStore({database,sanitize,defaults}) {
  const collections=Object.keys(defaults.records);
  const reference=r=>String(r.reference||"").replace(/\s/g,"").toUpperCase();
  async function audit(actor,action,target) {
    await database.prepare("INSERT INTO admin_audit VALUES(?,?,?,?,?)").run(crypto.randomUUID(),actor?.id||"system",action,target,new Date().toISOString());
  }
  async function initialize() {
    await database.exec(contentSchema);
    await database.transaction(async()=>{
      if(await database.prepare("SELECT id FROM site_content_meta WHERE id=1").get())return;
      const legacy=await database.prepare("SELECT value FROM app_config WHERE key='site_content'").get();
      // Keep the legacy JSON intact as a migration recovery source.
      const content=sanitize(legacy?JSON.parse(legacy.value):defaults);
      const {records,...metadata}=content;
      await database.prepare("INSERT INTO site_content_meta VALUES(1,0,?)").run(JSON.stringify(metadata));
      for(const collection of collections)for(const [position,row]of records[collection].entries()) {
        await database.prepare("INSERT INTO site_records VALUES(?,?,?,?)").run(collection,row.id,JSON.stringify(row),position);
        if(collection==="donations"&&reference(row))await database.prepare("INSERT OR IGNORE INTO donation_references VALUES(?,?)").run(reference(row),row.id);
      }
    });
  }
  async function get() {
    // A read transaction gives a consistent version + record snapshot.
    return database.transaction(async()=>{
      const meta=await database.prepare("SELECT * FROM site_content_meta WHERE id=1").get();
      const rows=await database.prepare("SELECT collection,data FROM site_records ORDER BY position,id").all();
      const records=Object.fromEntries(collections.map(key=>[key,[]]));
      for(const row of rows)records[row.collection]?.push(JSON.parse(row.data));
      return {...JSON.parse(meta.metadata),records,_version:Number(meta.version)};
    });
  }
  async function claimReference(collection,row) {
    if(collection!=="donations"||!reference(row))return;
    const claimed=await database.prepare("SELECT record_id FROM donation_references WHERE reference=?").get(reference(row));
    if(claimed&&claimed.record_id!==row.id)conflict("This UPI transaction reference has already been submitted.");
    await database.prepare("INSERT OR IGNORE INTO donation_references VALUES(?,?)").run(reference(row),row.id);
  }
  async function save(input,{expectedVersion,actor}={}) {
    return database.transaction(async()=>{
      const current=await get();
      if(expectedVersion!==undefined&&expectedVersion!==current._version)conflict();
      const clean=sanitize(input),{records,...metadata}=clean;
      for(const key of collections) {
        const ids=new Set();
        for(const [position,row]of records[key].entries()) {
          if(ids.has(row.id))conflict("Duplicate record IDs are not allowed.");ids.add(row.id);
          await claimReference(key,row);
          await database.prepare("INSERT INTO site_records VALUES(?,?,?,?) ON CONFLICT(collection,id) DO UPDATE SET data=excluded.data,position=excluded.position").run(key,row.id,JSON.stringify(row),position);
        }
        for(const row of current.records[key])if(!ids.has(row.id))await database.prepare("DELETE FROM site_records WHERE collection=? AND id=?").run(key,row.id);
      }
      await database.prepare("UPDATE site_content_meta SET version=version+1,metadata=? WHERE id=1").run(JSON.stringify(metadata));
      await audit(actor,"content.save","site-content");
      return get();
    });
  }
  async function append(collection,row) {
    await claimReference(collection,row);
    const position=(await database.prepare("SELECT COALESCE(MIN(position),0)-1 AS position FROM site_records WHERE collection=?").get(collection)).position;
    await database.prepare("INSERT INTO site_records VALUES(?,?,?,?)").run(collection,row.id,JSON.stringify(row),position);
    await database.prepare("UPDATE site_content_meta SET version=version+1 WHERE id=1").run();
  }
  async function patch(collection,id,input,actor) {
    if(!collections.includes(collection)||collection==="users")throw Object.assign(Error("Unknown record collection."),{statusCode:404});
    return database.transaction(async()=>{
      const current=await get();
      if(!Number.isInteger(input.version)||input.version!==current._version)conflict();
      const old=current.records[collection].find(row=>row.id===id);
      if(input.remove) {
        if(!old)throw Object.assign(Error("Record not found."),{statusCode:404});
        await database.prepare("DELETE FROM site_records WHERE collection=? AND id=?").run(collection,id);
      }else {
        const row=sanitize({records:{[collection]:[{...input.record,id}]}}).records[collection][0];
        await claimReference(collection,row);
        const position=old?(await database.prepare("SELECT position FROM site_records WHERE collection=? AND id=?").get(collection,id)).position:Date.now();
        await database.prepare("INSERT INTO site_records VALUES(?,?,?,?) ON CONFLICT(collection,id) DO UPDATE SET data=excluded.data").run(collection,id,JSON.stringify(row),position);
      }
      await database.prepare("UPDATE site_content_meta SET version=version+1 WHERE id=1").run();
      await audit(actor,input.remove?"record.delete":"record.save",collection+"/"+id);
      return {content:await get(),previous:old};
    });
  }
  async function list(collection,{offset=0,limit=50}={}) {
    if(!collections.includes(collection))throw Object.assign(Error("Unknown record collection."),{statusCode:404});
    const rows=await database.prepare("SELECT data FROM site_records WHERE collection=? ORDER BY position,id LIMIT ? OFFSET ?").all(collection,limit,offset);
    const total=(await database.prepare("SELECT COUNT(*) AS count FROM site_records WHERE collection=?").get(collection)).count;
    return {records:rows.map(row=>JSON.parse(row.data)),total:Number(total),offset,limit};
  }
  return{initialize,get,save,append,patch,list,audit};
}
module.exports={contentSchema,createContentStore};
