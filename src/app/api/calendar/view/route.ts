import {NextRequest,NextResponse} from 'next/server';
import {staffUser,handleError,ApiError} from '@/lib/http';
import {calendarData,calendarFastPage} from '@/lib/calendar-view-data';
import {matchesCalendarCreator,matchesCalendarStatus} from '@/lib/calendar-timeline';
import {matchesProductSearch} from '@/lib/product-search';
import {vietnamToday} from '@/lib/rental';
import type {InventoryItem,RentalOrder} from '@/lib/types';
import {measureRoute} from '@/lib/read-optimization';
export const runtime='nodejs';
export const preferredRegion='sin1';
const size=25;
const digits=(s:string)=>s.replace(/\D/g,'');
function searchItem(item:InventoryItem,orders:RentalOrder[],query:string){
 if(!query)return true;
 const qdigits=digits(query);
 const code=item.hangerCode||item.sku||'';
 if(matchesProductSearch([item.name,item.category,item.color,code].join(' '),query))return true;
 if(qdigits&&digits(code).replace(/^0+/,'').endsWith(qdigits))return true;
 return orders.some(o=>o.lines.some(l=>l.itemId===item.id)&&(matchesProductSearch([o.customerName,o.customerPhone,o.code].join(' '),query)||Boolean(qdigits&&digits(o.customerPhone).includes(qdigits))));
}
export async function GET(req:NextRequest){return measureRoute('GET /api/calendar/view',async()=>{
 try{
  await staffUser(req);
  const p=new URL(req.url).searchParams;
  const start=String(p.get('start')||'');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(start)||Number.isNaN(new Date(start+'T00:00:00Z').getTime()))throw new ApiError(400,'Ngày lịch không hợp lệ.');
  const category=(p.get('category')||'ALL').slice(0,120);
  const status=p.get('status')||'ALL';
  if(!['ALL','FREE','RESERVED','PICKED_UP','RETURNED','OVERDUE','LAUNDRY','MAINTENANCE','MISSING','UNPRICED','BLOCKED'].includes(status))throw new ApiError(400,'Bộ lọc trạng thái không hợp lệ.');
  const creator=String(p.get('creator')||'ALL');
  if(creator!=='ALL'&&!/^[\w-]{10,128}$/.test(creator))throw new ApiError(400,'Mã nhân viên không hợp lệ.');
  const query=String(p.get('q')||'').trim().slice(0,80);
  const offset=Number(p.get('cursor')||'0');
  if(!Number.isSafeInteger(offset)||offset<0||offset>1000000||offset!==Math.trunc(offset))throw new ApiError(400,'Vị trí trang không hợp lệ.');
  const fast=creator==='ALL'&&status==='ALL'&&!query;
  const fresh=p.has('refresh');
  const [{items:loadedItems,orders},fastPage]=await Promise.all([calendarData(start,fresh,!fast),fast?calendarFastPage(category,offset):Promise.resolve(null)]);
  const items=fastPage?.items||loadedItems;
  const today=vietnamToday();
  const creators=[...new Map(orders.filter(o=>o.createdBy).map(o=>[o.createdBy,o.createdByName||o.createdBy])).entries()]
    .sort((a,b)=>a[1].localeCompare(b[1],'vi')).map(([id,name])=>({id,name}));
  const visible=items.filter(item=>
    (category==='ALL'||item.category===category)&&
    matchesCalendarCreator(item,orders,start,today,creator)&&
    matchesCalendarStatus(item,orders,start,today,status)&&
    searchItem(item,orders,query)
  ).sort((a,b)=>a.name.localeCompare(b.name,'vi')||a.id.localeCompare(b.id));
  const selected=fast?visible:visible.slice(offset,offset+size);
  const selectedIds=new Set(selected.map(i=>i.id));
  const selectedOrders=orders.filter(o=>o.lines.some(l=>selectedIds.has(l.itemId)));
  return NextResponse.json({results:selected,orders:selectedOrders,creators,
   cursor:fast?fastPage?.next||null:offset+size<visible.length?String(offset+size):null,
   total:fast?-1:visible.length,page:Math.floor(offset/size)+1,hasMore:fast?Boolean(fastPage?.next):offset+size<visible.length,
   note:'Bộ lọc toàn kho được áp dụng trên máy chủ trước khi phân trang. Lịch sử lấy theo đơn thực tế.'},
   {headers:{'Cache-Control':'private,no-store'}});
 }catch(e){
  if(e instanceof Error&&e.message==='CALENDAR_TOO_MANY_ROWS')return handleError(new ApiError(503,'Số dòng lịch vượt giới hạn kiểm tra an toàn. Không hiển thị lịch trống giả; cần bổ sung chỉ mục/lược đồ tổng hợp lịch.'),'GET /api/calendar/view');
  return handleError(e,'GET /api/calendar/view');
 }
});}
