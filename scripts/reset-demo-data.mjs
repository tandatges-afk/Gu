/**
 * GU one-time DEMO DATA RESET. No HTTP endpoint: run privately from Codespaces.
 * - --plan: non-destructive counts and unknown collections
 * - --backup: complete JSONL snapshot, including staff (no destructive changes)
 * - --execute --backup-dir=<directory> --confirm=RESET-<projectId>:
 *      requires backup, verifies all top-level document ids still match, then clears business collections.
 * DOES NOT DELETE Firebase Auth users, Cloudinary images, staff profiles or daily quotas.
 */
import {cert, getApps, initializeApp} from 'firebase-admin/app';
import {getFirestore, FieldPath, Timestamp, GeoPoint, DocumentReference, Bytes} from 'firebase-admin/firestore';
import {mkdir, writeFile, readFile, stat} from 'node:fs/promises';
import {resolve, join} from 'node:path';
import {createHash} from 'node:crypto';

const args = process.argv.slice(2);
const mode = args.includes('--plan') ? 'plan' : args.includes('--backup') ? 'backup' : args.includes('--execute') ? 'execute' : null;
if (!mode || ['--plan','--backup','--execute'].filter(s=>args.includes(s)).length!==1) throw Error('Chọn đúng 1: --plan | --backup | --execute');
const arg = key => args.find(a=>a.startsWith(key+'='))?.slice(key.length+1);
const projectId=process.env.FIREBASE_PROJECT_ID;
const email=process.env.FIREBASE_CLIENT_EMAIL;
const key=process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,'\n');
if(!projectId||!email||!key)throw Error('Thiếu Firebase Admin trong .env.local.');
if(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID && process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!==projectId)throw Error('Firebase Client và Admin khác project.');
if(!getApps().length) initializeApp({credential:cert({projectId,clientEmail:email,privateKey:key})});
const db=getFirestore();
// Keep employee access intact. Every collection not in these two lists aborts the reset.
const PRESERVED = new Set(['staff']);
const CLEAR = new Set(['items','customers','orders','categories','auditLogs','rentalSlots','skuIndex','phoneIndex','inventoryCounters','debtLedger','cashDaily','cashHistoryDaily','inspectionCleanup','inspectionEvidence','mobileJobs','proofUploads','cameraSerialIndex','systemMigrations','v5DayIntervals']);
const MAX_DOCS=3000; // prevent accidentally resetting a mature production system

function serialize(value){
 if(value instanceof Timestamp)return {$guType:'Timestamp',seconds:value.seconds,nanoseconds:value.nanoseconds};
 if(value instanceof GeoPoint)return {$guType:'GeoPoint',latitude:value.latitude,longitude:value.longitude};
 if(value instanceof DocumentReference)return {$guType:'DocumentReference',path:value.path};
 if(value instanceof Bytes)return {$guType:'Bytes',base64:value.toBase64()};
 if(value instanceof Date)return {$guType:'Date',iso:value.toISOString()};
 if(Array.isArray(value))return value.map(serialize);
 if(value && typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,serialize(v)]));
 return value;
}
const sha = str => createHash('sha256').update(str).digest('hex');
async function snapshot(name){
 const rows=[];let cursor=null;
 while(true){
  let query=db.collection(name).orderBy(FieldPath.documentId()).limit(200);
  if(cursor)query=query.startAfter(cursor);
  const page=await query.get();
  for(const doc of page.docs){rows.push({id:doc.id,data:serialize(doc.data())});if(rows.length>MAX_DOCS)throw Error('Có trên '+MAX_DOCS+' bản ghi trong '+name+'. Không cho phép reset hàng loạt.');}
  if(page.empty||page.size<200)break;
  cursor=page.docs.at(-1).id;
 }
 return rows;
}
const current=(await db.listCollections()).map(c=>c.id).sort();
const unknown=current.filter(n=>!PRESERVED.has(n)&&!CLEAR.has(n));
if(unknown.length)throw Error('Có collection chưa được kiểm toán: '+unknown.join(', ')+'. Dừng reset để tránh sót dữ liệu.');
if(mode==='plan'){
 console.log('Dự án:', projectId, '| chế độ CHỈ XEM, không xóa');
 for(const name of current){const rows=await snapshot(name);console.log((PRESERVED.has(name)?'GIỮ':'XÓA').padEnd(5),name,rows.length,'bản ghi');}
 console.log('Không xóa tài khoản Firebase Auth, ảnh Cloudinary hoặc quota Firestore.');
 process.exit(0);
}
const backupBase=arg('--backup-dir');
// Never leave an unusable instance by retaining staff without any Admin.
const staffProfiles=await snapshot('staff');
if(!staffProfiles.some(p=>p.data?.role==='admin' && p.data?.disabled!==true)) throw Error('Không có tài khoản Admin đang hoạt động trong staff. Dừng reset để tránh khóa quản trị.');
if(mode==='backup'){
 const dir=resolve('private-backups','reset-'+projectId+'-'+new Date().toISOString().replace(/[:.]/g,'-'));
 await mkdir(dir,{recursive:true,mode:0o700});
 const manifest={schema:'GU-DEMO-BACKUP-v1',projectId,createdAt:new Date().toISOString(),collections:{}};
 try{
  for(const name of current){
   const rows=await snapshot(name);
   const content=rows.map(r=>JSON.stringify(r)).join('\n')+(rows.length?'\n':'');
   await writeFile(join(dir,name+'.jsonl'),content,{mode:0o600});
   manifest.collections[name]={count:rows.length,sha256:sha(content),ids:rows.map(r=>r.id),preserved:PRESERVED.has(name)};
   console.log('SAO LƯU',name,rows.length);
  }
  await writeFile(join(dir,'manifest.json'),JSON.stringify(manifest,null,2),{mode:0o600});
  console.log('\nBACKUP_OK:',dir,'\nKiểm tra/download thư mục này ra ngoài Codespaces trước khi reset. Không push lên GitHub.');
 }catch(e){console.error('SAO LƯU CHƯA HOÀN TẤT; TUYỆT ĐỐI KHÔNG EXECUTE',e);process.exitCode=1;}
 process.exit();
}
if(!backupBase)throw Error('Thiếu --backup-dir=<đường dẫn tới bản sao lưu vừa tạo>.');
if(arg('--confirm')!=='RESET-'+projectId)throw Error('Chưa có xác nhận đúng: --confirm=RESET-'+projectId);
const backupDir=resolve(backupBase);
const manPath=join(backupDir,'manifest.json');
await stat(manPath);
const m=JSON.parse(await readFile(manPath,'utf8'));
if(m.schema!=='GU-DEMO-BACKUP-v1'||m.projectId!==projectId)throw Error('Backup không trùng project / sai định dạng.');
if(JSON.stringify(Object.keys(m.collections).sort())!==JSON.stringify(current))throw Error('Collection khác thời điểm sao lưu, cần sao lưu lại.');
let deleteCount=0;
for(const name of current){
 const file=await readFile(join(backupDir,name+'.jsonl'),'utf8');
 if(sha(file)!==m.collections[name].sha256)throw Error('Backup bị chỉnh sửa/hỏng: '+name);
 const docs=await snapshot(name);const currentIds=docs.map(d=>d.id);
 if(JSON.stringify(currentIds)!==JSON.stringify(m.collections[name].ids))throw Error('Có thêm/xóa bản ghi trong '+name+' sau khi sao lưu. Hãy sao lưu lại trước.');
 if(!PRESERVED.has(name))deleteCount+=docs.length;
}
if(deleteCount>MAX_DOCS)throw Error('Số lượng bản ghi quá giới hạn an toàn.');
console.log('Đã xác thực bản sao lưu. Sắp xóa',deleteCount,'tài liệu kinh doanh, giữ nguyên staff.');
// Disable writes and new orders in deployment before invoking: multi-collection delete is NOT atomic.
for(const name of current){
 if(PRESERVED.has(name))continue;
 const rows=await snapshot(name);
 if(rows.length){await db.recursiveDelete(db.collection(name));}
 console.log('ĐÃ DỌN',name,rows.length);
}
const after=await Promise.all([...CLEAR].map(async name=>(await db.collection(name).limit(1).get()).empty));
if(after.some(x=>!x))throw Error('Còn bản ghi, kiểm tra lại danh sách collection.');
console.log('RESET_COMPLETE: Firestore business data cleared; staff/Auth/Cloudinary unchanged.');
