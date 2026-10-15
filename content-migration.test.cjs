"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path"),crypto=require("node:crypto"),vm=require("node:vm");
const {createDatabase}=require("./database.cjs"),{createContentStore}=require("./content-store.cjs");
test("legacy migration retains every record, keeps its recovery source, and runs once",async()=>{
 const filename=path.join(os.tmpdir(),"bnk-migration-"+crypto.randomUUID()+".sqlite"),database=createDatabase({root:__dirname,env:{DATABASE_PATH:filename}});
 try{
  await database.exec("CREATE TABLE app_config(key TEXT PRIMARY KEY,value TEXT,updated_at TEXT)");
  const legacy={records:{donations:Array.from({length:240},(_,i)=>({id:"legacy_"+i,name:"Donor "+i,reference:"REF-"+i})),store:[]},goal:501};
  await database.prepare("INSERT INTO app_config VALUES('site_content',?,'today')").run(JSON.stringify(legacy));
  const store=createContentStore({database,sanitize:input=>input,defaults:{records:{donations:[],store:[]}}});
  await store.initialize();assert.equal((await store.get()).records.donations.length,240);
  assert.equal((await database.prepare("SELECT value FROM app_config WHERE key='site_content'").get()).value,JSON.stringify(legacy));
  await database.transaction(()=>store.append("donations",{id:"new",reference:"NEW-REFERENCE"}));await store.initialize();assert.equal((await store.get()).records.donations.length,241);
 }finally{database.close();for(const suffix of ["","-wal","-shm"])fs.rmSync(filename+suffix,{force:true});}
});
test("CSV exports neutralize formulas, including whitespace-prefixed payloads",()=>{
 const source=require("./page-source.cjs").pageSource("admin.html"),start=source.indexOf("function csvSafeCell("),end=source.indexOf("function exportCsv(",start);
 const context=vm.createContext({});vm.runInContext(source.slice(start,end),context);
 for(const value of ["=1+1","+SUM(A1:A2)","@SUM(A1)","-2+4","  =1+1","\t=1+1","\rtest"]){assert.ok(context.csvSafeCell(value).startsWith("'"));}
 assert.equal(context.csvSafeCell("Normal donor"),"Normal donor");
});
