import 'server-only';
import {randomUUID} from 'node:crypto';
import {savePhoto,readPhoto,deletePhoto} from './local-media';
import {ApiError} from './http';
/** Compatibility API: authenticated customer evidence now resides exclusively on VPS. */
export type SecureCloudinaryImage={provider:'local';publicId:string;format:'jpg'|'png'|'webp';contentType:string};
export function securePhotoPublicId(uid:string,id:string){
 if(!/^[A-Za-z0-9_-]{10,128}$/.test(uid)||!/^[a-f0-9-]{36}$/.test(id))throw new ApiError(400,'Mã ảnh bảo mật không hợp lệ');
 return `gu/secure-evidence/${uid}/${id}`;
}
export async function uploadSecureCloudinary(bytes:Buffer,contentType:string,uid:string,id:string):Promise<SecureCloudinaryImage>{
 const format=contentType==='image/jpeg'?'jpg':contentType==='image/png'?'png':'webp';
 await savePhoto('secure',uid,id,bytes,contentType);
 return {provider:'local',publicId:securePhotoPublicId(uid,id),format,contentType};
}
export async function downloadSecureCloudinary(image:SecureCloudinaryImage){
 const match=/^gu\/secure-evidence\/([A-Za-z0-9_-]{10,128})\/([a-f0-9-]{36})$/.exec(image.publicId);
 if(!match)throw new ApiError(400,'Mã chứng từ không hợp lệ');return readPhoto('secure',match[1],match[2],image.format);
}
export async function deleteSecureCloudinary(publicId:string){
 const match=/^gu\/secure-evidence\/([A-Za-z0-9_-]{10,128})\/([a-f0-9-]{36})$/.exec(publicId);
 if(!match)throw new ApiError(400,'Mã chứng từ không hợp lệ');
 for(const ext of ['jpg','png','webp'])await deletePhoto('secure',match[1],match[2],ext);
}
export const diagnosticEvidenceId=()=>randomUUID();
