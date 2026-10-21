import 'server-only';
import {createHash,randomUUID} from 'node:crypto';
import {ApiError} from './http';

/** Server-side only: no URLs, tokens, or secrets are returned to the browser. */
export type SecureCloudinaryImage={provider:'cloudinary';publicId:string;format:'jpg'|'png'|'webp';contentType:string};
export function cloudinarySecureConfig(){
 const name=(process.env.CLOUDINARY_CLOUD_NAME||'').trim();
 const key=(process.env.CLOUDINARY_API_KEY||'').trim();
 const secret=(process.env.CLOUDINARY_API_SECRET||'').trim();
 if(!/^[a-zA-Z0-9_-]+$/.test(name)||!key||!secret)throw new ApiError(503,'Chưa cấu hình đủ 3 biến Cloudinary trong Vercel.');
 return {name,key,secret};
}
export function cloudinaryApiSignature(params:Record<string,string|number|boolean>,secret:string){
 return createHash('sha1').update(Object.entries(params).filter(([k,v])=>k!=='file'&&k!=='api_key'&&k!=='signature'&&v!==undefined).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}=${v}`).join('&')+secret).digest('hex');
}
export function securePhotoPublicId(uid:string,id:string){
 if(!/^[a-zA-Z0-9_-]{1,128}$/.test(uid)||!/^[a-f0-9-]{36}$/.test(id))throw new ApiError(400,'Mã ảnh bảo mật không hợp lệ.');
 return `gu/secure-evidence/${uid}/${id}`;
}
export function cloudinarySecureAuthHeader(){const {key,secret}=cloudinarySecureConfig();return 'Basic '+Buffer.from(`${key}:${secret}`).toString('base64');}
export async function uploadSecureCloudinary(bytes:Buffer,contentType:string,uid:string,id:string):Promise<SecureCloudinaryImage>{
 const {name}=cloudinarySecureConfig();
 const format=contentType==='image/jpeg'?'jpg':contentType==='image/png'?'png':'webp';
 const publicId=securePhotoPublicId(uid,id);
 const body=new FormData();
 body.set('file',new Blob([new Uint8Array(bytes)],{type:contentType}),`evidence.${format}`);
 body.set('public_id',publicId);
 body.set('type','authenticated');
 body.set('overwrite','false');
 let result:Response;
 try{result=await fetch(`https://api.cloudinary.com/v1_1/${name}/image/upload`,{method:'POST',headers:{Authorization:cloudinarySecureAuthHeader()},body,cache:'no-store',signal:AbortSignal.timeout(25000)});}
 catch{throw new ApiError(503,'Không kết nối được Cloudinary để lưu ảnh bảo mật. Vui lòng thử lại.');}
 if(!result.ok){console.error('[GU_CLOUDINARY_SECURE_UPLOAD]',result.status);throw new ApiError(result.status===429?503:502,result.status===429?'Cloudinary đã đạt giới hạn yêu cầu. Vui lòng thử lại.':'Cloudinary từ chối lưu ảnh bảo mật. Kiểm tra API và hạn mức tài khoản.');}
 const data=await result.json() as Record<string,unknown>;
 if(data.type!=='authenticated'||data.resource_type!=='image'||data.public_id!==publicId||data.format!==format){
  console.error('[GU_CLOUDINARY_SECURE_INVALID_RESULT]');
  throw new ApiError(502,'Cloudinary không xác nhận ảnh ở chế độ bảo mật authenticated.');
 }
 return {provider:'cloudinary',publicId,format,contentType};
}
/** Time-limited signed Cloudinary API download URL. Generated and consumed ONLY on our server. */
export function signedSecureDownloadUrl(image:Pick<SecureCloudinaryImage,'publicId'|'format'>,nowSeconds=Math.floor(Date.now()/1000)){
 const {name,key,secret}=cloudinarySecureConfig();
 if(!/^gu\/secure-evidence\/[A-Za-z0-9_-]{1,128}\/[a-f0-9-]{36}$/.test(image.publicId)||!['jpg','png','webp'].includes(image.format))throw new ApiError(400,'Thông tin ảnh bảo mật không hợp lệ.');
 const params={timestamp:nowSeconds,expires_at:nowSeconds+90,public_id:image.publicId,format:image.format,type:'authenticated'};
 const query=new URLSearchParams({...Object.fromEntries(Object.entries(params).map(([k,v])=>[k,String(v)])),api_key:key,signature:cloudinaryApiSignature(params,secret)});
 return `https://api.cloudinary.com/v1_1/${name}/image/download?${query}`;
}
export async function downloadSecureCloudinary(image:SecureCloudinaryImage){
 const url=signedSecureDownloadUrl(image);
 let response:Response;
 try{response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(18000),redirect:'error'});}
 catch{throw new ApiError(503,'Không tải được ảnh bảo mật từ Cloudinary. Vui lòng thử lại.');}
 if(!response.ok){console.error('[GU_CLOUDINARY_SECURE_DOWNLOAD]',response.status);throw new ApiError(response.status===404?404:502,'Cloudinary không trả được ảnh bảo mật cho đơn này.');}
 const length=Number(response.headers.get('content-length')||0);
 if(length>3*1024*1024)throw new ApiError(502,'Ảnh bảo mật vượt dung lượng cho phép.');
 const data=Buffer.from(await response.arrayBuffer());
 if(!data.length||data.length>3*1024*1024)throw new ApiError(502,'Dữ liệu ảnh bảo mật không hợp lệ.');
 return data;
}
export async function deleteSecureCloudinary(publicId:string){
 const {name}=cloudinarySecureConfig();
 if(!/^gu\/secure-evidence\/[A-Za-z0-9_-]{1,128}\/[a-f0-9-]{36}$/.test(publicId))throw new ApiError(400,'Mã ảnh không hợp lệ.');
 const query=new URLSearchParams();query.append('public_ids[]',publicId);
 const result=await fetch(`https://api.cloudinary.com/v1_1/${name}/resources/image/authenticated?${query}`,{method:'DELETE',headers:{Authorization:cloudinarySecureAuthHeader()},cache:'no-store',signal:AbortSignal.timeout(20000)});
 if(!result.ok)throw new ApiError(502,'Không xóa được ảnh thử hoặc ảnh không có chứng từ.');
 const data=await result.json() as {deleted?:Record<string,string>};
 if(!['deleted','not_found'].includes(data.deleted?.[publicId]||''))throw new ApiError(502,'Cloudinary chưa xác nhận xóa ảnh.');
}
/** Test-only object id, contains no customer data. */
export function diagnosticEvidenceId(){return randomUUID();}
