/** One-time resumable debtLedger backfill. Run outside peak hours in Codespaces.
 * node --env-file=.env.local scripts/migrate-debt-index.mjs --max=500
 * May read up to ~3*max documents due to transactional current-order/ledger checks.
 * Keep --max below remaining daily Spark read/write quota. Prefer off-peak execution.
 */
import {cert,initializeApp,getApps} from 'firebase-admin/app';
import {getFirestore,FieldPath} from 'firebase-admin/firestore';
const projectId=process.env.FIREBASE_PROJECT_ID,clientEmail=process.env.FIREBASE_CLIENT_EMAIL,privateKey=process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,'\n');
if(!projectId||!clientEmail||!privateKey)throw Error('Thiếu Firebase Admin credentials.');
if(!getApps().length)initializeApp({credential:cert({projectId,clientEmail,privateKey})});
const db=getFirestore();
const stateRef=db.collection('systemMigrations').doc('debtLedger-v42');
const maxArg=process.argv.find(v=>v.startsWith('--max='));
const max=Math.min(2000,Math.max(1,Number(maxArg?.split('=')[1]||500)));
const state=(await stateRef.get()).data()||{};
if(state.completed){console.log('Chỉ mục đã hoàn tất; không cần chạy lại.');process.exit(0);}
let cursor=String(state.cursor||''),processed=0,open=0;
while(processed<max){
 const n=Math.min(100,max-processed);
 let q=db.collection('orders').orderBy(FieldPath.documentId()).limit(n);
 if(cursor)q=q.startAfter(cursor);
 const snap=await q.get();if(snap.empty){await stateRef.set({cursor:'',completed:true,updatedAt:new Date().toISOString(),processed:(state.processed||0)+processed},{merge:true});console.log('Hoàn tất chỉ mục công nợ.');break;}
 // Re-read each eligible order inside a Firestore transaction: a payment/return
 // racing with this backfill must never be overwritten by a stale snapshot.
 // The migration deliberately does NOT touch fully paid/closed orders, whose
 // ledger may already have been deleted by the live application.
 for(const d of snap.docs){
   const initial=d.data();
   const initialBalance=Math.max(0,(initial.total||0)+(initial.compensationTotal||0)+(initial.lateFeeTotal||0)+(initial.otherFeeTotal||0)-(initial.paid||0));
   if(initialBalance<=0||!['RESERVED','PICKED_UP','RETURNED'].includes(initial.status))continue;
   const wasOpen=await db.runTransaction(async tx=>{
     const orderRef=db.collection('orders').doc(d.id);
     const ledgerRef=db.collection('debtLedger').doc(d.id);
     // All reads before any writes; current order wins over backfill snapshot.
     const [fresh,ledger]=await Promise.all([tx.get(orderRef),tx.get(ledgerRef)]);
     if(!fresh.exists)return false;
     const o={id:d.id,...fresh.data()};
     const balance=Math.max(0,(o.total||0)+(o.compensationTotal||0)+(o.lateFeeTotal||0)+(o.otherFeeTotal||0)-(o.paid||0));
     const kind=balance>0?(o.status==='RESERVED'?'reserved':['PICKED_UP','RETURNED'].includes(o.status)?'open':null):null;
     if(!kind){if(ledger.exists)tx.delete(ledgerRef);return false;}
     // A concurrent transaction that updates this order will retry our transaction.
     tx.set(ledgerRef,{kind,orderId:d.id,customerId:o.customerId,customerName:o.customerName,customerPhone:o.customerPhone,
       code:o.code,status:o.status,pickupDate:o.pickupDate,returnDate:o.returnDate,
       amount:balance+(o.paid||0),paid:o.paid||0,outstanding:balance,updatedAt:o.updatedAt||o.createdAt||''});
     return true;
   });
   if(wasOpen)open++;
 }
 cursor=snap.docs.at(-1).id;processed+=snap.size;
 await stateRef.set({cursor,completed:false,updatedAt:new Date().toISOString(),processed:(state.processed||0)+processed},{merge:true});
 console.log('Đã duyệt',processed,'đơn trong lượt chạy. Chỉ mục cần thu',open);
 if(snap.size<n)break;
}
console.log('Tiếp tục vào ngày khác nếu chưa hoàn tất; giữ mức --max trong hạn mức Firebase Free.');
