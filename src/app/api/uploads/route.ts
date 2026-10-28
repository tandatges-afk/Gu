import {NextRequest,NextResponse} from 'next/server';
import {staffUser,handleError,ApiError,boundedUploadBytes} from '@/lib/http';
import {db} from '@/lib/pg-firestore';
import {simpleId} from '@/lib/v5-server';
import {imageMagicMatches} from '@/lib/cloudinary-images';
import {savePhoto,deletePhoto} from '@/lib/local-media';
import {reserveUploadBudget} from '@/lib/upload-budget';
import {randomUUID} from 'node:crypto';
export const runtime='nodejs';
export async function POST(req:NextRequest){
 try{
  const me=await staffUser(req);
  if(Number(req.headers.get('content-length')||0)>3*1024*1024)throw new ApiError(413,'Ảnh tối đa 3 MB');
  const type=String(req.headers.get('content-type')||'').toLowerCase();
  if(!['image/jpeg','image/png','image/webp'].includes(type))throw new ApiError(400,'Chỉ hỗ trợ ảnh JPEG, PNG, WebP');
  const bytes=await boundedUploadBytes(req);
  if(!bytes.length||bytes.length>3*1024*1024)throw new ApiError(413,'Ảnh tối đa 3 MB');
  if(!imageMagicMatches(new Uint8Array(bytes.subarray(0,16)),type))throw new ApiError(400,'Ảnh không đúng định dạng');
  const purpose=String(req.headers.get('x-gu-upload-purpose')||'product'),orderId=String(req.headers.get('x-gu-order-id')||'');
  if(!['product','handover','return'].includes(purpose))throw new ApiError(400,'Loại ảnh không hợp lệ');
  if(purpose!=='product'){
   if(!simpleId(orderId))throw new ApiError(400,'Mã đơn không hợp lệ');
   const order=await db().collection('orders').doc(orderId).get();
   if(!order.exists||!order.data()?.pricingVersion||['RETURNED','CANCELLED','VOIDED'].includes(String(order.data()?.status)))throw new ApiError(409,'Đơn không nhận ảnh này');
   if(purpose==='handover'&&order.data()?.status!=='RESERVED'&&!(order.data()?.status==='PICKED_UP'&&Array.isArray(order.data()?.pendingExtraItemIds)&&(order.data()!.pendingExtraItemIds as unknown[]).length))throw new ApiError(409,'Đơn không còn chờ giao');
   if(purpose==='return'&&order.data()?.status!=='PICKED_UP')throw new ApiError(409,'Đơn không chờ trả');
  }
  await reserveUploadBudget(me.uid,me.role,bytes.byteLength);
  const id=randomUUID(),ext=type==='image/png'?'png':type==='image/webp'?'webp':'jpg';
  const dir=purpose==='product'?'products':'inspections';
  await savePhoto(dir,me.uid,id,bytes,type);
  const url=`/api/local-media/${dir}/${me.uid}/${id}.${ext}`;
  if(purpose!=='product')try{await db().collection('proofUploads').doc(id).create({url,uid:me.uid,orderId,phase:purpose,createdAt:new Date().toISOString()});}
  catch(error){await deletePhoto(dir,me.uid,id,ext);throw error;}
  return NextResponse.json({path:url},{status:201});
 }catch(e){return handleError(e,'POST /api/uploads');}
}
