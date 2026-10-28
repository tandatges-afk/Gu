import {NextRequest,NextResponse} from 'next/server';
import {staffUser,handleError,ApiError} from '@/lib/http';
import {db} from '@/lib/firebase-admin';
import {NEXT_DAY_RISK_START_HOUR_VN,nextDay,tomorrowReturnRisk,vnClock,overduePickupNotices} from '@/lib/return-risk';
import type {RentalOrder} from '@/lib/types';
export const runtime='nodejs';
export async function GET(req:NextRequest){try{
 await staffUser(req);const now=new Date();const {today,hour}=vnClock(now);
 const warnNextDay=hour>=NEXT_DAY_RISK_START_HOUR_VN;
 const tomorrow=nextDay(today);
 async function loadAll(field:'status'|'pickupDate',value:string){
  const rows:RentalOrder[]=[];let last:import('@/lib/pg-firestore').DocumentSnapshot|undefined;
  for(let i=0;i<20;i++){
   let q=db().collection('orders').where(field,'==',value).limit(250);
   if(last)q=q.startAfter(last);
   const snap=await q.get();rows.push(...snap.docs.map(d=>({id:d.id,...d.data()} as RentalOrder)));
   if(snap.size<250)return rows;
   last=snap.docs[snap.docs.length-1];
  }
  throw new ApiError(503,'Vượt 5.000 đơn trong cảnh báo; cần triển khai hàng đợi cảnh báo theo ngày.');
 }
 // Overdue pickups are independent of the 20:00 next-day stock risk threshold.
 const [reservations,held]=await Promise.all([
  loadAll('status','RESERVED'),
  warnNextDay?loadAll('status','PICKED_UP'):Promise.resolve([] as RentalOrder[])
 ]);
 const booked=warnNextDay?reservations.filter(o=>o.pickupDate===tomorrow):[];
 const latePickups=overduePickupNotices(reservations,now);
 const orders=[...new Map([...held,...booked].map(o=>[o.id,o])).values()];
 const risks=warnNextDay?tomorrowReturnRisk(orders,now):[];
 return NextResponse.json({risks,latePickups,checkedAt:now.toISOString(),truncated:false},{headers:{'Cache-Control':'private,no-store'}});
 }catch(e){return handleError(e,'GET /api/v5/return-risk');}}
