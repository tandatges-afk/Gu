import 'server-only';
import {getStorage} from 'firebase-admin/storage';
import {db} from './firebase-admin';
import {ApiError} from './http';
import type {Transaction} from 'firebase-admin/firestore';
export type EvidencePurpose='reservation'|'deposit';
export const validEvidenceId=(s:unknown):s is string=>typeof s==='string'&&/^[a-f0-9-]{36}$/.test(s);
/** Legacy Firebase Storage reader only. New evidence is stored on Cloudinary authenticated. */
export const evidenceBucket=()=>{
 const name=(process.env.FIREBASE_STORAGE_BUCKET||'').trim();
 if(!name)throw new ApiError(503,'Chưa cấu hình FIREBASE_STORAGE_BUCKET trên môi trường đang chạy (Vercel/Codespaces).');
 if(name.startsWith('gs://')||name.includes('/')||!/^[a-z0-9._-]+$/.test(name))throw new ApiError(503,'FIREBASE_STORAGE_BUCKET chỉ được là tên bucket, không nhập gs:// hoặc đường dẫn.');
 return getStorage().bucket(name);
};
export async function readVerifiedEvidence(tx:Transaction,id:string,uid:string,purpose:EvidencePurpose,draftId:string){
 if(!validEvidenceId(id))throw new ApiError(400,'Thiếu ảnh cọc/thanh toán hợp lệ.');
 const ref=db().collection('secureEvidenceUploads').doc(id);const snap=await tx.get(ref);
 const e=snap.data();
 if(!snap.exists||e?.ownerUid!==uid||e?.purpose!==purpose||e?.draftId!==draftId||e?.consumedOrderId)throw new ApiError(409,'Ảnh chưa được gửi từ tài khoản này hoặc đã sử dụng.');
 return {ref,data:e!};
}
