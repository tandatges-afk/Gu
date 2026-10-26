import 'server-only';
import {getStorage} from 'firebase-admin/storage';
import {db} from './firebase-admin';
import {ApiError} from './http';
import type {Transaction} from 'firebase-admin/firestore';
import {isEvidenceRef,privateEvidenceCredentials,downloadAuthenticatedEvidence,uploadAuthenticatedEvidence,destroyAuthenticatedEvidence,EvidenceProviderError} from './cloudinary-private-evidence';
export type EvidencePurpose='reservation'|'deposit';
export const validEvidenceId=(s:unknown):s is string=>typeof s==='string'&&/^[a-f0-9-]{36}$/.test(s);

/** New v5.5.4 uploads never use Firebase Storage. */
export async function storePrivateEvidence(bytes:Buffer,contentType:string,uid:string,id:string){
 try{return await uploadAuthenticatedEvidence(bytes,contentType,uid,id);}
 catch(e){if(e instanceof EvidenceProviderError)throw new ApiError(e.status,e.message);throw e;}
}
export async function deleteUnattachedEvidence(asset:Awaited<ReturnType<typeof storePrivateEvidence>>){
 await destroyAuthenticatedEvidence(asset);
}
/** Existing evidence IDs and transaction attachment stay unchanged. */
export async function readVerifiedEvidence(tx:Transaction,id:string,uid:string,purpose:EvidencePurpose,draftId:string){
 if(!validEvidenceId(id))throw new ApiError(400,'Thiếu ảnh cọc/thanh toán hợp lệ.');
 const ref=db().collection('secureEvidenceUploads').doc(id);const snap=await tx.get(ref);
 const e=snap.data();
 if(!snap.exists||e?.ownerUid!==uid||e?.purpose!==purpose||e?.draftId!==draftId||e?.consumedOrderId)throw new ApiError(409,'Ảnh chưa được gửi từ tài khoản này hoặc đã sử dụng.');
 if(!isEvidenceRef(e?.asset)&&!e?.path)throw new ApiError(409,'Ảnh chứng từ chưa được lưu hợp lệ.');
 return {ref,data:e!};
}
/** Legacy photos: read-only support when a pre-existing private bucket is configured. */
async function readLegacyFirebaseEvidence(path:string):Promise<Buffer>{
 const name=(process.env.FIREBASE_STORAGE_BUCKET||'').trim().replace(/^gs:\/\//,'').replace(/\/$/,'');
 if(!name)throw new ApiError(503,'Ảnh cũ còn ở Firebase Storage; cần cấu hình bucket cũ để xem hoặc di chuyển dữ liệu. Ảnh mới đã lưu trên Cloudinary.');
 if(!/^[a-zA-Z0-9._-]{3,222}$/.test(name)||!/^gu\/secure-evidence\/[A-Za-z0-9_-]+\/[a-f0-9-]{36}\.(jpg|png|webp)$/.test(path))
  throw new ApiError(503,'Đường dẫn ảnh cũ không hợp lệ.');
 try{const [bytes]=await getStorage().bucket(name).file(path).download();return bytes;}
 catch{throw new ApiError(503,'Không đọc được ảnh Firebase Storage cũ. Kiểm tra bucket, quyền truy cập hoặc lên kế hoạch chuyển ảnh cũ.');}
}
export async function readPrivateEvidenceDocument(info:Record<string,unknown>):Promise<Buffer>{
 if(isEvidenceRef(info.asset)){
  try{return await downloadAuthenticatedEvidence(info.asset);}
  catch(e){if(e instanceof EvidenceProviderError)throw new ApiError(e.status,e.message);throw e;}
 }
 if(typeof info.path==='string')return readLegacyFirebaseEvidence(info.path);
 throw new ApiError(404,'Không tìm thấy nội dung ảnh bảo mật.');
}
export function assertPrivateEvidenceConfigured(){return privateEvidenceCredentials();}
