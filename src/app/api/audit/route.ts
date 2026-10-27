import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/firebase-admin';
import {staffUser,handleError,ApiError} from '@/lib/http';
export const runtime='nodejs';
export async function GET(req:NextRequest){
 try{
  const me=await staffUser(req);
  if(me.role!=='admin')throw new ApiError(403,'Chỉ Admin được xem nhật ký thao tác.');
  const token=new URL(req.url).searchParams.get('cursor');
  let q=db().collection('auditLogs').orderBy('createdAt','desc').limit(101);
  if(token){
   let id='';try{id=Buffer.from(token,'base64url').toString('utf8');}catch{}
   if(!/^[\w-]{10,128}$/.test(id))throw new ApiError(400,'Trang nhật ký không hợp lệ.');
   const last=await db().collection('auditLogs').doc(id).get();
   if(!last.exists)throw new ApiError(409,'Dữ liệu nhật ký đã thay đổi, tải lại từ đầu.');
   q=q.startAfter(last);
  }
  const snap=await q.get();const page=snap.docs.slice(0,100);const last=page.at(-1);
  return NextResponse.json({logs:page.map(d=>({id:d.id,...d.data()})),cursor:snap.size>100&&last?Buffer.from(last.id).toString('base64url'):null},
   {headers:{'Cache-Control':'private,no-store'}});
 }catch(e){return handleError(e,'GET /api/audit');}
}
