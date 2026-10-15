"use strict";

const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const output = path.join(root, "public");
if(path.relative(root,output)!=="public")throw new Error("Unexpected build output directory.");
if(fs.existsSync(output)){if(fs.lstatSync(output).isSymbolicLink())throw new Error("Build output cannot be a symlink.");fs.rmSync(output,{recursive:true,force:true});}
fs.mkdirSync(output, { recursive: true });
for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
  if (entry.isFile() && /\.(html|css)$/.test(entry.name)) {
    fs.copyFileSync(path.join(root, entry.name), path.join(output, entry.name));
  }
}
for(const filename of ["donation.js","purchase.js"]) fs.copyFileSync(path.join(root,filename),path.join(output,filename));
for (const directory of ["images", "audio", "payment", "stories"]) {
  fs.cpSync(path.join(root, directory), path.join(output, directory), {recursive:true,filter:source=>{const entry=fs.statSync(source);return entry.isDirectory()||(/\.(?:html|png|jpe?g|svg|webp|gif|ico|avif|mp3|mp4|webm|woff2?|pdf)$/i.test(source)&&!path.basename(source).startsWith("."));}});
}
console.log("Prepared public website assets; backend files, environment files, and databases are excluded.");
