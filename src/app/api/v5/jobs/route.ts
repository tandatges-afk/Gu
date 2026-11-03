import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/firebase-admin';
import {staffUser,handleError,ApiError} from '@/lib/http';
export const runtime='nodejs';
export async function GET(req:NextRequest){
 try{const me=await staffUser(req);
 const q=new URL(req.url).searchParams;const code=String(q.get('code')||'').trim().slice(0,48);
 if(code){const s=await db().collection('orders').where('code','==',code.toUpperCase()).limit(1).get();return NextResponse.json({jobs:s.docs.map(d=>({orderId:d.id,code:d.get('code'),stage:d.get('cancelReason')==='NO_SHOW'?'NO_SHOW':d.get('photoReviewStatus')==='PENDING'||d.get('returnStage')==='AWAITING_ADMIN'?'REVIEW':d.get('status')==='PICKED_UP'?'OUT':'HANDOVER'}))});}
 const stage=String(q.get('stage')||(me.role==='admin'?'REVIEW':'HANDOVER'));
 if(!['HANDOVER','OUT','REVIEW','NO_SHOW'].includes(stage))throw new ApiError(400,'Trạng thái không hợp lệ.');
 if(stage==='NO_SHOW'&&me.role!=='admin')throw new ApiError(403,'Chỉ Admin được xem đơn không đến lấy.');
 const snap=await db().collection('mobileJobs').where('stage','==',stage).limit(40).get();
 return NextResponse.json({jobs:snap.docs.map(d=>({id:d.id,...d.data()})),checkedAt:new Date().toISOString()},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return handleError(e,'GET /api/v5/jobs');}
}
