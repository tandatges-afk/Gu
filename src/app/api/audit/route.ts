import { NextRequest,NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { staffUser,handleError,ApiError } from '@/lib/http';
export const runtime='nodejs';
export async function GET(req:NextRequest) {
  try{
    const me=await staffUser(req);
    if(me.role!=='admin')throw new ApiError(403,'Chỉ Admin được xem nhật ký thao tác.');
    const snap=await db().collection('auditLogs').orderBy('createdAt','desc').limit(200).get();
    return NextResponse.json({logs:snap.docs.map(d=>({id:d.id,...d.data()}))},{headers:{'Cache-Control':'no-store'}});
  }catch(e){return handleError(e);}
}
