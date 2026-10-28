import {NextRequest,NextResponse} from 'next/server';
import {staffUser,handleError,ApiError} from '@/lib/http';
import {mediaStats} from '@/lib/local-media';
import {statfs} from 'node:fs/promises';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(req:NextRequest){
 try{const me=await staffUser(req);if(me.role!=='admin')throw new ApiError(403,'Chỉ Admin được xem thông tin hệ thống.');
  const data=await mediaStats(),disk=await statfs('/'),now=new Date().toISOString();
  const total=disk.blocks*disk.bsize,free=disk.bavail*disk.bsize;
  const diskUsage={used:total-free,limit:total,free};
  return NextResponse.json({vps:{disk:diskUsage,mediaBytes:data.bytes,mediaFiles:data.count},cloudinary:{source:'provider',plan:'GU VPS nội bộ',storage:{used:data.bytes,limit:null},bandwidth:{used:null,limit:null},transformations:{used:null,limit:null},credits:{used:null,limit:null},resources:data.count,updatedAt:now},checkedAt:now,cacheMinutes:0},{headers:{'Cache-Control':'private,no-store'}});
 }catch(e){return handleError(e);}
}
