"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { AsyncLocalStorage } = require("node:async_hooks");

function createDatabase({ root, env = process.env, clientFactory } = {}) {
  let client;
  const context = new AsyncLocalStorage();
  function connect() {
    if (client) return client;
    let url = env.TURSO_DATABASE_URL;
    if (env.VERCEL && (!url || !env.TURSO_AUTH_TOKEN)) {
      const error = new Error("Configure TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in Vercel, then redeploy.");
      error.statusCode = 503;
      throw error;
    }
    if (url && !/^(libsql|https):\/\//.test(url)) throw new Error("TURSO_DATABASE_URL must be a libsql:// or https:// URL.");
    if (!url) {
      const filename = path.resolve(root, env.DATABASE_PATH || "./data/donations.sqlite");
      fs.mkdirSync(path.dirname(filename), { recursive: true });
      client = createLocalClient(filename);
      return client;
    }
    const factory = clientFactory || require("@libsql/client/http").createClient;
    client = factory({ url, authToken: env.TURSO_AUTH_TOKEN });
    return client;
  }
  return {
    async exec(sql) { await connect().executeMultiple(sql); },
    prepare(sql) {
      const execute = args => (context.getStore() || connect()).execute({ sql, args });
      return {
        async get(...args) { return (await execute(args)).rows[0]; },
        async all(...args) { return (await execute(args)).rows; },
        async run(...args) { return execute(args); }
      };
    },
    async transaction(callback) {
      if (context.getStore()) return callback();
      const transaction = await connect().transaction("write");
      try {
        const result = await context.run(transaction, callback);
        await transaction.commit();
        return result;
      } catch (error) {
        if (!transaction.closed) await transaction.rollback();
        throw error;
      } finally {
        transaction.close();
      }
    },
    close() { if (client) client.close(); }
  };
}

// Serialize local writes while an asynchronous request owns a SQLite transaction.
function createLocalClient(filename) {
  const { DatabaseSync } = require("node:sqlite");
  const sqlite = new DatabaseSync(filename);
  let tail = Promise.resolve();
  const acquire = async () => {
    const previous = tail;
    let release;
    tail = new Promise(resolve => { release = resolve; });
    await previous;
    return release;
  };
  function execute({ sql, args = [] }) {
    const statement = sqlite.prepare(sql);
    if (statement.columns().length) return { rows: statement.all(...args) };
    return { rows: [], ...statement.run(...args) };
  }
  return {
    async execute(statement) {
      const release = await acquire();
      try { return execute(statement); } finally { release(); }
    },
    async executeMultiple(sql) {
      const release = await acquire();
      try { sqlite.exec(sql); } finally { release(); }
    },
    async transaction() {
      const release = await acquire();
      try { sqlite.exec("BEGIN IMMEDIATE"); } catch (error) { release(); throw error; }
      let closed = false;
      function finish(sql) {
        if (closed) return;
        sqlite.exec(sql);
        closed = true;
        release();
      }
      return {
        get closed() { return closed; },
        async execute(statement) { return execute(statement); },
        async commit() { finish("COMMIT"); },
        async rollback() { finish("ROLLBACK"); },
        close() { finish("ROLLBACK"); }
      };
    },
    close() { sqlite.close(); }
  };
}

module.exports = { createDatabase };
