import {NextRequest,NextResponse} from 'next/server';
import {staffUser,requireAdmin,handleError,ApiError} from '@/lib/http';
import {cloudinarySecureAuthHeader,cloudinarySecureConfig,deleteSecureCloudinary,diagnosticEvidenceId,uploadSecureCloudinary} from '@/lib/cloudinary-secure';
export const runtime='nodejs';
export const preferredRegion='sin1';
export async function GET(req:NextRequest){
 try{
  const me=await staffUser(req);requireAdmin(me);
  const {name}=cloudinarySecureConfig();
  let response:Response;
  try{response=await fetch(`https://api.cloudinary.com/v1_1/${name}/usage`,{headers:{Authorization:cloudinarySecureAuthHeader()},cache:'no-store',signal:AbortSignal.timeout(15000)});}
  catch{throw new ApiError(503,'Không kết nối được Cloudinary.');}
  if(!response.ok)throw new ApiError(503,`Cloudinary từ chối xác thực API (${response.status}). Kiểm tra Cloud name / API key / API secret.`);
  return NextResponse.json({ok:true,provider:'cloudinary',bucket:'authenticated',location:null,projectId:name,writeVerified:false},{headers:{'Cache-Control':'private,no-store'}});
 }catch(error){return handleError(error,'GET /api/v5/storage-health');}
}
export async function POST(req:NextRequest){
 try{
  const me=await staffUser(req);requireAdmin(me);
  const {name}=cloudinarySecureConfig();
  // Minimal 1x1 PNG: test Cloudinary authenticated upload AND deletion, never customer files.
  const testPng=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==','base64');
  const id=diagnosticEvidenceId();
  const stored=await uploadSecureCloudinary(testPng,'image/png',me.uid,id);
  try{await deleteSecureCloudinary(stored.publicId);}
  catch(error){console.error('[GU_CLOUDINARY_DIAGNOSTIC_ORPHAN]',id);throw error;}
  return NextResponse.json({ok:true,provider:'cloudinary',bucket:'authenticated',location:null,projectId:name,writeVerified:true},{headers:{'Cache-Control':'private,no-store'}});
 }catch(error){return handleError(error,'POST /api/v5/storage-health');}
}
