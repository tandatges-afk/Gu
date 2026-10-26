import {NextRequest,NextResponse} from 'next/server';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {rows} from '@/lib/db';
import {me,admin,fail,uuid,HttpError} from '@/lib/security';
export const runtime='nodejs';
export async function GET(req:NextRequest,ctx:{params:Promise<{id:string}>}){try{const user=await me(req),id=uuid((await ctx.params).id);const [asset]=await rows<{mime:string;file_key:string;kind:string}>('SELECT mime,file_key,kind FROM media_assets WHERE id=$1',[id]);if(!asset)throw new HttpError(404,'Không tìm thấy ảnh');if(asset.kind==='EVIDENCE')admin(user);const root=process.env.GU_UPLOAD_DIR;if(!root||!path.isAbsolute(root))throw new HttpError(500,'Chưa cấu hình đường dẫn ảnh');const content=await readFile(path.join(root,asset.file_key)).catch(()=>{throw new HttpError(404,'Ảnh không tồn tại');});return new NextResponse(new Uint8Array(content),{headers:{'Content-Type':asset.mime,'Content-Disposition':'inline','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});}catch(e){return fail(e);}}
