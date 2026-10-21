import {NextRequest,NextResponse} from 'next/server';
import {randomUUID} from 'node:crypto';
import {db} from '@/lib/firebase-admin';
import {staffUser,handleError,ApiError} from '@/lib/http';
import {evidenceBucket,validEvidenceId} from '@/lib/secure-evidence';
export const runtime='nodejs';export const preferredRegion='sin1';
const limits={reservation:3*1024*1024,deposit:3*1024*1024};
export async function POST(req:NextRequest){
 try{
  const me=await staffUser(req);
  const body=await req.formData();const f=body.get('file');const purpose=body.get('purpose');const draftId=body.get('draftId');
  if(purpose!=='reservation'&&purpose!=='deposit')throw new ApiError(400,'Loại ảnh không hợp lệ.');
  if(!(f instanceof File)||!f.size||f.size>limits[purpose])throw new ApiError(413,'Ảnh phải nhỏ hơn 3 MB.');
  if(typeof draftId!=='string'||!validEvidenceId(draftId))throw new ApiError(400,'Mã lượt chụp không hợp lệ.');
  if(!['image/jpeg','image/png','image/webp'].includes(f.type))throw new ApiError(400,'Chỉ hỗ trợ ảnh JPEG, PNG, WebP.');
  const bytes=Buffer.from(await f.arrayBuffer());
  const isJpg=bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff;
  const isPng=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const isWebp=bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';
  if(!(f.type==='image/jpeg'&&isJpg||f.type==='image/png'&&isPng||f.type==='image/webp'&&isWebp))throw new ApiError(400,'Dữ liệu ảnh không đúng định dạng.');
  const id=randomUUID();const ext=isJpg?'jpg':isPng?'png':'webp';const path=`gu/secure-evidence/${me.uid}/${id}.${ext}`;
  // Firebase Storage is private. Never issue public download tokens for CCCD, receipts or deposits.
  await evidenceBucket().file(path).save(bytes,{resumable:false,metadata:{contentType:f.type,cacheControl:'private,no-store'}});
  await db().collection('secureEvidenceUploads').doc(id).create({ownerUid:me.uid,purpose,draftId,path,contentType:f.type,createdAt:new Date().toISOString(),consumedOrderId:null});
  return NextResponse.json({id},{status:201,headers:{'Cache-Control':'no-store'}});
 }catch(e){return handleError(e,'POST /api/v5/secure-photo');}
}
export async function GET(req:NextRequest){
 try{
  await staffUser(req);const id=new URL(req.url).searchParams.get('id');
  if(!validEvidenceId(id))throw new ApiError(400,'Mã ảnh không hợp lệ.');
  const doc=await db().collection('secureEvidenceUploads').doc(id).get();
  if(!doc.exists||!doc.data()?.consumedOrderId)throw new ApiError(404,'Ảnh chưa thuộc đơn đã xác nhận.');
  const info=doc.data()!;const order=await db().collection('orders').doc(info.consumedOrderId).get();
  if(!order.exists)throw new ApiError(404,'Không tìm thấy đơn của ảnh.');
  const [bytes]=await evidenceBucket().file(info.path).download();
  return new NextResponse(new Uint8Array(bytes),{headers:{'Content-Type':info.contentType,'Cache-Control':'private,no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}});
 }catch(e){return handleError(e,'GET /api/v5/secure-photo');}
}
