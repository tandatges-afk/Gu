import {NextRequest,NextResponse} from 'next/server';
import {randomUUID} from 'node:crypto';
import {db} from '@/lib/firebase-admin';
import {staffUser,handleError,ApiError} from '@/lib/http';
import {storePrivateEvidence,deleteUnattachedEvidence,readPrivateEvidenceDocument,validEvidenceId} from '@/lib/secure-evidence';
import {CLOUDINARY_EVIDENCE_LIMIT} from '@/lib/cloudinary-private-evidence';
export const runtime='nodejs';export const preferredRegion='sin1';
export async function POST(req:NextRequest){
 try{
  const me=await staffUser(req);
  const contentLength=Number(req.headers.get('content-length')||0);
  if(contentLength>CLOUDINARY_EVIDENCE_LIMIT+64_000)throw new ApiError(413,'Ảnh phải nhỏ hơn 3 MB.');
  const body=await req.formData();const f=body.get('file');const purpose=body.get('purpose');const draftId=body.get('draftId');
  if(purpose!=='reservation'&&purpose!=='deposit')throw new ApiError(400,'Loại ảnh không hợp lệ.');
  if(!(f instanceof File)||!f.size||f.size>CLOUDINARY_EVIDENCE_LIMIT)throw new ApiError(413,'Ảnh phải nhỏ hơn 3 MB.');
  if(typeof draftId!=='string'||!validEvidenceId(draftId))throw new ApiError(400,'Mã lượt chụp không hợp lệ.');
  if(!['image/jpeg','image/png','image/webp'].includes(f.type))throw new ApiError(400,'Chỉ hỗ trợ ảnh JPEG, PNG, WebP.');
  const bytes=Buffer.from(await f.arrayBuffer());
  const isJpg=bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff;
  const isPng=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const isWebp=bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';
  if(!(f.type==='image/jpeg'&&isJpg||f.type==='image/png'&&isPng||f.type==='image/webp'&&isWebp))throw new ApiError(400,'Dữ liệu ảnh không đúng định dạng.');
  const id=randomUUID();
  // Only authenticated Cloudinary assets; API returns an opaque UUID (never the vendor URL).
  const asset=await storePrivateEvidence(bytes,f.type,me.uid,id);
  try{
   await db().collection('secureEvidenceUploads').doc(id).create({ownerUid:me.uid,purpose,draftId,asset,contentType:f.type,createdAt:new Date().toISOString(),consumedOrderId:null});
  }catch(e){
   try{await deleteUnattachedEvidence(asset);}catch(cleanupError){console.error('Failed to roll back Cloudinary secure evidence:',id,cleanupError);}
   throw e;
  }
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
  // Restricted to staff currently authorized for GU; never send the Cloudinary URL to the browser.
  const bytes=await readPrivateEvidenceDocument(info);
  return new NextResponse(new Uint8Array(bytes),{headers:{'Content-Type':info.contentType,'Cache-Control':'private,no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox",'Referrer-Policy':'no-referrer'}});
 }catch(e){return handleError(e,'GET /api/v5/secure-photo');}
}
