import {NextRequest,NextResponse} from 'next/server';
import {randomUUID} from 'node:crypto';
import {db} from '@/lib/firebase-admin';
import {staffUser,handleError,ApiError} from '@/lib/http';
import {validEvidenceId} from '@/lib/secure-evidence';
import {uploadSecureCloudinary,downloadSecureCloudinary,deleteSecureCloudinary,securePhotoPublicId,type SecureCloudinaryImage} from '@/lib/cloudinary-secure';
export const runtime='nodejs';export const preferredRegion='sin1';
const limits={reservation:3*1024*1024,deposit:3*1024*1024};
const validMime=['image/jpeg','image/png','image/webp'];
function canReadEvidence(me:{uid:string;role:string},order:Record<string,unknown>){
 if(me.role==='admin')return true;
 const proofBy=(field:'handoverProof'|'returnProof')=>(order[field] as {by?:unknown}|undefined)?.by;
 // Staff members without a link to the order must not read customer documents.
 return order.createdBy===me.uid||proofBy('handoverProof')===me.uid||proofBy('returnProof')===me.uid;
}
export async function POST(req:NextRequest){
 try{
  const me=await staffUser(req);
  if(Number(req.headers.get('content-length')||0)>3*1024*1024)throw new ApiError(413,'Ảnh tối đa 3 MB.');
  const purpose=req.headers.get('x-gu-upload-purpose'),draftId=req.headers.get('x-gu-draft-id');
  const type=String(req.headers.get('content-type')||'').toLowerCase();
  if(purpose!=='reservation'&&purpose!=='deposit')throw new ApiError(400,'Loại ảnh không hợp lệ.');
  if(!validEvidenceId(draftId))throw new ApiError(400,'Mã lượt chụp không hợp lệ.');
  if(!validMime.includes(type))throw new ApiError(400,'Chỉ hỗ trợ ảnh JPEG, PNG, WebP.');
  const bytes=Buffer.from(await req.arrayBuffer());
  if(!bytes.length||bytes.length>limits[purpose])throw new ApiError(413,'Ảnh tối đa 3 MB.');
  const isJpg=bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff;
  const isPng=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const isWebp=bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';
  if(!(type==='image/jpeg'&&isJpg||type==='image/png'&&isPng||type==='image/webp'&&isWebp))throw new ApiError(400,'Dữ liệu ảnh không đúng định dạng.');
  const id=randomUUID();
  const stored=await uploadSecureCloudinary(bytes,type,me.uid,id);
  try{
   await db().collection('secureEvidenceUploads').doc(id).create({ownerUid:me.uid,purpose,draftId,provider:'local',publicId:stored.publicId,format:stored.format,contentType:type,createdAt:new Date().toISOString(),consumedOrderId:null});
  }catch(error){
   // Keep the DB failure as the primary error; try to remove the unreferenced authenticated image.
   try{await deleteSecureCloudinary(stored.publicId);}catch{console.error('[GU_LOCAL_ORPHAN_CLEANUP_FAILED]',id);}
   throw error;
  }
  return NextResponse.json({id},{status:201,headers:{'Cache-Control':'no-store'}});
 }catch(error){return handleError(error,'POST /api/v5/secure-photo');}
}
export async function GET(req:NextRequest){
 try{
  const me=await staffUser(req),id=new URL(req.url).searchParams.get('id');
  if(!validEvidenceId(id))throw new ApiError(400,'Mã ảnh không hợp lệ.');
  const snap=await db().collection('secureEvidenceUploads').doc(id).get(),info=snap.data();
  if(!snap.exists||!info?.consumedOrderId)throw new ApiError(404,'Ảnh chưa thuộc đơn đã xác nhận.');
  const order=await db().collection('orders').doc(info.consumedOrderId).get();
  if(!order.exists)throw new ApiError(404,'Không tìm thấy đơn của ảnh.');
  if(['DELETING','PURGED'].includes(String(order.data()?.sensitiveEvidenceStatus||''))||order.data()?.photoReviewStatus==='REVIEWED'||order.data()?.reviewedAt||['CANCELLED','VOIDED'].includes(String(order.data()?.status||'')))throw new ApiError(410,'Ảnh đã hết thời hạn lưu giữ sau khi duyệt.');
  if(!canReadEvidence(me,order.data()||{}))throw new ApiError(403,'Bạn không có quyền xem chứng từ của đơn này.');
  let bytes:Buffer;
  if(info.provider==='local'){
   if(info.publicId!==securePhotoPublicId(info.ownerUid,id)||!['jpg','png','webp'].includes(info.format))throw new ApiError(409,'Chứng từ có đường dẫn không hợp lệ.');
   const image:SecureCloudinaryImage={provider:'local',publicId:info.publicId,format:info.format,contentType:info.contentType};
   bytes=await downloadSecureCloudinary(image);
  }else if(typeof info.path==='string'){
   throw new ApiError(503,'Ảnh lưu trên Firebase cũ phải được chuyển dữ liệu trước khi xem trên VPS.');
  }else throw new ApiError(404,'Không tìm thấy tệp của chứng từ.');
  const type=validMime.includes(info.contentType)?info.contentType:'application/octet-stream';
  return new NextResponse(new Uint8Array(bytes),{headers:{'Content-Type':type,'Cache-Control':'private,no-store,max-age=0','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox",'X-Robots-Tag':'noindex, nofollow'}});
 }catch(error){return handleError(error,'GET /api/v5/secure-photo');}
}
