/** Existing inventory name index. --plan is read only. --execute requires explicit project confirmation.
 * Pause GU inventory writes during migration. Never renames or deletes a product.
 */
import {cert,initializeApp,getApps} from 'firebase-admin/app';
import {getFirestore,FieldPath} from 'firebase-admin/firestore';
import {normalizeProductName,productNameIndexId,PRODUCT_NAME_INDEX_MIGRATION} from '../src/lib/product-name.ts';
import {productSearchBigrams} from '../src/lib/product-search.ts';
const projectId=process.env.FIREBASE_PROJECT_ID;
const clientEmail=process.env.FIREBASE_CLIENT_EMAIL;
const privateKey=process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,'\n');
if(!projectId||!clientEmail||!privateKey)throw Error('Thiếu cấu hình Firebase Admin từ .env.local.');
if(!getApps().length)initializeApp({credential:cert({projectId,clientEmail,privateKey})});
const db=getFirestore();
const execute=process.argv.includes('--execute');
const confirm=process.argv.find(a=>a.startsWith('--confirm='))?.slice(10);
if(execute&&confirm!==`INDEX-${projectId}`)throw Error(`Cần --confirm=INDEX-${projectId} để thực hiện.`);
const items=[];let cursor='';
while(true){let q=db.collection('items').orderBy(FieldPath.documentId()).limit(200);if(cursor)q=q.startAfter(cursor);
 const snap=await q.get();if(snap.empty)break;items.push(...snap.docs);cursor=snap.docs.at(-1).id;if(snap.size<200)break;}
const names=new Map();for(const doc of items){const name=String(doc.data().name||'');if(!name.trim())throw Error('Sản phẩm thiếu tên: '+doc.id);
 const key=normalizeProductName(name);if(!names.has(key))names.set(key,[]);names.get(key).push({id:doc.id,name});}
const duplicates=[...names.entries()].filter(([,owners])=>owners.length>1);
console.log('FIREBASE PROJECT:',projectId,'TOTAL ITEMS:',items.length,'UNIQUE NAMES:',names.size,'DUPLICATE GROUPS:',duplicates.length);
for(const [key,owners] of duplicates.slice(0,40))console.log('DUPLICATE:',key,owners.map(o=>`${o.name} [${o.id}]`).join(' | '));
if(!execute){console.log('PLAN ONLY. Để chuyển đổi: --execute --confirm=INDEX-'+projectId);process.exit(0);}
const state=db.collection('systemMigrations').doc(PRODUCT_NAME_INDEX_MIGRATION);
// Live create/edit operations reject writes until migration has completed.
await state.set({completed:false,startedAt:new Date().toISOString(),updatedAt:new Date().toISOString(),processed:0,duplicateGroups:duplicates.length});
const entries=[...items.map(doc=>({ref:doc.ref,data:{nameKey:normalizeProductName(String(doc.data().name)),nameSearchBigrams:productSearchBigrams(String(doc.data().name))},merge:true})),
 ...[...names.entries()].map(([key,owners])=>({ref:db.collection('productNameIndex').doc(productNameIndexId(key)),data:{key,name:owners[0].name,owners:owners.map(o=>o.id),updatedAt:new Date().toISOString()},merge:false}))];
let done=0;for(let i=0;i<entries.length;i+=350){const batch=db.batch();for(const entry of entries.slice(i,i+350))batch.set(entry.ref,entry.data,{merge:entry.merge});await batch.commit();done+=Math.min(350,entries.length-i);console.log('Đã đồng bộ',done,'/',entries.length,'tệp chỉ mục');}
await state.set({completed:true,completedAt:new Date().toISOString(),updatedAt:new Date().toISOString(),processed:items.length,duplicateGroups:duplicates.length});
console.log('INDEX_OK. Các nhóm trùng từ dữ liệu cũ được ghi nhận, KHÔNG tự động đổi tên. Đổi tên từng sản phẩm trùng trong Admin → Kho.');
