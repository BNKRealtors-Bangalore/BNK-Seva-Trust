"use strict";
const fs=require("node:fs"),path=require("node:path");
const pages=["index.html","admin.html"];
for(const page of pages){
 const name=path.basename(page,".html"),folder="assets/"+name;fs.mkdirSync(folder,{recursive:true});
 let script=0,style=0,text=fs.readFileSync(page,"utf8");
 text=text.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi,(tag,attributes,code)=>{
  if(/\bsrc=/.test(attributes)||/\btype\s*=\s*["'](?:application|text)\//.test(attributes)||!code.trim())return tag;
  const filename=folder+"/script-"+String(++script).padStart(2,"0")+".js";
  fs.writeFileSync(filename,code.trim()+"\n");return '<script'+attributes+' src="/'+filename+'"></script>';
 });
 text=text.replace(/<style\b([^>]*)>([\s\S]*?)<\/style>/gi,(tag,attributes,css)=>{
  const filename=folder+"/style-"+String(++style).padStart(2,"0")+".css";
  // Paths in the original root-page stylesheets were relative to the page.
  css=css.replace(/url\(\s*(["']?)(images\/[^)'"\s]+)\1\s*\)/g,(_,q,url)=>'url("/'+url+'")');
  fs.writeFileSync(filename,css.trim()+"\n");return '<link rel="stylesheet" href="/'+filename+'"'+attributes+'>';
 });
 fs.writeFileSync(page,text);console.log(page+": extracted "+script+" scripts and "+style+" stylesheets.");
}
