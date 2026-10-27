import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/firebase-admin';
import {staffUser,handleError,jsonBody,ApiError} from '@/lib/http';
import {vnDayKey} from '@/lib/hourly-pricing';
import {vietnamDayPlus,visualUpcomingForItem,type VisualAvailabilityState} from '@/lib/visual-availability';
import type {InventoryItem,RentalOrder,ItemStatus} from '@/lib/types';
export const runtime='nodejs';
export const preferredRegion='sin1';
/** Only the twelve matching image candidates are read. No customer names, phones or payment data leave the server. */
export async function POST(req:NextRequest){
 try{
  await staffUser(req);
  const body=await jsonBody(req);
  const ids=body.itemIds;
  if(!Array.isArray(ids)||ids.length<1||ids.length>12||ids.some(id=>typeof id!=='string'||!/^[\w-]{10,128}$/.test(id))||new Set(ids).size!==ids.length)
   throw new ApiError(400,'Chỉ tra trạng thái tối đa 12 sản phẩm hợp lệ mỗi lượt.');
  const now=new Date(),today=vnDayKey(now.toISOString());
  const days=Array.from({length:7},(_,i)=>vietnamDayPlus(today,i));
  const itemSnaps=await db().getAll(...(ids as string[]).map(id=>db().collection('items').doc(id)));
  const validItems=itemSnaps.filter(s=>s.exists&&!s.data()?.archivedAt).map(s=>({id:s.id,...s.data()} as InventoryItem));
  // Find both legacy day locks and the hourly reservation interval index.
  const hourlyRefs=validItems.flatMap(item=>days.map(day=>db().collection('v5DayIntervals').doc(item.id+'_'+day)));
  const legacyRefs=validItems.flatMap(item=>days.map(day=>db().collection('rentalSlots').doc(item.id+'__'+day)));
  const [hourly,legacy]=await Promise.all([
   hourlyRefs.length?db().getAll(...hourlyRefs):Promise.resolve([]),
   legacyRefs.length?db().getAll(...legacyRefs):Promise.resolve([])
  ]);
  const orderIds=new Set<string>();
  for(const snap of hourly){
   const entries=snap.data()?.entries;
   if(Array.isArray(entries))for(const entry of entries)if(entry&&typeof entry.orderId==='string'&&/^[\w-]{10,128}$/.test(entry.orderId))orderIds.add(entry.orderId);
  }
  for(const snap of legacy){const id=snap.data()?.orderId;if(typeof id==='string'&&/^[\w-]{10,128}$/.test(id))orderIds.add(id);}
  if(orderIds.size>200)throw new ApiError(503,'Có quá nhiều lượt đặt lịch để kiểm tra; vui lòng thử lại.');
  const keys=[...orderIds];const orders:RentalOrder[]=[];
  for(let i=0;i<keys.length;i+=80){
   const snaps=await db().getAll(...keys.slice(i,i+80).map(id=>db().collection('orders').doc(id)));
   orders.push(...snaps.filter(s=>s.exists).map(s=>({id:s.id,...s.data()} as RentalOrder)));
  }
  const states:Record<string,VisualAvailabilityState>={};
  const validStatuses=new Set<ItemStatus>(['AVAILABLE','RENTED','LAUNDRY','MAINTENANCE','MISSING']);
  for(const item of validItems){
   states[item.id]={status:validStatuses.has(item.status)?item.status:'UNKNOWN',upcoming:visualUpcomingForItem(orders,item.id,now)};
  }
  return NextResponse.json({states,checkedAt:now.toISOString(),windowStart:today,windowEnd:vietnamDayPlus(today,6)},
   {headers:{'Cache-Control':'private, no-store'}});
 }catch(e){return handleError(e,'POST /api/v5/visual-availability');}
}
