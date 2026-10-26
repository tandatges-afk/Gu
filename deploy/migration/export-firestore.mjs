/** Read-only Firestore migration snapshot: exports every requested collection by document ID.
 * Requires an existing authorized Firebase Admin service account.
 * CAUTION: contains PII and rental data; never upload outputs to GitHub.
 */
import {mkdir,writeFile,chmod} from 'node:fs/promises';
import {createWriteStream} from 'node:fs';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {once} from 'node:events';
import {initializeApp,cert,getApps} from 'firebase-admin/app';
import {getFirestore,FieldPath} from 'firebase-admin/firestore';
const id=process.env.FIREBASE_PROJECT_ID;
const email=process.env.FIREBASE_CLIENT_EMAIL;
const key=process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,'\n');
if(!id||!email||!key)throw Error('Missing FIREBASE_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY');
if(!getApps().length)initializeApp({credential:cert({projectId:id,clientEmail:email,privateKey:key})});
const db=getFirestore();
const collectionNames=['auditLogs','cameraSerialIndex','cashDaily','cashHistoryDaily','cashMovements','categories','customers','debtLedger','inspectionCleanup','inspectionEvidence','inventoryCounters','items','maintenanceState','mobileJobs','orders','phoneIndex','productNameIndex','proofUploads','rentalSlots','secureEvidenceUploads','shiftWeeks','skuIndex','staff','systemMigrations','v5DayIntervals'];
const target=resolve(process.argv[2]||'./private-backups/gu-firestore-export');
await mkdir(target,{recursive:true,mode:0o700});await chmod(target,0o700);
const manifest={project:id,at:new Date().toISOString(),collections:{}};
function jsonValue(v){
 if(v===null||v===undefined)return null;
 if(v instanceof Date)return v.toISOString();
 if(v&&typeof v==='object'&&typeof v.toDate==='function')return v.toDate().toISOString();
 if(Buffer.isBuffer(v))return {__bytes:v.toString('base64')};
 if(Array.isArray(v))return v.map(jsonValue);
 if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).map(([k,w])=>[k,jsonValue(w)]));
 return v;
}
for(const collection of collectionNames){
 const filename=join(target,collection+'.jsonl');const out=createWriteStream(filename,{mode:0o600});
 let cursor=null,count=0;const digest=createHash('sha256');
 try{
  while(true){
   let q=db.collection(collection).orderBy(FieldPath.documentId()).limit(250);
   if(cursor)q=q.startAfter(cursor);
   const snap=await q.get();
   for(const doc of snap.docs){
    const line=JSON.stringify({id:doc.id,data:jsonValue(doc.data())})+'\n';
    digest.update(line);if(!out.write(line))await once(out,'drain');count++;
   }
   if(snap.size<250)break;
   cursor=snap.docs.at(-1);
  }
 }finally{out.end();await once(out,'finish');}
 manifest.collections[collection]={count,sha256:digest.digest('hex')};
 console.log(collection+': '+count);
}
await writeFile(join(target,'manifest.json'),JSON.stringify(manifest,null,2),{mode:0o600});
console.log('Saved private backup to',target);
