/** Verify named lucide-react imports against the installed version.
 * Run after npm install. Unlike local import checks, this catches missing package exports.
 */
import {readFileSync,readdirSync} from 'node:fs';
import {join,relative} from 'node:path';

const base=process.cwd();
function* filesUnder(dir){
 for(const item of readdirSync(dir,{withFileTypes:true})){
  const path=join(dir,item.name);
  if(item.isDirectory())yield* filesUnder(path);
  else if(item.isFile()&&/\.[cm]?[jt]sx?$/.test(path))yield path;
 }
}
let icons;
try{icons=await import('lucide-react');}
catch(error){console.error('Không thể nạp lucide-react. Hãy chạy npm install trước.');throw error;}
let inspected=0;
const missing=[];
for(const file of filesUnder(join(base,'src'))){
 const source=readFileSync(file,'utf8');
 for(const match of source.matchAll(/\bimport\s*\{([^}]+)\}\s*from\s*['"]lucide-react['"]/gs)){
  for(const item of match[1].split(',')){
   const imported=item.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0].trim();
   if(!imported)continue;
   inspected++;
   if(!(imported in icons))missing.push(`${relative(base,file)}: ${imported}`);
  }
 }
}
if(missing.length){
 console.error('GU LUCIDE ICON CHECK FAILED: lucide-react không xuất các icon sau:');
 for(const s of missing)console.error(' - '+s);
 process.exitCode=1;
}else console.log(`GU LUCIDE ICON CHECK OK: ${inspected} named imports found in installed lucide-react.`);
