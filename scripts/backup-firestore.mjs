/** Private offline JSONL export. Costs reads; use --limit carefully on Spark.
 * Run: node --env-file=.env.local scripts/backup-firestore.mjs --limit=1000
 * Download ZIP via Codespaces only; never git add private backup files.
 */
import {mkdir,appendFile,writeFile,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {cert,initializeApp,getApps} from 'firebase-admin/app';
import {getFirestore,FieldPath} from 'firebase-admin/firestore';
const projectId=process.env.FIREBASE_PROJECT_ID,clientEmail=process.env.FIREBASE_CLIENT_EMAIL,privateKey=process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,'\n');
if(!projectId||!clientEmail||!privateKey)throw Error('Thiếu Firebase Admin credentials.');
if(!getApps().length)initializeApp({credential:cert({projectId,clientEmail,privateKey})});
const db=getFirestore();const limit=Math.min(4000,Math.max(1,Number(process.argv.find(a=>a.startsWith('--limit='))?.split('=')[1]||1000)));
const collections=['items','customers','orders','categories','staff','auditLogs','rentalSlots','skuIndex','phoneIndex','inventoryCounters','debtLedger','cashDaily'];
const dir='private-backups/gu-'+new Date().toISOString().slice(0,10);await mkdir(dir,{recursive:true});
for(const name of collections){
 const checkpoint=join(dir,name+'.cursor'),target=join(dir,name+'.jsonl');
 let cursor='';try{cursor=await readFile(checkpoint,'utf8');}catch{}
 if(cursor==='DONE')continue;
 let total=0;
 while(total<limit){
   let q=db.collection(name).orderBy(FieldPath.documentId()).limit(Math.min(100,limit-total));
   if(cursor)q=q.startAfter(cursor);
   const s=await q.get();
   if(!s.docs.length){await writeFile(checkpoint,'DONE');break;}
   const records=s.docs.map(d=>JSON.stringify({id:d.id,data:d.data()})).join('\n')+'\n';
   await appendFile(target,records,{mode:0o600});
   cursor=s.docs.at(-1).id;await writeFile(checkpoint,cursor,{mode:0o600});total+=s.size;
   if(s.size<Math.min(100,limit-total+s.size)){await writeFile(checkpoint,'DONE');break;}
 }
 console.log(name,total,'new rows;',cursor==='DONE'?'complete':'continue later');
}
console.log('Backup folder:',dir,'(contains private customer/employee records). Do not commit.');
