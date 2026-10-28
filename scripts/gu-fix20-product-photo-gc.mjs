/** Read-only orphan-photo inventory by default. Explicit --apply only on V5 stage/prod,
 * with --confirm-db and GU_ACK_PHOTO_GC=yes. Never scans sensitive evidence.
 */
import pg from 'pg';
import {readdir,stat,unlink} from 'node:fs/promises';
import {join,resolve} from 'node:path';
const args=process.argv.slice(2);const apply=args.includes('--apply');
const target=args.find(x=>x.startsWith('--confirm-db='))?.slice('--confirm-db='.length);
const u=new URL(process.env.DATABASE_URL||'');const name=decodeURIComponent(u.pathname.slice(1));
if(!['gu_v546_stage','gu_v546_prod'].includes(name)||!['127.0.0.1','localhost'].includes(u.hostname))throw Error('Only V5 stage/prod local PostgreSQL allowed');
if(apply&&(target!==name||process.env.GU_ACK_PHOTO_GC!=='yes'))throw Error('To delete: --apply --confirm-db='+name+' and GU_ACK_PHOTO_GC=yes after backup');
const base=resolve(process.env.GU_UPLOAD_DIR||'');
const expectedDir=name==='gu_v546_prod'?'/var/lib/gu-v546-prod/uploads':'/var/lib/gu-v546/uploads';
if(base!==expectedDir)throw Error(`GU_UPLOAD_DIR does not match ${name}; refusing to scan/delete another environment's photos`);
const root=join(base,'products');const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:1});
const used=new Set();const urlRx=/^\/api\/local-media\/products\/[A-Za-z0-9_-]{10,128}\/[a-f0-9-]{36}\.(jpg|png|webp)$/;
function addUrl(value){if(typeof value==='string'&&urlRx.test(value))used.add(value);}
function scan(v,depth=0){if(depth>5||!v)return;if(typeof v==='string')addUrl(v);else if(Array.isArray(v))for(const x of v)scan(x,depth+1);else if(typeof v==='object')for(const x of Object.values(v))scan(x,depth+1);}
try{
 const size=await pool.query("SELECT COUNT(*)::int AS count FROM gu_documents WHERE collection IN ('items','orders')");
 if(size.rows[0].count>100_000)throw Error('Too many records for safe photo scan');
 // Scan BOTH current products and immutable order photo snapshots.
 const rows=await pool.query("SELECT collection,data FROM gu_documents WHERE collection IN ('items','orders')");
 for(const row of rows.rows){const d=row.data||{};if(row.collection==='items'){scan(d.imagePaths);scan(d.referenceShots);scan(d.visualImagePath);scan(d.visualSignatures);}else scan(d.referencePhotos);}
 const cutoff=Date.now()-30*86400_000;let checked=0,orphan=0,removed=0,skipped=0;
 for(const uid of await readdir(root,{withFileTypes:true}).catch(e=>e.code==='ENOENT'?[]:Promise.reject(e))){
  if(!uid.isDirectory()||uid.isSymbolicLink()||!/^[A-Za-z0-9_-]{10,128}$/.test(uid.name))continue;
  for(const file of await readdir(join(root,uid.name),{withFileTypes:true})){
   if(!file.isFile()||file.isSymbolicLink()||!/^[-a-f0-9]{36}\.(?:jpg|png|webp)$/.test(file.name))continue;
   checked++;
   const url='/api/local-media/products/'+uid.name+'/'+file.name;
   if(used.has(url)){skipped++;continue;}
   const filename=join(root,uid.name,file.name),info=await stat(filename);
   if(info.mtimeMs>cutoff){skipped++;continue;}
   orphan++;
   if(apply&&removed<200){await unlink(filename);removed++;}
  }
 }
 console.log(JSON.stringify({database:name,mode:apply?'APPLY':'DRY_RUN',checked,orphanOlderThan30Days:orphan,deleted:removed,protectedOrRecent:skipped,guard:'No evidence deletion; maximum 200 files per execution'},null,2));
}catch(e){console.error('GU PHOTO GC:',e.message);process.exitCode=1;}finally{await pool.end();}
