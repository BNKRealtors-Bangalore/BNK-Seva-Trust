"use strict";
const fs=require("node:fs"),path=require("node:path");
// Test utility: preserve the original document-order view after extracting scripts.
function pageSource(filename){
 const html=fs.readFileSync(filename,"utf8");
 return html.replace(/<script\b[^>]*\bsrc="(\/assets\/[^"?#]+)"[^>]*><\/script>/g,(_,url)=>'<script>\n'+fs.readFileSync(path.join(__dirname,url.slice(1)),"utf8")+'\n</script>');
}
module.exports={pageSource};
