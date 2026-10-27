import {NextRequest,NextResponse} from 'next/server';
import {readPhoto} from '@/lib/local-media';
import {staffUser,ApiError,handleError} from '@/lib/http';
import {db} from '@/lib/pg-firestore';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(req:NextRequest,ctx:{params:Promise<{parts:string[]}>}){
 try{
  const parts=(await ctx.params).parts;
  if(parts.length!==3)throw new ApiError(404,'Ảnh không tồn tại');
  const [dir,uid,file]=parts;
  if(dir!=='products'&&dir!=='inspections')throw new ApiError(404,'Ảnh không tồn tại');
  const match=/^([a-f0-9-]{36})\.(jpg|png|webp)$/.exec(file);
  if(!match)throw new ApiError(404,'Ảnh không tồn tại');
  if(dir==='inspections'){
   const me=await staffUser(req);
   const record=await db().collection('proofUploads').doc(match[1]).get();
   const info=record.data();
   if(!record.exists||info?.uid!==uid)throw new ApiError(404,'Ảnh không tồn tại');
   const order=await db().collection('orders').doc(String(info?.orderId||'')).get();
   if(!order.exists)throw new ApiError(404,'Không tìm thấy đơn');
   // Photo proof is accessible to the creator or administrator only.
   if(me.role!=='admin'&&order.data()?.createdBy!==me.uid&&info?.uid!==me.uid)throw new ApiError(403,'Không có quyền xem ảnh');
  }
  const bytes=await readPhoto(dir,uid,match[1],match[2]);
  return new NextResponse(new Uint8Array(bytes),{headers:{'Content-Type':match[2]==='jpg'?'image/jpeg':match[2]==='png'?'image/png':'image/webp','Cache-Control':dir==='products'?'public,max-age=86400':'private,no-store','X-Content-Type-Options':'nosniff'}});
 }catch(e){return handleError(e,'GET /api/local-media');}
}
