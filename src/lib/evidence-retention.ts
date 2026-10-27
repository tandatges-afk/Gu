import {type InspectionRound} from './evidence-retention-rules';
import {db} from './firebase-admin';
import type {RentalOrder} from './types';
import type {PhotoProof,ProofSet} from './inspection-proof';
import {deleteByURL} from './local-media';
function photoUrls(proofs:PhotoProof[]|undefined,itemId:string):string[]{
 return Object.values(proofs?.find(p=>p.itemId===itemId)?.shots||{}).map(s=>s.url).filter(Boolean);
}
export function urlsForRound(order:RentalOrder,itemId:string){return [...new Set([...photoUrls(order.handoverProof?.items,itemId),...photoUrls(order.returnProof?.items,itemId)])];}
async function deleteLocalEvidence(urls:string[]):Promise<void>{
 for(const url of urls)await deleteByURL(url);
}
function withoutPhotos(set:ProofSet|undefined,itemId:string):ProofSet|undefined{
 if(!set)return set;
 return {...set,items:set.items.map(p=>p.itemId===itemId?{...p,shots:{}}:p)};
}
/** Retriable cleanup: successful Cloudinary deletion precedes removal of database photo links. */
export async function cleanupOne(jobId:string):Promise<'deleted'|'skipped'>{
 const store=db(),jobRef=store.collection('inspectionCleanup').doc(jobId);
 const jobSnap=await jobRef.get();if(!jobSnap.exists)return 'skipped';
 const itemId=String(jobSnap.data()?.itemId||''),orderId=String(jobSnap.data()?.orderId||'');
 if(!/^[A-Za-z0-9]{10,64}$/.test(itemId)||!/^[A-Za-z0-9]{10,64}$/.test(orderId))throw new Error('Job xóa ảnh có mã không hợp lệ.');
 const tracker=store.collection('inspectionEvidence').doc(itemId);
 const [trackerSnap,orderSnap]=await Promise.all([tracker.get(),store.collection('orders').doc(orderId).get()]);
 if(!orderSnap.exists)throw new Error('Không tìm thấy đơn nguồn của ảnh cũ.');
 const keep=(trackerSnap.data()?.rounds||[]) as InspectionRound[];
 if(keep.some(r=>r.orderId===orderId)){
  // A stale cleanup task must not permanently occupy the front of the retry queue.
  await store.runTransaction(async tx=>{
   const [j,t]=await Promise.all([tx.get(jobRef),tx.get(tracker)]);
   if(j.exists&&((t.data()?.rounds||[]) as InspectionRound[]).some(r=>r.orderId===orderId))tx.delete(jobRef);
  });
  return 'skipped'; // Never delete one of the latest seven.
 }
 const order={id:orderId,...orderSnap.data()} as RentalOrder;
 const urls=urlsForRound(order,itemId);
 await deleteLocalEvidence(urls);
 const now=new Date().toISOString();
 await store.runTransaction(async tx=>{
  const [j,o,t]=await Promise.all([tx.get(jobRef),tx.get(orderSnap.ref),tx.get(tracker)]);
  if(!j.exists||!o.exists)return;
  if(((t.data()?.rounds||[]) as InspectionRound[]).some(r=>r.orderId===orderId))throw new Error('Lượt này vừa được đánh dấu cần giữ; hủy xóa.');
  const prior={id:orderId,...o.data()} as RentalOrder;
  for(const url of urls){
   const uploadId=url.split('/').pop()!.split('.')[0];
   const uploadRef=store.collection('proofUploads').doc(uploadId);
   tx.delete(uploadRef);
  }
  tx.update(orderSnap.ref,{handoverProof:withoutPhotos(prior.handoverProof,itemId),returnProof:withoutPhotos(prior.returnProof,itemId),[`evidenceDeletedAt.${itemId}`]:now});
  tx.delete(jobRef);
 });
 return 'deleted';
}
export async function runEvidenceCleanup(limit=8):Promise<{done:number;failed:number;errors:string[]}>{
 const queue=await db().collection('inspectionCleanup').orderBy('createdAt','asc').limit(Math.min(20,Math.max(1,limit))).get();
 let done=0,failed=0;const errors:string[]=[];
 for(const j of queue.docs){try{const result=await cleanupOne(j.id);if(result==='deleted')done++;}catch(e){failed++;errors.push(e instanceof Error?e.message:'Lỗi không rõ');console.error('Inspection cleanup failed',j.id,e);
  // Rotate a failed item behind the other queued jobs; prevents starvation on 8+ expirations.
  try{await j.ref.update({createdAt:new Date().toISOString(),lastAttemptAt:new Date().toISOString(),attempts:Number(j.get('attempts')||0)+1});}catch(error){console.error('Could not reschedule evidence cleanup',j.id,error);}
 }}
 return {done,failed,errors};
}
