import {NextRequest,NextResponse} from 'next/server';
import {staffUser,handleError,ApiError} from '@/lib/http';
import {db} from '@/lib/firebase-admin';
import {nextDay,tomorrowReturnRisk,vnClock} from '@/lib/return-risk';
import type {RentalOrder} from '@/lib/types';
import {cached,measureRoute,countQuery} from '@/lib/read-optimization';
export const runtime='nodejs';
export async function GET(req:NextRequest){return measureRoute('GET /api/v5/return-risk',async()=>{try{
 await staffUser(req);const now=new Date();const {today,hour}=vnClock(now);
 if(hour<17)return NextResponse.json({risks:[],checkedAt:now.toISOString()});
 const tomorrow=nextDay(today);
 async function loadAll(field:'status'|'pickupDate',value:string){
  const rows:RentalOrder[]=[];let last:import('firebase-admin/firestore').QueryDocumentSnapshot|undefined;
  for(let i=0;i<20;i++){
   let q=db().collection('orders').where(field,'==',value).limit(250);
   if(last)q=q.startAfter(last);
   const snap=countQuery(await q.get());rows.push(...snap.docs.map(d=>({id:d.id,...d.data()} as RentalOrder)));
   if(snap.size<250)return rows;
   last=snap.docs[snap.docs.length-1];
  }
  throw new ApiError(503,'Vượt 5.000 đơn trong cảnh báo; cần triển khai hàng đợi cảnh báo theo ngày.');
 }
 const [held,booked]=await cached('return-risk:'+tomorrow,120_000,()=>Promise.all([loadAll('status','PICKED_UP'),loadAll('pickupDate',tomorrow)]));
 const orders=[...new Map([...held,...booked].map(o=>[o.id,o])).values()];
 const risks=tomorrowReturnRisk(orders,now);
 return NextResponse.json({risks,checkedAt:now.toISOString(),truncated:false},{headers:{'Cache-Control':'private,no-store'}});
 }catch(e){return handleError(e,'GET /api/v5/return-risk');}});}
