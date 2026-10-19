import {NextRequest,NextResponse} from 'next/server';
import {staffUser,handleError,ApiError} from '@/lib/http';
import {CLOUDINARY_FREE_CREDITS,metricUsage} from '@/lib/usage-metrics';
export const runtime='nodejs';
export const preferredRegion='sin1';
export const dynamic='force-dynamic';

type UsagePart={usage?:number;limit?:number};
type CloudinaryReport={source:'provider'|'unavailable';plan?:string;credits?:{used:number|null;limit:number|null};storage?:{used:number|null;limit:number|null};bandwidth?:{used:number|null;limit:number|null};transformations?:{used:number|null;limit:number|null};resources?:number|null;updatedAt?:string|null;freeReferenceCredits?:number;message?:string};
let cached:{at:number;value:CloudinaryReport}|null=null;
const TTL=5*60*1000;
async function cloudinaryReport():Promise<CloudinaryReport>{
 const {CLOUDINARY_CLOUD_NAME:cloud,CLOUDINARY_API_KEY:key,CLOUDINARY_API_SECRET:secret}=process.env;
 if(!cloud||!key||!secret)return {source:'unavailable',message:'Chưa cấu hình Cloudinary API.'};
 try{
  const response=await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloud)}/usage`,{
   headers:{Authorization:'Basic '+Buffer.from(`${key}:${secret}`).toString('base64')},
   cache:'no-store',signal:AbortSignal.timeout(8000)});
  if(!response.ok)throw new Error(`Cloudinary API HTTP ${response.status}`);
  const body=await response.json() as {plan?:string;last_updated?:string;credits?:UsagePart;storage?:UsagePart;bandwidth?:UsagePart;transformations?:UsagePart;resources?:number};
  const part=(value?:UsagePart)=>metricUsage(typeof value?.usage==='number'?value.usage:null,typeof value?.limit==='number'?value.limit:null);
  return {source:'provider',plan:body.plan||'Không rõ',credits:part(body.credits),storage:part(body.storage),bandwidth:part(body.bandwidth),transformations:part(body.transformations),resources:typeof body.resources==='number'?body.resources:null,updatedAt:body.last_updated||null,freeReferenceCredits:CLOUDINARY_FREE_CREDITS};
 }catch(error){return {source:'unavailable',message:error instanceof Error?error.message:'Không thể kết nối Cloudinary.'};}
}
export async function GET(req:NextRequest){
 try{
  const me=await staffUser(req);
  if(me.role!=='admin')throw new ApiError(403,'Chỉ Admin được xem thông tin hệ thống.');
  const refresh=req.nextUrl.searchParams.get('refresh')==='1';
  if(refresh||!cached||Date.now()-cached.at>TTL){cached={at:Date.now(),value:await cloudinaryReport()};}
  return NextResponse.json({cloudinary:cached.value,checkedAt:new Date(cached.at).toISOString(),cacheMinutes:TTL/60000},{headers:{'Cache-Control':'private, no-store'}});
 }catch(error){return handleError(error);}
}
