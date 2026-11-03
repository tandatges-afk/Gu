import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/firebase-admin';
import {pgPool} from '@/lib/pg-firestore';
import {staffUser,handleError,ApiError} from '@/lib/http';
import {addDays,slotId,vietnamToday} from '@/lib/rental';
import type {RentalOrder} from '@/lib/types';
export const runtime='nodejs';

export async function GET(req:NextRequest){
 try{
  const me=await staffUser(req),u=new URL(req.url),start=String(u.searchParams.get('start')||'');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(start)||Number.isNaN(new Date(start+'T00:00:00Z').valueOf()))throw new ApiError(400,'Ngày đầu lịch không hợp lệ.');
  const itemIds=(u.searchParams.get('ids')||'').split(',').filter(Boolean);
  if(itemIds.length>30||itemIds.some(id=>!/^[a-zA-Z0-9]{10,64}$/.test(id))||new Set(itemIds).size!==itemIds.length)throw new ApiError(400,'Mỗi trang lịch tối đa 30 sản phẩm.');
  if(!itemIds.length)return NextResponse.json({orders:[],start});
  const dates=Array.from({length:7},(_,i)=>addDays(start,i));
  const refs=itemIds.flatMap(id=>dates.map(day=>db().collection('rentalSlots').doc(slotId(id,day))));
  const locks=await db().getAll(...refs);
  // GU v5 hourly reservations are indexed in day interval documents.
  const hourlyRefs=itemIds.flatMap(id=>dates.map(day=>db().collection('v5DayIntervals').doc(id+'_'+day)));
  const hourly=await db().getAll(...hourlyRefs);
  const ordersIds=[...new Set([
    ...locks.filter(s=>s.exists).map(s=>String(s.data()?.orderId||'')),
    ...hourly.flatMap(s=>((s.data()?.entries||[]) as Array<{orderId:string}>).map(x=>x.orderId))
  ])].filter(Boolean);
  // Include overdue pickups even after scheduled slots; only for visible products.
  const items=await db().getAll(...itemIds.map(id=>db().collection('items').doc(id)));
  for(const item of items)if(item.data()?.status==='RENTED'&&item.data()?.currentOrderId)ordersIds.push(String(item.data()?.currentOrderId));
  const today=vietnamToday();
  if(start<=today&&today<=dates[6]){
   // Date-interval locks expire after the booking. Unresolved reservations
   // still need to open from the operational alert on TODAY. Keep this query
   // scoped to the visible item IDs and do not pollute future-only weeks.
   const unresolved=await pgPool().query<{id:string}>(`SELECT id FROM gu_documents
    WHERE collection='orders' AND data->>'status' IN ('RESERVED','PICKED_UP')
      AND ((data->>'status'='RESERVED' AND coalesce(data->>'pickupDate','') < $1)
        OR (data->>'status'='PICKED_UP' AND coalesce(data->>'returnDate','') < $1))
      AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(CASE
          WHEN jsonb_typeof(data->'lines')='array' THEN data->'lines'
          ELSE '[]'::jsonb END) AS line
        WHERE line->>'itemId'=ANY($2::text[])
      )
    ORDER BY id LIMIT 201`,[today,itemIds]);
   if(unresolved.rows.length>200)throw new ApiError(503,'Quá nhiều đơn tồn đọng cần đối soát.');
   ordersIds.push(...unresolved.rows.map(row=>row.id));
  }
  // Cancelled no-shows have no active interval locks. Fetch only historically
  // relevant no-show orders, so their booked dates remain grey and read-only.
  const missed=await pgPool().query<{id:string}>(`SELECT id FROM gu_documents
   WHERE collection='orders' AND data->>'status'='CANCELLED'
    AND data->>'cancelReason'='NO_SHOW'
    AND data->>'pickupDate' <= $1 AND data->>'returnDate' >= $2
    AND EXISTS(SELECT 1 FROM jsonb_array_elements(CASE
      WHEN jsonb_typeof(data->'lines')='array' THEN data->'lines'
      ELSE '[]'::jsonb END) line WHERE line->>'itemId'=ANY($3::text[]))
   ORDER BY id LIMIT 201`,[dates[6],start,itemIds]);
  if(missed.rows.length>200)throw new ApiError(503,'Quá nhiều đơn không đến lấy cần kiểm tra.');
  ordersIds.push(...missed.rows.map(row=>row.id));
  const unique=[...new Set(ordersIds)].filter(id=>/^[a-zA-Z0-9]{10,64}$/.test(id));
  if(unique.length>200)throw new ApiError(503,'Quá nhiều đơn trong trang lịch, hãy thu hẹp số sản phẩm.');
  const orders:RentalOrder[]=[];
  for(let i=0;i<unique.length;i+=100){
   const snaps=await db().getAll(...unique.slice(i,i+100).map(id=>db().collection('orders').doc(id)));
   orders.push(...snaps.filter(d=>d.exists).map(d=>({id:d.id,...d.data()} as RentalOrder)));
  }
  return NextResponse.json({orders:orders.filter(o=>me.role==='admin'||o.status!=='RETURNED'&&(o.status!=='CANCELLED'||o.cancelReason==='NO_SHOW')&&o.status!=='VOIDED'),start},
   {headers:{'Cache-Control':'private, no-store'}});
 }catch(e){return handleError(e,'GET /api/calendar');}
}
