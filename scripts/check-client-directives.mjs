/**
 * Validate React/Next client-module directives without installing node modules.
 * Prevents imports added by automated refactors from being placed before `use client`.
 */
import {readFileSync,readdirSync} from 'node:fs';
import {join,extname,relative} from 'node:path';

const root=process.cwd();
const sourceRoot=join(root,'src');
const failures=[];
let scanned=0,clientModules=0;
function* visit(dir){
 for(const entry of readdirSync(dir,{withFileTypes:true})){
  const path=join(dir,entry.name);
  if(entry.isDirectory())yield* visit(path);
  else if(entry.isFile()&&['.ts','.tsx','.js','.jsx','.mjs'].includes(extname(path)))yield path;
 }
}
for(const path of visit(sourceRoot)){
 scanned++;
 const source=readFileSync(path,'utf8');
 if(!/["']use client["']\s*;?/.test(source))continue;
 clientModules++;
 // Comments, whitespace and BOM are allowed before directives; imports are not.
 let top=source.replace(/^\uFEFF/,'');
 for(;;){
  const before=top;
  top=top.replace(/^\s+/,'').replace(/^\/\/[^\n]*(?:\n|$)/,'').replace(/^\/\*[\s\S]*?\*\//,'');
  if(before===top)break;
 }
 if(!/^(?:'use client'|"use client")\s*;/.test(top))failures.push(relative(root,path));
}
if(failures.length){
 console.error('GU CLIENT DIRECTIVE CHECK FAILED: place `\'use client\';` before every import:');
 failures.forEach(file=>console.error(' - '+file));
 process.exitCode=1;
}else console.log(`GU CLIENT DIRECTIVE CHECK OK: ${clientModules} client modules checked across ${scanned} source files.`);
