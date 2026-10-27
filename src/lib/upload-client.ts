/** Raw image upload: avoid multipart POST being interpreted by Next.js as an MPA Server Action. */
export async function uploadImageToApi(
 path:'/api/uploads'|'/api/v5/secure-photo',
 image:File,
 token:string,
 meta:{purpose:'product'|'handover'|'return'|'reservation'|'deposit';orderId?:string;draftId?:string}
):Promise<Record<string,unknown>>{
 const response=await fetch(path,{
  method:'POST',credentials:'same-origin',cache:'no-store',
  headers:{'Content-Type':image.type,'Authorization':'Bearer '+token,'X-GU-Upload-Purpose':meta.purpose,
   ...(meta.orderId?{'X-GU-Order-Id':meta.orderId}:{}),
   ...(meta.draftId?{'X-GU-Draft-Id':meta.draftId}:{})},
  body:image
 });
 const text=await response.text();let data:Record<string,unknown>={};
 try{const parsed=JSON.parse(text) as unknown;if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))data=parsed as Record<string,unknown>;}catch{}
 if(!response.ok){
  if(/Server Action unavailable|Failed to find Server Action/i.test(text))throw Error('Phiên website đã thay đổi. Hãy tải lại trang (Ctrl+F5) rồi tải ảnh lại.');
  throw Error(typeof data.error==='string'?data.error:`Không thể tải ảnh (HTTP ${response.status}).`);
 }
 if(!Object.keys(data).length)throw Error('Máy chủ trả phản hồi tải ảnh không hợp lệ. Hãy kiểm tra Nginx/Next.js.');
 return data;
}
