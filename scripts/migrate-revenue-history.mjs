/** Safely migrate old order PAY events to historical daily counters.
 * Set cutoff to exact GU v4.2 Production activation time (UTC):
 * node --env-file=.env.local scripts/migrate-revenue-history.mjs --cutoff=2026-10-16T10:00:00.000Z --max=2000
 * NO guessed cutoff: inaccurate cutoff can double-count or omit receipts.
 * May be run multiple times; checkpoint+increments use one Firestore transaction.
 */
import {cert,initializeApp,getApps} from 'firebase-admin/app';
import {getFirestore,FieldPath,FieldValue} from 'firebase-admin/firestore';
const projectId=process.env.FIREBASE_PROJECT_ID,clientEmail=process.env.FIREBASE_CLIENT_EMAIL,privateKey=process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,'\n');
if(!projectId||!clientEmail||!privateKey)throw Error('Thiếu FIREBASE_ADMIN credentials.');
if(!getApps().length)initializeApp({credential:cert({projectId,clientEmail,privateKey})});
const db=getFirestore(),stateRef=db.collection('systemMigrations').doc('revenueHistory-v42');
const initial=(await stateRef.get()).data()||{};
if(initial.completed){console.log('Đã nhập toàn bộ dòng tiền lịch sử.');process.exit(0);}
const provided=process.argv.find(v=>v.startsWith('--cutoff='))?.slice(9);
const cutoff=String(initial.cutoff||provided||'');
if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(cutoff)||Number.isNaN(Date.parse(cutoff)))throw Error('Phải truyền --cutoff ISO UTC chính xác thời điểm phiên bản GU 4.2 lên Production.');
if(provided&&provided!==cutoff)throw Error('Không được đổi thời điểm cutoff khi đã chạy chuyển đổi.');
const max=Math.min(4000,Math.max(1,Number(process.argv.find(v=>v.startsWith('--max='))?.split('=')[1]||1000)));
let cursor=String(initial.cursor||''),processed=0;
const fmt=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'});
while(processed<max){
 const count=Math.min(80,max-processed);
 let query=db.collection('orders').orderBy(FieldPath.documentId()).limit(count);
 if(cursor)query=query.startAfter(cursor);
 const batch=await query.get();
 if(batch.empty){await stateRef.set({completed:true,cutoff,updatedAt:new Date().toISOString()},{merge:true});console.log('Hoàn tất.');break;}
 const days=new Map();
 for(const doc of batch.docs){for(const h of doc.data().history||[]){
  if(h.action!=='PAY'||!h.at||Date.parse(h.at)>=Date.parse(cutoff))continue;
  const n=Number(h.amount||0);if(!Number.isFinite(n)||n<=0)continue;
  const date=fmt.format(new Date(h.at)),prev=days.get(date)||{amount:0,payments:0};
  prev.amount+=n;prev.payments++;days.set(date,prev);
 }}
 const last=batch.docs.at(-1).id;
 await db.runTransaction(async tx=>{
  const saved=await tx.get(stateRef);
  if(String(saved.data()?.cursor||'')!==cursor)throw Error('Dữ liệu chuyển đổi đã thay đổi. Không cho phép chạy song song.');
  for(const [date,row] of days){tx.set(db.collection('cashHistoryDaily').doc(date),{
    amount:FieldValue.increment(row.amount),payments:FieldValue.increment(row.payments),updatedAt:new Date().toISOString()},{merge:true});}
  tx.set(stateRef,{cursor:last,cutoff,completed:false,processed:FieldValue.increment(batch.size),updatedAt:new Date().toISOString()},{merge:true});
 });
 cursor=last;processed+=batch.size;
 console.log('Đã xử lý',processed,'đơn, cutoff',cutoff);
 if(batch.size<count)break;
}
console.log('Có thể chạy lại cùng --cutoff vào ngày tiếp theo nếu chưa hoàn tất.');
