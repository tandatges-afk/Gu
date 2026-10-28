import 'server-only';
import {db} from './pg-firestore';
import {ApiError} from './http';
import type {Transaction} from './pg-firestore';
export type EvidencePurpose='reservation'|'deposit';
export const validEvidenceId=(s:unknown):s is string=>typeof s==='string'&&/^[a-f0-9-]{36}$/.test(s);
/** Legacy remote attachments require explicit offline migration; do not remove the DB link. */
export function evidenceBucket():never{throw new ApiError(503,'Chứng từ Firebase cũ cần nhập dữ liệu riêng trước khi có thể xem hoặc xóa trên VPS.');}
export async function readVerifiedEvidence(tx:Transaction,id:string,uid:string,purpose:EvidencePurpose,draftId:string){
 if(!validEvidenceId(id))throw new ApiError(400,'Thiếu ảnh cọc/thanh toán hợp lệ.');
 const ref=db().collection('secureEvidenceUploads').doc(id),snap=await tx.get(ref),e=snap.data();
 if(!snap.exists||e?.ownerUid!==uid||e?.purpose!==purpose||e?.draftId!==draftId||e?.consumedOrderId||e?.cleanupState==='DELETING')throw new ApiError(409,'Ảnh chưa được gửi từ tài khoản này hoặc đã sử dụng.');
 return {ref,data:e!};
}
