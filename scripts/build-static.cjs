"use strict";

const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const output = path.join(root, "public");
fs.mkdirSync(output, { recursive: true });
for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
  if (entry.isFile() && /\.(html|css)$/.test(entry.name)) {
    fs.copyFileSync(path.join(root, entry.name), path.join(output, entry.name));
  }
}
fs.copyFileSync(path.join(root, "donation.js"), path.join(output, "donation.js"));
for (const directory of ["images", "audio", "payment", "stories"]) {
  fs.cpSync(path.join(root, directory), path.join(output, directory), { recursive: true });
}
console.log("Prepared public website assets; backend files, environment files, and databases are excluded.");
