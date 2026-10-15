"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { createDatabase } = require("./database.cjs");

test("Vercel requires persistent database credentials and never falls back to a file", async () => {
  const db = createDatabase({root: __dirname, env: {VERCEL: "1"}});
  await assert.rejects(db.exec("SELECT 1"), error => error.statusCode === 503 && /TURSO_DATABASE_URL/.test(error.message));
  db.close();
});

test("remote queries use their own transaction connection and roll back failures", async () => {
  const calls = [];
  const transaction = {closed:false, execute: async statement => {calls.push(['tx', statement.sql]);return {rows:[{value:7}]};}, commit:async()=>{calls.push(['commit']);},rollback:async()=>{calls.push(['rollback']);},close:()=>{calls.push(['close']);}};
  const db=createDatabase({root:__dirname,env:{VERCEL:'1',TURSO_DATABASE_URL:'libsql://test.turso.io',TURSO_AUTH_TOKEN:'test-token'},clientFactory:options=>{assert.equal(options.url,'libsql://test.turso.io');return {execute:async statement=>{calls.push(['direct',statement.sql]);return {rows:[{value:3}]};},transaction:async mode=>{assert.equal(mode,'write');return transaction;},close(){}};}});
  await db.transaction(async()=>assert.equal((await db.prepare('SELECT 7').get()).value,7));
  assert.deepEqual(calls.map(x=>x[0]),['tx','commit','close']);
  calls.length=0;
  await assert.rejects(db.transaction(async()=>{throw Error('abort');}),/abort/);
  assert.deepEqual(calls.map(x=>x[0]),['rollback','close']);
  assert.equal((await db.prepare('SELECT 3').get()).value,3);
  db.close();
});

test("local writes persist across reconnects and failed transactions roll back", async () => {
  const filename=path.join(os.tmpdir(),'bnk-adapter-'+crypto.randomUUID()+'.sqlite');
  const env={DATABASE_PATH:filename};let db=createDatabase({root:__dirname,env});
  try {
    await db.exec('CREATE TABLE records (value TEXT NOT NULL)');
    await db.prepare('INSERT INTO records VALUES (?)').run('saved');
    await assert.rejects(db.transaction(async()=>{await db.prepare('INSERT INTO records VALUES (?)').run('rollback');throw Error('abort');}),/abort/);
    await Promise.all([db.transaction(async()=>{await new Promise(resolve=>setTimeout(resolve,10));await db.prepare('INSERT INTO records VALUES (?)').run('first');}),db.prepare('INSERT INTO records VALUES (?)').run('second')]);
    db.close();db=createDatabase({root:__dirname,env});
    assert.deepEqual((await db.prepare('SELECT value FROM records').all()).map(row=>row.value),['saved','first','second']);
  } finally {db.close();for(const suffix of ['', '-shm', '-wal'])fs.rmSync(filename+suffix,{force:true});}
});
