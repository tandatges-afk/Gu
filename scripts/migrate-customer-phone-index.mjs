/** One-time phoneIndex backfill for historical customer records.
 * Read-only by default. Never automatically merges, deletes, or renames people.
 * Run after backup, off peak; customer writes should be paused during execution.
 *   node --experimental-strip-types --env-file=.env.local scripts/migrate-customer-phone-index.mjs --plan
 *   node --experimental-strip-types --env-file=.env.local scripts/migrate-customer-phone-index.mjs --execute --confirm=PHONES-<firebase project id>
 */
import {cert,initializeApp,getApps} from 'firebase-admin/app';
import {getFirestore,FieldPath} from 'firebase-admin/firestore';
import {normalizePhone} from '../src/lib/rental.ts';
const projectId=process.env.FIREBASE_PROJECT_ID;
const clientEmail=process.env.FIREBASE_CLIENT_EMAIL;
const privateKey=process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,'\n');
if(!projectId||!clientEmail||!privateKey)throw Error('Thiếu cấu hình Firebase Admin (.env.local)');
if(!getApps().length)initializeApp({credential:cert({projectId,clientEmail,privateKey})});
const db=getFirestore();
const execute=process.argv.includes('--execute');
const confirm=process.argv.find(s=>s.startsWith('--confirm='))?.slice(10);
if(execute&&confirm!==`PHONES-${projectId}`)throw Error('Thiếu mã xác nhận PHONES-'+projectId);
const groups=new Map();let cursor='',total=0;
while(true){let q=db.collection('customers').orderBy(FieldPath.documentId()).limit(200);
 if(cursor)q=q.startAfter(cursor);
 const snap=await q.get();if(snap.empty)break;
 for(const doc of snap.docs){total++;
  try{const phone=normalizePhone(doc.data().phone);if(!groups.has(phone))groups.set(phone,[]);groups.get(phone).push(doc.id);}
  catch{console.log('SĐT không hợp lệ:',doc.id);}
 }
 cursor=snap.docs.at(-1).id;if(snap.size<200)break;
}
const duplicates=[...groups.entries()].filter(([,ids])=>ids.length>1);
console.log({projectId,total,validPhones:groups.size,duplicateGroups:duplicates.length});
for(const [phone,ids] of duplicates.slice(0,25))console.log('TRÙNG',phone,ids);
if(!execute){console.log('PLAN ONLY. Không sửa dữ liệu.');process.exit(0);}
if(duplicates.length)throw Error('Phát hiện hồ sơ trùng SĐT. Admin cần đối chiếu và xử lý thủ công trước khi lập chỉ mục.');
let updated=0;
for(const [phone,ids] of groups){
 const ref=db.collection('phoneIndex').doc(encodeURIComponent(phone));
 await db.runTransaction(async tx=>{
  const prev=await tx.get(ref);
  if(prev.exists){if(prev.data()?.customerId!==ids[0])throw Error('phoneIndex khác khách đã kiểm tra: '+phone);return;}
  tx.create(ref,{customerId:ids[0]});updated++;
 });
}
console.log('Đã bổ sung chỉ mục:',updated,'/ tổng khách:',total,'. Không xóa khách hàng nào.');
