import {NextRequest,NextResponse} from 'next/server';
import {FieldPath} from 'firebase-admin/firestore';
import {db} from '@/lib/firebase-admin';
import {staffUser,handleError,ApiError} from '@/lib/http';
export const runtime='nodejs';
export const preferredRegion='sin1';
export async function GET(req:NextRequest){
 try{
  await staffUser(req);
  const u=new URL(req.url),status=u.searchParams.get('status')||'';
  if(!['LAUNDRY','MISSING','MAINTENANCE','RENTED','AVAILABLE'].includes(status))throw new ApiError(400,'Trạng thái kho không hợp lệ.');
  const last=String(u.searchParams.get('cursor')||'');
  if(last&&!/^[a-zA-Z0-9]{10,64}$/.test(last))throw new ApiError(400,'Trang kho không hợp lệ.');
  let query=db().collection('items').where('status','==',status).orderBy(FieldPath.documentId()).limit(101);
  if(last)query=query.startAfter(last);
  const snapshot=await query.get();const docs=snapshot.docs.slice(0,100);
  return NextResponse.json({items:docs.filter(d=>!d.data().archivedAt).map(d=>({id:d.id,...d.data()})),
    cursor:snapshot.size>100?docs.at(-1)?.id:null},{headers:{'Cache-Control':'private, no-store'}});
 }catch(e){return handleError(e);}
}
