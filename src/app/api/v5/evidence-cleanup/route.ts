import {NextRequest,NextResponse} from 'next/server';
import {staffUser,requireAdmin,handleError,ApiError} from '@/lib/http';
import {runEvidenceCleanup} from '@/lib/evidence-retention';
import {runSensitiveEvidenceCleanup,queueReviewedEvidenceBackfill} from '@/lib/sensitive-evidence-cleanup';
import {db} from '@/lib/firebase-admin';
import type {RentalOrder} from '@/lib/types';
import {noShowExpired} from '@/lib/gu-v52-workflow';
import {removeOrderIntervals} from '@/lib/v5-server';
export const runtime='nodejs';
/** Cron-only, idempotent, race-safe no-show transition. Never touches cash journals.
 * The paid booking's returnAt is its expiration deadline (24h/48h/etc).
 * Keep data and audit trail; clear dated locks only inside the PG transaction.
 */
async function closeExpiredNoShows(){
 const list=await db().collection('orders').where('status','==','RESERVED').get();
 const now=new Date().toISOString();
 const candidates=list.docs.filter(doc=>noShowExpired({id:doc.id,...doc.data()} as RentalOrder,Date.parse(now))).slice(0,100);
 let closed=0;
 for(const candidate of candidates){
  const ref=db().collection('orders').doc(candidate.id);
  const job=db().collection('mobileJobs').doc(candidate.id);
  await db().runTransaction(async tx=>{
   const snap=await tx.get(ref);
   if(!snap.exists)return;
   const order={id:snap.id,...snap.data()} as RentalOrder;
   if(!noShowExpired(order,Date.parse(now)))return;
   const release=await removeOrderIntervals(tx,order);
   tx.update(ref,{status:'CANCELLED',cancelReason:'NO_SHOW',cancelledAt:now,updatedAt:now,
    history:[...order.history,{action:'AUTO_NO_SHOW',at:now,by:'system',
      detail:'Khách không đến lấy trước khi kết thúc thời hạn gói thuê đã đặt. Giữ nguyên tiền và ảnh chứng từ để Admin đối soát.'}]});
   tx.set(job,{stage:'NO_SHOW',orderId:order.id,code:order.code,customerName:order.customerName,updatedAt:now},{merge:true});
   release?.();closed++;
  });
 }
 return {closed,examined:list.docs.length,pending:Math.max(0,candidates.length-closed)};
}

export async function POST(req:NextRequest){
 try{const me=await staffUser(req);requireAdmin(me);await queueReviewedEvidenceBackfill();return NextResponse.json({noShow:await closeExpiredNoShows(),inspections:await runEvidenceCleanup(10),sensitive:await runSensitiveEvidenceCleanup(10)},{headers:{'Cache-Control':'no-store'}});}catch(e){return handleError(e);}
}
export async function GET(req:NextRequest){
 try{
  const secret=process.env.CRON_SECRET;
  if(!secret||req.headers.get('authorization')!==`Bearer ${secret}`)throw new ApiError(401,'Cron secret không hợp lệ.');
  await queueReviewedEvidenceBackfill();return NextResponse.json({noShow:await closeExpiredNoShows(),inspections:await runEvidenceCleanup(15),sensitive:await runSensitiveEvidenceCleanup(15)},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return handleError(e);}
}
