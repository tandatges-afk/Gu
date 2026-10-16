import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/firebase-admin';
import {staffUser,handleError,ApiError} from '@/lib/http';
import {addDays,slotId} from '@/lib/rental';
import type {RentalOrder} from '@/lib/types';
export const runtime='nodejs';
export const preferredRegion='sin1';
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
  const ordersIds=[...new Set(locks.filter(s=>s.exists).map(s=>String(s.data()?.orderId||'')))].filter(Boolean);
  // Include overdue pickups even after scheduled slots; only for visible products.
  const items=await db().getAll(...itemIds.map(id=>db().collection('items').doc(id)));
  for(const item of items)if(item.data()?.status==='RENTED'&&item.data()?.currentOrderId)ordersIds.push(String(item.data()?.currentOrderId));
  const unique=[...new Set(ordersIds)].filter(id=>/^[a-zA-Z0-9]{10,64}$/.test(id));
  if(unique.length>200)throw new ApiError(503,'Quá nhiều đơn trong trang lịch, hãy thu hẹp số sản phẩm.');
  const orders:RentalOrder[]=[];
  for(let i=0;i<unique.length;i+=100){
   const snaps=await db().getAll(...unique.slice(i,i+100).map(id=>db().collection('orders').doc(id)));
   orders.push(...snaps.filter(d=>d.exists).map(d=>({id:d.id,...d.data()} as RentalOrder)));
  }
  return NextResponse.json({orders:orders.filter(o=>me.role==='admin'||o.status!=='RETURNED'&&o.status!=='CANCELLED'),start},
   {headers:{'Cache-Control':'private, no-store'}});
 }catch(e){return handleError(e);}
}
