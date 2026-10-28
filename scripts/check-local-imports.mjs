/**
 * Verify every local TS/JS import resolves to a file in this checkout.
 * No npm install is needed: run `node scripts/check-local-imports.mjs`.
 * This is intentionally a fast source-presence check, not a replacement
 * for `npm run typecheck` / `npm run build`.
 */
import {existsSync, readdirSync, readFileSync, statSync} from 'node:fs';
import {extname, join, resolve} from 'node:path';

const root=process.cwd();
const fileExtensions=['.ts','.tsx','.js','.jsx','.mjs','.cjs','.json','.css','.scss','.svg','.png','.webp','.jpg','.jpeg'];
const sourceExtensions=new Set(['.ts','.tsx','.js','.jsx','.mjs','.cjs']);
const sourceDirs=['src','tests','scripts'];
const missing=[];
let scanned=0;
let localRefs=0;

function filesUnder(dir){
 if(!existsSync(dir))return [];
 const found=[];
 for(const item of readdirSync(dir,{withFileTypes:true})){
  if(['node_modules','.next','.git'].includes(item.name))continue;
  const path=join(dir,item.name);
  if(item.isDirectory())found.push(...filesUnder(path));
  else if(item.isFile()&&sourceExtensions.has(extname(item.name)))found.push(path);
 }
 return found;
}
function resolvesLocal(from,spec){
 if(!spec.startsWith('.')&&!spec.startsWith('@/'))return true;
 const base=spec.startsWith('@/')?resolve(root,'src',spec.slice(2)):resolve(from,'..',spec);
 const candidates=[base,...fileExtensions.map(x=>base+x),...fileExtensions.map(x=>join(base,'index'+x))];
 return candidates.some(p=>existsSync(p)&&statSync(p).isFile());
}
for(const dir of sourceDirs)for(const file of filesUnder(join(root,dir))){
 scanned++;
 const code=readFileSync(file,'utf8');
 const specs=new Set();
 // ES static `from` imports and bare side-effect imports.
 for(const match of code.matchAll(/\b(?:from\s*|import\s+)(['"])([^'"\n]+)\1/g))specs.add(match[2]);
 // Dynamic imports including references used inside type annotations.
 for(const match of code.matchAll(/\b(?:import|require)\s*\(\s*(['"])([^'"\n]+)\1/g))specs.add(match[2]);
 for(const spec of specs){
  if(!spec.startsWith('.')&&!spec.startsWith('@/'))continue;
  localRefs++;
  if(!resolvesLocal(file,spec))missing.push(`${file.slice(root.length+1)} -> ${spec}`);
 }
}
if(missing.length){
 console.error('GU IMPORT CHECK FAILED: file nguồn đang thiếu hoặc tên không khớp chữ hoa/thường.');
 for(const path of missing)console.error('  MISSING:',path);
 console.error('Hãy giải nén đầy đủ ZIP Fix20 vào worktree mới, không trộn với source cũ.');
 process.exitCode=1;
}else{
 console.log(`GU IMPORT CHECK OK: ${localRefs} local imports resolved across ${scanned} source files.`);
 console.log('Kiểm tra này không thay thế TypeScript typecheck hoặc Next.js build.');
}
