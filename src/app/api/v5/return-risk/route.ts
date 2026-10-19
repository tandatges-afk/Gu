import {NextRequest,NextResponse} from 'next/server';
import {staffUser,handleError} from '@/lib/http';
import {db} from '@/lib/firebase-admin';
import {nextDay,tomorrowReturnRisk,vnClock} from '@/lib/return-risk';
import type {RentalOrder} from '@/lib/types';
export const runtime='nodejs';
export async function GET(req:NextRequest){try{
 await staffUser(req);const now=new Date();const {today,hour}=vnClock(now);
 if(hour<17)return NextResponse.json({risks:[],checkedAt:now.toISOString()});
 const tomorrow=nextDay(today);
 const [held,booked]=await Promise.all([
  db().collection('orders').where('status','==','PICKED_UP').limit(300).get(),
  db().collection('orders').where('pickupDate','==',tomorrow).limit(300).get()
 ]);
 const orders=[...held.docs,...booked.docs].map(d=>({id:d.id,...d.data()} as RentalOrder));
 const risks=tomorrowReturnRisk(orders,now);
 return NextResponse.json({risks,checkedAt:now.toISOString(),truncated:held.size===300||booked.size===300},{headers:{'Cache-Control':'private,no-store'}});
 }catch(e){return handleError(e,'GET /api/v5/return-risk');}}
