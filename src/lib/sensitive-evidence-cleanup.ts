import 'server-only';
import {getStorage} from 'firebase-admin/storage';
import {db} from './firebase-admin';
import {destroyAuthenticatedEvidence,evidencePublicId,isEvidenceRef} from './cloudinary-private-evidence';
import {validEvidenceId} from './secure-evidence';
import {FieldValue,FieldPath,type Transaction} from 'firebase-admin/firestore';
import {cleanupAllowed,orphanOldEnough} from './sensitive-evidence-rules';
/**
 * The database holds ONLY a retryable order ID, never image bytes or secret URLs.
 * Cleanup is idempotent and always removes remote images BEFORE removing their
 * Firestore references. A provider failure MUST leave a retryable task.
 */
export type SensitiveEvidenceJob={orderId:string;createdAt:string};
export const SENSITIVE_CLEANUP_COLLECTION='sensitiveEvidenceCleanup';
export function queueSensitiveEvidenceCleanup(tx:Transaction,orderId:string,now:string){
  tx.set(db().collection(SENSITIVE_CLEANUP_COLLECTION).doc(orderId),{orderId,createdAt:now,attempts:0},{merge:true});
}
function hasDeposit(order:Record<string,unknown>):boolean {
  return Boolean(order.hadHandoverDeposit||order.handoverDepositProofId);
}
/** Old Firebase assets remain deletable only if a real legacy bucket is configured. */
function legacyEvidenceBucket(){
  const name=(process.env.FIREBASE_STORAGE_BUCKET||'').trim().replace(/^gs:\/\//,'').replace(/\/$/,'');
  if(!/^[a-zA-Z0-9._-]{3,222}$/.test(name))throw Error('Chứng từ cũ ở Firebase Storage: cần cấu hình chính xác FIREBASE_STORAGE_BUCKET; chưa xóa chứng từ.');
  return getStorage().bucket(name);
}
async function removeRemote(doc:FirebaseFirestore.QueryDocumentSnapshot|FirebaseFirestore.DocumentSnapshot):Promise<void>{
  const data=doc.data();if(!data)return;
  if(data.asset!==undefined||data.provider==='cloudinary'){
    if(!validEvidenceId(doc.id)||typeof data.ownerUid!=='string')throw Error('Chứng từ Cloudinary thiếu mã hoặc tài khoản chủ hợp lệ; không xóa.');
    const expectedId=evidencePublicId(data.ownerUid,doc.id);
    if(data.asset!==undefined){
    // GU v5.5.4 stores Cloudinary metadata in `asset`, not at the document root.
    if(!isEvidenceRef(data.asset)||data.asset.publicId!==expectedId)throw Error('Metadata ảnh Cloudinary mới không hợp lệ; không xóa.');
    await destroyAuthenticatedEvidence(data.asset);
    }else{
    // Compatibility with the earlier private-Cloudinary schema in some GU branches.
    const asset={provider:'cloudinary',deliveryType:'authenticated',publicId:data.publicId,format:data.format,contentType:data.contentType};
    if(!isEvidenceRef(asset)||asset.publicId!==expectedId)throw Error('Metadata ảnh Cloudinary cũ không hợp lệ; không xóa.');
    await destroyAuthenticatedEvidence(asset);
    }
  }else if(typeof data.path==='string'){
    // Legacy Firebase Storage photo. Never silently mark it deleted when the
    // bucket does not exist or is inaccessible.
    if(!/^gu\/(?:secure-evidence|evidence)\//.test(data.path)||data.path.includes('..'))throw Error('Đường dẫn chứng từ Firebase cũ cần Admin kiểm tra trước khi xóa.');
    await legacyEvidenceBucket().file(data.path).delete({ignoreNotFound:true});
  }else throw Error('Bản ghi chứng từ không có nơi lưu hợp lệ; cần đối chiếu thủ công.');
}
/** Purge sensitive uploads bound to a reviewed/closed order, including top-up receipts. */
export async function cleanupSensitiveOrder(orderId:string):Promise<'deleted'|'skipped'> {
  const store=db(),orderRef=store.collection('orders').doc(orderId),jobRef=store.collection(SENSITIVE_CLEANUP_COLLECTION).doc(orderId);
  const [job,orderSnap]=await Promise.all([jobRef.get(),orderRef.get()]);
  if(!job.exists)return 'skipped';
  if(!orderSnap.exists)throw Error('Đơn đã mất, không được xóa chứng từ khi chưa đối chiếu.');
  const order=orderSnap.data()||{};
  if(!cleanupAllowed(order))throw Error('Ảnh chưa được Admin duyệt hoặc đơn chưa đóng.');
  const proofs=await store.collection('secureEvidenceUploads').where('consumedOrderId','==',orderId).limit(101).get();
  if(proofs.size>100)throw Error('Đơn chứa trên 100 chứng từ: cần chia lô có kiểm soát.');
  // A few older uploads might only be referenced on the order, not indexed properly.
  const ids=[order.reservationPaymentProofId,order.handoverDepositProofId].filter(validEvidenceId) as string[];
  const missingIds=ids.filter(id=>!proofs.docs.some(p=>p.id===id));
  const extra=await Promise.all(missingIds.map(id=>store.collection('secureEvidenceUploads').doc(id).get()));
  for(const doc of extra){if(!doc.exists||doc.data()?.consumedOrderId!==orderId)throw Error('Không thể xác minh chứng từ cũ của đơn.');}
  const all=[...proofs.docs,...extra];
  // Deletion is repeatable: Cloudinary confirms deletion OR already absent.
  for(const doc of all)await removeRemote(doc);
  const now=new Date().toISOString();
  await store.runTransaction(async tx=>{
    const [freshJob,freshOrder,...freshDocs]=await Promise.all([tx.get(jobRef),tx.get(orderRef),...all.map(d=>tx.get(d.ref))]);
    if(!freshJob.exists)return;
    if(!freshOrder.exists||!cleanupAllowed(freshOrder.data()||{}))throw Error('Trạng thái duyệt đã thay đổi; giữ tác vụ xóa.');
    if(freshDocs.some(d=>d.exists&&d.data()?.consumedOrderId!==orderId))throw Error('Chứng từ đã đổi chủ đơn.');
    const before=freshOrder.data()||{};
    for(const d of freshDocs)if(d.exists)tx.delete(d.ref);
    tx.update(orderRef,{
      reservationPaymentProofId:FieldValue.delete(),handoverDepositProofId:FieldValue.delete(),
      hadHandoverDeposit:hasDeposit(before),sensitiveEvidencePurgedAt:now,sensitiveEvidenceStatus:'PURGED',updatedAt:now,
    });
    tx.delete(jobRef);
  });
  return 'deleted';
}
/** Incremental migration: old already-reviewed orders get a cleanup job automatically.
 * A cursor avoids scanning all historical rentals in one serverless invocation.
 */
export async function queueReviewedEvidenceBackfill(batch=40):Promise<number>{
  const store=db(),state=store.collection('maintenanceState').doc('sensitiveEvidenceBackfill');
  const previous=await state.get(),cursor=String(previous.data()?.cursor||'');
  let query=store.collection('orders').orderBy(FieldPath.documentId()).limit(Math.max(1,Math.min(60,batch)));
  if(cursor)query=query.startAfter(cursor);
  const page=await query.get();
  const writer=store.batch();let queued=0;
  for(const doc of page.docs){
    const o=doc.data();
    if(cleanupAllowed(o)&&o.sensitiveEvidenceStatus!=='PURGED'&&(o.reservationPaymentProofId||o.handoverDepositProofId)){
      writer.set(store.collection(SENSITIVE_CLEANUP_COLLECTION).doc(doc.id),{orderId:doc.id,createdAt:new Date().toISOString()},{merge:true});queued++;
    }
  }
  writer.set(state,{cursor:page.size<batch?'':page.docs.at(-1)?.id||'',updatedAt:new Date().toISOString()},{merge:true});
  await writer.commit();return queued;
}
/** Unattached evidence is not customer evidence: a failed/dismissed form must not retain uploads indefinitely. */
export async function cleanupAbandonedSecureEvidence(limit=25):Promise<{deleted:number;failed:number}>{
  const store=db();
  // Incremental full scan avoids a custom composite index and guarantees the
  // orphan sweep eventually reaches every image, even beyond its first 100 IDs.
  const cursorRef=store.collection('maintenanceState').doc('sensitiveOrphanCursor');
  const cursorSnap=await cursorRef.get(),cursor=String(cursorSnap.data()?.cursor||'');
  let search=store.collection('secureEvidenceUploads').orderBy(FieldPath.documentId()).limit(100);
  if(cursor)search=search.startAfter(cursor);
  const queue=await search.get();
  let deleted=0,failed=0;
  for(const doc of queue.docs.filter(d=>d.data().consumedOrderId===null&&orphanOldEnough(d.data().createdAt)).slice(0,limit)){
    try{
      // Re-check ownership before deletion. A concurrent order creation must not
      // consume the image while we are deleting it.
      // Claim inside a transaction. Rental creation rejects cleanupState=DELETING,
      // so this cannot race with a customer pressing Create Order.
      const claim=await store.runTransaction(async tx=>{
        const fresh=await tx.get(doc.ref);
        if(!fresh.exists||fresh.data()?.consumedOrderId!==null)return false;
        tx.update(doc.ref,{cleanupState:'DELETING'});
        return true;
      });
      if(!claim)continue;
      const claimed=await doc.ref.get();
      if(claimed.exists)await removeRemote(claimed);
      await store.runTransaction(async tx=>{const again=await tx.get(doc.ref);if(again.exists&&again.data()?.consumedOrderId===null)tx.delete(doc.ref);});
      deleted++;
    }catch(error){failed++;console.error('[GU_SENSITIVE_ORPHAN_DELETE_FAILED]',doc.id,error instanceof Error?error.message:'Lỗi');}
  }
  await cursorRef.set({cursor:queue.size<100?'':queue.docs.at(-1)?.id||'',updatedAt:new Date().toISOString()},{merge:true});
  return {deleted,failed};
}
export async function runSensitiveEvidenceCleanup(limit=8):Promise<{done:number;failed:number;orphanDeleted:number;errors:string[]}>{
  const queue=await db().collection(SENSITIVE_CLEANUP_COLLECTION).orderBy('createdAt','asc').limit(Math.max(1,Math.min(limit,20))).get();
  let done=0,failed=0;const errors:string[]=[];
  for(const j of queue.docs){
    try{if(await cleanupSensitiveOrder(j.id)==='deleted')done++;}
    catch(error){failed++;errors.push(j.id+': '+(error instanceof Error?error.message:'Lỗi'));
      // Rotate failures so one unavailable legacy bucket does not block other orders.
      await j.ref.update({createdAt:new Date().toISOString(),attempts:FieldValue.increment(1)}).catch(()=>{});
    }
  }
  const abandoned=await cleanupAbandonedSecureEvidence(15).catch(error=>{errors.push('Ảnh chưa gắn đơn: '+(error instanceof Error?error.message:'Lỗi'));return {deleted:0,failed:1};});
  return {done,failed:failed+abandoned.failed,orphanDeleted:abandoned.deleted,errors};
}
