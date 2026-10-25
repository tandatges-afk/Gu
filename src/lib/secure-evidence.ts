import 'server-only';
import {getStorage} from 'firebase-admin/storage';
import {db} from './firebase-admin';
import {ApiError} from './http';
import type {Transaction} from 'firebase-admin/firestore';
export type EvidencePurpose='reservation'|'deposit';
export const validEvidenceId=(s:unknown):s is string=>typeof s==='string'&&/^[a-f0-9-]{36}$/.test(s);
export const evidenceBucket=()=>{
 const name=(process.env.FIREBASE_STORAGE_BUCKET||'').trim().replace(/^gs:\/\//,'').replace(/\/$/,'');
 if(!name)throw new ApiError(503,'Cần cấu hình FIREBASE_STORAGE_BUCKET (bucket riêng tư) để chụp CCCD/chứng từ cọc.');
 if(!/^[a-zA-Z0-9._-]{3,222}$/.test(name))throw new ApiError(503,'FIREBASE_STORAGE_BUCKET phải là tên bucket, ví dụ gugu-547e3.firebasestorage.app; không dùng URL https.');
 return getStorage().bucket(name);
};
export async function readVerifiedEvidence(tx:Transaction,id:string,uid:string,purpose:EvidencePurpose,draftId:string){
 if(!validEvidenceId(id))throw new ApiError(400,'Thiếu ảnh cọc/thanh toán hợp lệ.');
 const ref=db().collection('secureEvidenceUploads').doc(id);const snap=await tx.get(ref);
 const e=snap.data();
 if(!snap.exists||e?.ownerUid!==uid||e?.purpose!==purpose||e?.draftId!==draftId||e?.consumedOrderId)throw new ApiError(409,'Ảnh chưa được gửi từ tài khoản này hoặc đã sử dụng.');
 return {ref,data:e!};
}

/** A wrong or unprovisioned bucket is an infrastructure setup failure, not a missing customer photo. */
export function evidenceStorageError(error:unknown):never{
 const e=error as {code?:number|string;message?:string};
 if(String(e?.code)==='404'&&/bucket|does not exist|not found/i.test(e.message||''))
  throw new ApiError(503,'Firebase Storage bucket chưa tồn tại hoặc FIREBASE_STORAGE_BUCKET đang sai. Tạo/kiểm tra bucket trong Firebase Console → Storage rồi cập nhật biến môi trường Vercel. Không chuyển ảnh CCCD sang kho công khai.');
 if(String(e?.code)==='403')throw new ApiError(503,'Tài khoản Firebase Admin chưa được cấp quyền truy cập bucket riêng tư. Kiểm tra IAM Storage Object User và cấu hình Service Account.');
 throw error;
}
