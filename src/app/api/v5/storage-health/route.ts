import {NextRequest,NextResponse} from 'next/server';
import {randomUUID} from 'node:crypto';
import {staffUser,requireAdmin,handleError,ApiError} from '@/lib/http';
import {evidenceBucket} from '@/lib/secure-evidence';
import {classifyStorageFailure} from '@/lib/secure-storage-errors';
export const runtime='nodejs';
export const preferredRegion='sin1';

// Tests the deployed bucket without returning secrets, object paths, or private data.
function storageError(err:unknown,operation:'metadata'|'upload'|'delete'):never{
 const issue=classifyStorageFailure(err,operation);
 if(issue)throw new ApiError(issue.status,issue.message,{code:issue.code});
 throw err;
}
export async function GET(req:NextRequest){
 try{
  const me=await staffUser(req);requireAdmin(me);
  const bucket=evidenceBucket();
  const [metadata]=await bucket.getMetadata().catch(error=>storageError(error,'metadata'));
  return NextResponse.json({ok:true,bucket:metadata?.name||bucket.name,location:metadata?.location||null,projectId:process.env.FIREBASE_PROJECT_ID||null,writeVerified:false},{headers:{'Cache-Control':'private,no-store'}});
 }catch(error){return handleError(error,'GET /api/v5/storage-health');}
}
export async function POST(req:NextRequest){
 try{
  const me=await staffUser(req);requireAdmin(me);
  const bucket=evidenceBucket();
  const object=bucket.file(`gu/diagnostics/${randomUUID()}.txt`);
  let saved=false;
  try{
   try{await object.save(Buffer.from('gu-private-storage-health'),{resumable:false,metadata:{contentType:'text/plain',cacheControl:'private,no-store'}});saved=true;}
   catch(error){storageError(error,'upload');}
  }finally{
   if(saved){try{await object.delete({ignoreNotFound:true});}catch(error){storageError(error,'delete');}}
  }
  return NextResponse.json({ok:true,bucket:bucket.name,location:null,projectId:process.env.FIREBASE_PROJECT_ID||null,writeVerified:true},{headers:{'Cache-Control':'private,no-store'}});
 }catch(error){return handleError(error,'POST /api/v5/storage-health');}
}
