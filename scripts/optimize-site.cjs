"use strict";
// Repeatable loss-controlled image optimization; original artwork is retained.
const fs=require("node:fs"),path=require("node:path"),sharp=require("sharp");
const root=path.resolve(__dirname,".."),images=path.join(root,"images"),output=path.join(images,"optimized");
const walk=directory=>fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()&&entry.name!=="optimized"?walk(path.join(directory,entry.name)):entry.isFile()?[path.join(directory,entry.name)]:[]);
(async()=>{
 fs.mkdirSync(output,{recursive:true});const mappings=[];
 for(const filename of walk(images)){
  if(!/\.(png|jpe?g)$/i.test(filename)||fs.statSync(filename).size<120000||/logo|favicon|scanner/i.test(path.basename(filename)))continue;
  const relative=path.relative(images,filename).replace(/\\/g,"/"),base=relative.replace(/\.[^.]+$/,"").replace(/\//g,"-");
  const metadata=await sharp(filename).metadata();
  const variants=[];
  for(const width of [...new Set([480,960,1600].map(w=>Math.min(w,metadata.width)))]){
   const target=path.join(output,base+"-"+width+".webp");
   if(!fs.existsSync(target)||fs.statSync(target).mtimeMs<fs.statSync(filename).mtimeMs)await sharp(filename).rotate().resize({width,withoutEnlargement:true}).webp({quality:78,effort:5}).toFile(target);
   variants.push({width,path:"images/optimized/"+path.basename(target)});
  }
  const largest=variants.at(-1),info=await sharp(path.join(root,largest.path)).metadata();
  mappings.push({original:"images/"+relative,path:largest.path,width:info.width,height:info.height,variants,originalBytes:fs.statSync(filename).size,optimizedBytes:fs.statSync(path.join(root,largest.path)).size});
 }
 const pages=[...fs.readdirSync(root).filter(p=>/\.(html|css|js|cjs)$/.test(p)&&!p.endsWith(".test.cjs")),...fs.readdirSync(path.join(root,"stories")).filter(p=>p.endsWith(".html")).map(p=>"stories/"+p),...walk(path.join(root,"assets")).filter(p=>/\.(js|css)$/.test(p)).map(p=>path.relative(root,p))];
 for(const filename of pages){
  const full=path.join(root,filename);let text=fs.readFileSync(full,"utf8");
  for(const mapping of mappings)text=text.split(mapping.original).join(mapping.path);
  if(filename.endsWith(".html")){
   let index=0;
   text=text.replace(/<img\b[^>]*>/gi,tag=>{
    const eager=index++<3||/fetchpriority=["']high/.test(tag);
    if(!/\bdecoding=/.test(tag))tag=tag.replace(/\s*\/?>$/,end=>' decoding="async"'+end);
    if(!eager&&!/\bloading=/.test(tag))tag=tag.replace(/\s*\/?>$/,end=>' loading="lazy"'+end);
    const source=tag.match(/\bsrc=["']([^"']+)["']/)?.[1];
    const mapping=mappings.find(m=>source?.endsWith(m.path));
    if(mapping&&!/\bsrcset=/.test(tag)){
     const prefix=source.slice(0,-mapping.path.length);
     const srcset=mapping.variants.map(v=>prefix+v.path+" "+v.width+"w").join(", ");
     tag=tag.replace(/\s*\/?>$/,end=>' srcset="'+srcset+'" sizes="(max-width: 600px) 100vw, (max-width: 1000px) 70vw, 960px"'+(!/\bwidth=/.test(tag)?' width="'+mapping.width+'" height="'+mapping.height+'"':'')+end);
    }
    return tag;
   });
  }
  fs.writeFileSync(full,text);
 }
 fs.writeFileSync(path.join(images,"optimization-manifest.json"),JSON.stringify(mappings,null,2));
 console.log("Optimized "+mappings.length+" images: "+Math.round(mappings.reduce((n,m)=>n+m.originalBytes,0)/1048576)+" MB -> "+Math.round(mappings.reduce((n,m)=>n+m.optimizedBytes,0)/1048576)+" MB (largest variants). Originals retained.");
})().catch(error=>{console.error(error.message);process.exitCode=1});
