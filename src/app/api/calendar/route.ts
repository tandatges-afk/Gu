import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/firebase-admin';
import {staffUser,handleError,ApiError} from '@/lib/http';
import {addDays} from '@/lib/rental';
import {findDayLocks} from '@/lib/interval-lookup';
import {cached,measureRoute,countGetAll} from '@/lib/read-optimization';
import type {RentalOrder} from '@/lib/types';
export const runtime='nodejs';
export const preferredRegion='sin1';
export async function GET(req:NextRequest){return measureRoute('GET /api/calendar',async()=>{
 try{
  const me=await staffUser(req),u=new URL(req.url),start=String(u.searchParams.get('start')||'');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(start)||Number.isNaN(new Date(start+'T00:00:00Z').valueOf()))throw new ApiError(400,'Ngày đầu lịch không hợp lệ.');
  const itemIds=(u.searchParams.get('ids')||'').split(',').filter(Boolean);
  if(itemIds.length>30||itemIds.some(id=>!/^[a-zA-Z0-9]{10,64}$/.test(id))||new Set(itemIds).size!==itemIds.length)throw new ApiError(400,'Mỗi trang lịch tối đa 30 sản phẩm.');
  if(!itemIds.length)return NextResponse.json({orders:[],start});
  // Cache a read-only calendar view for 25 seconds; the booking transaction never reads this cache.
  const fresh=u.searchParams.get('fresh')==='1';
  const loadLocks=async()=>{
   const dates=Array.from({length:7},(_,i)=>addDays(start,i));
   const locks=await findDayLocks(itemIds,dates);
   const ids=[...new Set([...locks.values()].flatMap(lock=>[lock.legacyOrderId||'',...lock.entries.map(x=>x.orderId)]))].filter(Boolean);
   const items=countGetAll(await db().getAll(...itemIds.map(id=>db().collection('items').doc(id))));
   for(const item of items)if(item.data()?.status==='RENTED'&&item.data()?.currentOrderId)ids.push(String(item.data()?.currentOrderId));
   return [...new Set(ids)];
  };
  const orderIds=fresh?await loadLocks():await cached('calendar:locks:'+start+':'+[...itemIds].sort().join(','),25_000,loadLocks);
  const ordersIds=orderIds;
  const unique=[...new Set(ordersIds)].filter(id=>/^[a-zA-Z0-9]{10,64}$/.test(id));
  if(unique.length>200)throw new ApiError(503,'Quá nhiều đơn trong trang lịch, hãy thu hẹp số sản phẩm.');
  const loadOrders=async()=>{
   const found:RentalOrder[]=[];
   for(let i=0;i<unique.length;i+=100){
    const snaps=countGetAll(await db().getAll(...unique.slice(i,i+100).map(id=>db().collection('orders').doc(id))));
    found.push(...snaps.filter(d=>d.exists).map(d=>({id:d.id,...d.data()} as RentalOrder)));
   }
   return found;
  };
  const orders=fresh?await loadOrders():await cached('calendar:orders:'+me.uid+':'+start+':'+unique.slice().sort().join(','),25_000,loadOrders);
  return NextResponse.json({orders:orders.filter(o=>me.role==='admin'||o.status!=='RETURNED'&&o.status!=='CANCELLED'&&o.status!=='VOIDED'),start},
   {headers:{'Cache-Control':'private, no-store'}});
 }catch(e){return handleError(e,'GET /api/calendar');}
});}
