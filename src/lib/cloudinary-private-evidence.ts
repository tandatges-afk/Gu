/**
 * GU v5.5.4: Cloudinary authenticated media for customer identity / collateral proof.
 * Server-side only entry points; never return provider URLs or credentials to clients.
 * No extra npm dependency: requests use the documented signed REST API.
 */
import {createHash} from 'node:crypto';

export const CLOUDINARY_EVIDENCE_TYPE='authenticated' as const;
export const CLOUDINARY_EVIDENCE_LIMIT=3*1024*1024;
const FORMATS=new Set(['jpg','png','webp']);
export type PrivateImageFormat='jpg'|'png'|'webp';
export interface CloudinaryEvidenceRef { provider:'cloudinary'; deliveryType:'authenticated'; publicId:string; format:PrivateImageFormat; contentType:string; }
export interface EvidenceCredentials {cloud:string;key:string;secret:string;}
export class EvidenceProviderError extends Error {
 readonly status:number;
 constructor(status:number,message:string){super(message);this.name='EvidenceProviderError';this.status=status;}
}
export function privateEvidenceCredentials(env:NodeJS.ProcessEnv=process.env):EvidenceCredentials{
 const cloud=(env.CLOUDINARY_CLOUD_NAME||'').trim();
 const key=(env.CLOUDINARY_API_KEY||'').trim();
 const secret=(env.CLOUDINARY_API_SECRET||'').trim();
 if(!/^[A-Za-z0-9_-]{2,100}$/.test(cloud)||!key||!secret)throw new EvidenceProviderError(503,'Cloudinary chưa được cấu hình đầy đủ trên máy chủ.');
 return {cloud,key,secret};
}
export function evidencePublicId(uid:string,id:string):string{
 if(!/^[A-Za-z0-9_-]{1,128}$/.test(uid)||!/^[a-f0-9-]{36}$/.test(id))throw new Error('Mã bằng chứng không hợp lệ.');
 return `gu/secure-evidence/${uid}/${id}`;
}
export function isEvidenceRef(value:unknown):value is CloudinaryEvidenceRef{
 if(!value||typeof value!=='object')return false;
 const x=value as Record<string,unknown>;
 return x.provider==='cloudinary'&&x.deliveryType==='authenticated'&&
 typeof x.publicId==='string'&&/^gu\/secure-evidence\/[A-Za-z0-9_-]{1,128}\/[a-f0-9-]{36}$/.test(x.publicId)&&
 typeof x.format==='string'&&FORMATS.has(x.format)&&
 ['image/jpeg','image/png','image/webp'].includes(String(x.contentType));
}
/** Cloudinary signs sorted request parameters (omitting file, API key, resource type, signature). */
export function cloudinarySignature(params:Record<string,string|number|boolean>,secret:string):string{
 const canonical=Object.entries(params).filter(([,v])=>v!==''&&v!==undefined).sort(([a],[b])=>a.localeCompare(b,'en'))
  .map(([k,v])=>`${k}=${String(v)}`).join('&');
 return createHash('sha1').update(canonical+secret).digest('hex');
}
function apiUrl(c:EvidenceCredentials,endpoint:string){return `https://api.cloudinary.com/v1_1/${c.cloud}/image/${endpoint}`;}
/** Used only by the server. Never accepts a caller-provided publicId. */
export async function uploadAuthenticatedEvidence(bytes:Buffer,contentType:string,uid:string,id:string,fetcher:typeof fetch=fetch):Promise<CloudinaryEvidenceRef>{
 if(!bytes.length||bytes.length>CLOUDINARY_EVIDENCE_LIMIT)throw new EvidenceProviderError(413,'Ảnh tối đa 3 MB.');
 const c=privateEvidenceCredentials(),publicId=evidencePublicId(uid,id);
 const timestamp=Math.floor(Date.now()/1000);
 const params={public_id:publicId,type:CLOUDINARY_EVIDENCE_TYPE,overwrite:'false',timestamp};
 const form=new FormData();
 form.set('file',new Blob([new Uint8Array(bytes)],{type:contentType}),`evidence.${contentType==='image/png'?'png':contentType==='image/webp'?'webp':'jpg'}`);
 for(const [key,value] of Object.entries(params))form.set(key,String(value));
 form.set('api_key',c.key);form.set('signature',cloudinarySignature(params,c.secret));
 let response:Response;
 try{response=await fetcher(apiUrl(c,'upload'),{method:'POST',body:form,cache:'no-store',signal:AbortSignal.timeout(30000)});}
 catch{throw new EvidenceProviderError(502,'Không thể kết nối Cloudinary để lưu ảnh bảo mật.');}
 if(!response.ok)throw new EvidenceProviderError(response.status===429?503:502,'Cloudinary từ chối ảnh bảo mật. Kiểm tra hạn mức, tài khoản và cấu hình API.');
 let data:unknown;
 try{data=await response.json();}catch{throw new EvidenceProviderError(502,'Cloudinary trả dữ liệu ảnh không hợp lệ.');}
 const result=data as Record<string,unknown>|null;
 const format=result?.format==='jpeg'?'jpg':result?.format;
 const asset:CloudinaryEvidenceRef={provider:'cloudinary',deliveryType:CLOUDINARY_EVIDENCE_TYPE,publicId,format:format as PrivateImageFormat,contentType};
 if(result?.public_id!==publicId||result?.type!==CLOUDINARY_EVIDENCE_TYPE||result?.resource_type!=='image'||!isEvidenceRef(asset))
  throw new EvidenceProviderError(502,'Cloudinary chưa xác nhận ảnh được lưu ở chế độ authenticated.');
 return asset;
}
/** Time-limited download API request, proxied by GU. Browser never sees this URL. */
export function privateEvidenceDownloadUrl(asset:CloudinaryEvidenceRef,now=Math.floor(Date.now()/1000),c:EvidenceCredentials=privateEvidenceCredentials()):string{
 if(!isEvidenceRef(asset))throw new EvidenceProviderError(503,'Ảnh bảo mật chưa có thông tin lưu trữ hợp lệ.');
 const params={timestamp:now,public_id:asset.publicId,format:asset.format,type:CLOUDINARY_EVIDENCE_TYPE,expires_at:now+60};
 const qs=new URLSearchParams();
 for(const [k,v] of Object.entries(params))qs.set(k,String(v));
 qs.set('signature',cloudinarySignature(params,c.secret));qs.set('api_key',c.key);
 return `${apiUrl(c,'download')}?${qs.toString()}`;
}
export async function downloadAuthenticatedEvidence(asset:CloudinaryEvidenceRef,fetcher:typeof fetch=fetch):Promise<Buffer>{
 let response:Response;
 try{
  response=await fetcher(privateEvidenceDownloadUrl(asset),{cache:'no-store',redirect:'manual',signal:AbortSignal.timeout(20000)});
  // Cloudinary may redirect an authenticated download to its own delivery host.
  // Never automatically follow an arbitrary location (SSRF / data exfiltration).
  if([301,302,303,307,308].includes(response.status)){
   const location=response.headers.get('location');
   if(!location)throw new Error('Missing redirect location');
   const target=new URL(location);
   if(target.protocol!=='https:'||!['api.cloudinary.com','res.cloudinary.com'].includes(target.hostname)||target.username||target.password||target.port)
    throw new Error('Untrusted redirect hostname');
   response=await fetcher(target.toString(),{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000)});
  }
 }catch{throw new EvidenceProviderError(502,'Không tải được ảnh bảo mật từ Cloudinary.');}
 if(!response.ok)throw new EvidenceProviderError(response.status===404?404:502,'Cloudinary không thể cung cấp ảnh bảo mật.');
 const contentLength=Number(response.headers.get('content-length')||0);
 if(contentLength>CLOUDINARY_EVIDENCE_LIMIT+128000)throw new EvidenceProviderError(502,'Ảnh từ Cloudinary vượt kích thước an toàn.');
 const bytes=Buffer.from(await response.arrayBuffer());
 if(!bytes.length||bytes.length>CLOUDINARY_EVIDENCE_LIMIT+128000)throw new EvidenceProviderError(502,'Ảnh từ Cloudinary không hợp lệ.');
 const isJpg=bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff;
 const isPng=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
 const isWebp=bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';
 if(!(asset.contentType==='image/jpeg'&&isJpg||asset.contentType==='image/png'&&isPng||asset.contentType==='image/webp'&&isWebp))
  throw new EvidenceProviderError(502,'Nội dung ảnh bảo mật không khớp định dạng.');
 return bytes;
}
/** Compensating delete when Firestore metadata write fails; also usable by retention jobs. */
export async function destroyAuthenticatedEvidence(asset:CloudinaryEvidenceRef,fetcher:typeof fetch=fetch):Promise<void>{
 if(!isEvidenceRef(asset))throw new Error('Thông tin ảnh không hợp lệ.');
 const c=privateEvidenceCredentials();const timestamp=Math.floor(Date.now()/1000);
 const params={public_id:asset.publicId,type:CLOUDINARY_EVIDENCE_TYPE,invalidate:'true',timestamp};
 const body=new URLSearchParams();
 for(const [k,v] of Object.entries(params))body.set(k,String(v));
 body.set('api_key',c.key);body.set('signature',cloudinarySignature(params,c.secret));
 const res=await fetcher(apiUrl(c,'destroy'),{method:'POST',body,cache:'no-store',signal:AbortSignal.timeout(15000)});
 if(!res.ok)throw new Error(`Cloudinary authenticated destroy: ${res.status}`);
 const data=await res.json() as {result?:string};
 if(!['ok','not found'].includes(data.result||''))throw new Error('Cloudinary chưa xác nhận xóa ảnh.');
}
