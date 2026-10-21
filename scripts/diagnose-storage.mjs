/** GU private Cloudinary diagnostic. No Firebase Storage or Blaze required.
 * Read-only by default; --write-test uploads and deletes one 1x1 dummy PNG.
 */
import {randomUUID} from 'node:crypto';
const name=(process.env.CLOUDINARY_CLOUD_NAME||'').trim();
const key=(process.env.CLOUDINARY_API_KEY||'').trim();
const secret=(process.env.CLOUDINARY_API_SECRET||'').trim();
if(!/^[a-zA-Z0-9_-]+$/.test(name)||!key||!secret){console.error('Thiếu CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET.');process.exit(1);}
const auth='Basic '+Buffer.from(`${key}:${secret}`).toString('base64');
const base=`https://api.cloudinary.com/v1_1/${name}`;
const request=async(url,options={})=>fetch(url,{...options,headers:{...options.headers,Authorization:auth},cache:'no-store',signal:AbortSignal.timeout(25000)});
let exitCode=0;
try{
 const r=await request(`${base}/usage`);
 if(!r.ok)throw new Error(`Cloudinary API từ chối xác thực hoặc quota (${r.status}).`);
 console.log('CLOUDINARY_PRIVATE_CONFIG_OK: API credentials hợp lệ; không cần Firebase Storage/Blaze.');
 if(process.argv.includes('--write-test')){
  const id=randomUUID(),uid='diagnostic',publicId=`gu/secure-evidence/${uid}/${id}`;
  const image=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4//8/AAX+Av4N70a4AAAAAElFTkSuQmCC','base64');
  const form=new FormData();form.set('file',new Blob([image],{type:'image/png'}),'test.png');form.set('public_id',publicId);form.set('type','authenticated');form.set('overwrite','false');
  const upload=await request(`${base}/image/upload`,{method:'POST',body:form});
  if(!upload.ok)throw new Error(`Tải ảnh bảo mật thử thất bại (${upload.status}).`);
  const saved=await upload.json();
  if(saved.public_id!==publicId||saved.type!=='authenticated')throw new Error('Cloudinary không xác nhận authenticated. Kiểm tra Media Access.');
  const query=new URLSearchParams();query.append('public_ids[]',publicId);
  const del=await request(`${base}/resources/image/authenticated?${query}`,{method:'DELETE'});
  if(!del.ok)throw new Error(`Đã tạo ảnh thử nhưng xóa không thành công (${del.status}). Cần xóa thủ công trong Cloudinary: ${publicId}`);
  const deleted=await del.json();
  if(!['deleted','not_found'].includes(deleted.deleted?.[publicId]||''))throw new Error(`Cloudinary chưa xác nhận xóa ảnh thử: ${publicId}`);
  console.log('CLOUDINARY_PRIVATE_WRITE_DELETE_OK: authenticated upload + delete thành công.');
 }
}catch(e){console.error('GU CLOUDINARY CHECK FAILED:',e instanceof Error?e.message:'Không rõ nguyên nhân');exitCode=1;}
process.exitCode=exitCode;
