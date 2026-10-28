/** Dependency-free sha256 check for the complete reviewed Fix20 Rev7 archive.
 * Only hashes source files; never reads or reports .env, database, uploads or secrets.
 * Usage: node scripts/gu-fix20-package-check.mjs [source-directory]
 */
import {readFileSync,existsSync} from 'node:fs';
import {resolve,join,sep} from 'node:path';
import {createHash} from 'node:crypto';
const root=resolve(process.argv[2]||'.');
const manifest=join(root,'REV6-FILE-SHA256.json');
if(!existsSync(manifest)){console.error('GU FIX20 REV7 FILE CHECK: Missing hash manifest. Extract the complete ZIP.');process.exit(2);}
const hashes=JSON.parse(readFileSync(manifest,'utf8'));
if(hashes.schema!==1||hashes.release!=='5.4.6-fix20.0-rev7'||!hashes.files||typeof hashes.files!=='object'||Array.isArray(hashes.files)){
 console.error('GU FIX20 REV7 FILE CHECK: Invalid release manifest.');process.exit(2);
}
const entries=Object.entries(hashes.files);
if(entries.length<300){console.error('GU FIX20 REV7 FILE CHECK: Incomplete manifest.');process.exit(2);}
const errors=[];
for(const [p,expected] of entries){
 if(typeof p!=='string'||p.includes('\\')||p.startsWith('/')||p.split('/').some(x=>!x||x==='.'||x==='..')||typeof expected!=='string'||!/^[a-f0-9]{64}$/.test(expected)){
  errors.push('Bad manifest entry '+p);continue;
 }
 const file=resolve(root,p);
 if(!file.startsWith(root+sep)||!existsSync(file)){errors.push('Missing '+p);continue;}
 const actual=createHash('sha256').update(readFileSync(file)).digest('hex');
 if(actual!==expected)errors.push('Different content '+p);
}
if(errors.length){console.error('GU FIX20 REV7 FILE CHECK FAILED: '+errors.length+' mismatches');for(const err of errors.slice(0,30))console.error('  '+err);process.exit(1);}
console.log('GU FIX20 REV7 FILE CHECK OK: '+entries.length+' source and release files match SHA-256 manifest.');
