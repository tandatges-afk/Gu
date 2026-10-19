/** Safe, explicit migration: staff_mobile -> staff. Never touches Admin or Auth users. */
import {cert,initializeApp,getApps} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
const projectId=process.env.FIREBASE_PROJECT_ID;
const clientEmail=process.env.FIREBASE_CLIENT_EMAIL;
const privateKey=process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,'\n');
if(!projectId||!clientEmail||!privateKey)throw Error('Thiếu FIREBASE_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY trong .env.local.');
if(!getApps().length)initializeApp({credential:cert({projectId,clientEmail,privateKey})});
const db=getFirestore();const execute=process.argv.includes('--execute');
const confirmation=process.argv.find(a=>a.startsWith('--confirm='))?.slice('--confirm='.length);
if(execute&&confirmation!==`UNIFY-${projectId}`)throw Error('Xác nhận --confirm=UNIFY-'+projectId);
const docs=await db.collection('staff').where('role','==','staff_mobile').get();
console.log('PROJECT:',projectId,'LEGACY STAFF MOBILE:',docs.size,'MODE:',execute?'APPLY':'PLAN');
if(!execute){console.log('PLAN ONLY: không thay đổi gì.');process.exit(0);}
for(const doc of docs.docs){
 await db.runTransaction(async tx=>{const snap=await tx.get(doc.ref);if(snap.exists&&snap.get('role')==='staff_mobile')tx.update(doc.ref,{role:'staff',roleUnifiedAt:new Date().toISOString()});});
}
console.log('UNIFY_OK, số hồ sơ xem xét:',docs.size);
