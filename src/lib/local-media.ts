import 'server-only';
import {mkdir,writeFile,readFile,unlink,stat,readdir} from 'node:fs/promises';
import {join,resolve,sep,dirname} from 'node:path';
import {ApiError} from './http';
const base=()=>process.env.GU_UPLOAD_DIR||'/var/lib/gu/uploads';
const validUid=(s:string)=>/^[A-Za-z0-9_-]{10,128}$/.test(s);
const validUUID=(s:string)=>/^[a-f0-9-]{36}$/.test(s);
const validExtension=(s:string)=>['jpg','png','webp'].includes(s);
function safePath(dir:string,uid:string,file:string){
 if(!validUid(uid)||!/^[-a-f0-9]{36}\.(?:jpg|png|webp)$/.test(file))throw new ApiError(400,'Đường dẫn ảnh không hợp lệ.');
 const root=resolve(base(),dir);const target=resolve(root,uid,file);
 if(!target.startsWith(root+sep))throw new ApiError(400,'Đường dẫn ảnh không hợp lệ.');return target;
}
function extension(type:string){const ext=type==='image/jpeg'?'jpg':type==='image/png'?'png':type==='image/webp'?'webp':'';if(!ext)throw new ApiError(400,'Định dạng ảnh không hợp lệ');return ext;}
export async function savePhoto(dir:'products'|'inspections'|'secure',uid:string,id:string,bytes:Buffer,mime:string){
 if(!validUUID(id)||!validUid(uid))throw new ApiError(400,'Mã ảnh không hợp lệ');
 const file=id+'.'+extension(mime),target=safePath(dir,uid,file);
 if(!bytes.length||bytes.length>3*1024*1024)throw new ApiError(413,'Ảnh phải từ 1 byte đến 3 MB');
 // Derive the upload directory from the validated absolute target. Avoid dynamically
 // joining the runtime GU_UPLOAD_DIR: Turbopack may trace the entire project.
 const uploadFolder=dirname(target);
 await mkdir(/* turbopackIgnore: true */ uploadFolder,{recursive:true,mode:0o700});
 await writeFile(/* turbopackIgnore: true */ target,bytes,{flag:'wx',mode:0o600});
 return {path:target,filename:file};
}
export async function readPhoto(dir:'products'|'inspections'|'secure',uid:string,id:string,ext:string){
 if(!validUUID(id)||!validExtension(ext))throw new ApiError(400,'Mã ảnh không hợp lệ');
 const file=id+'.'+ext;const target=safePath(dir,uid,file);
 try{return await readFile(/* turbopackIgnore: true */ target);}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')throw new ApiError(404,'Ảnh không tồn tại');throw e;}
}
export async function deletePhoto(dir:'products'|'inspections'|'secure',uid:string,id:string,ext:string){
 if(!validUUID(id)||!validExtension(ext))throw new ApiError(400,'Mã ảnh không hợp lệ');
 const target=safePath(dir,uid,id+'.'+ext);
 try{await unlink(/* turbopackIgnore: true */ target);}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
}
export async function deleteByURL(url:string){
 const found=/^\/api\/local-media\/(products|inspections)\/([A-Za-z0-9_-]{10,128})\/([a-f0-9-]{36})\.(jpg|png|webp)$/.exec(url);
 if(!found)throw new ApiError(400,'Không xóa đường dẫn ảnh chưa được xác minh trên VPS.');
 await deletePhoto(found[1] as 'products'|'inspections',found[2],found[3],found[4]);
}
export async function mediaStats(){
 async function walk(dir:string):Promise<{bytes:number;count:number}>{
  let bytes=0,count=0;try{for(const e of await readdir(/* turbopackIgnore: true */ dir,{withFileTypes:true})){
   if(e.isSymbolicLink())continue;const next=join(dir,e.name);if(e.isDirectory()){const v=await walk(next);bytes+=v.bytes;count+=v.count;}
   else if(e.isFile()){const s=await stat(/* turbopackIgnore: true */ next);bytes+=s.size;count++;}
  }}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}return {bytes,count};
 }
 return walk(base());
}
