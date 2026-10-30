import {NextRequest,NextResponse} from 'next/server';
import {pgPool} from '@/lib/pg-firestore';
import {staffUser,handleError,ApiError} from '@/lib/http';
import {vietnamToday,addDays} from '@/lib/rental';
import {globalCalendarPage} from '@/lib/calendar-global-page';
import {tomorrowReturnRisk} from '@/lib/return-risk';
import type {InventoryItem,RentalOrder} from '@/lib/types';
import type {CalendarFilter} from '@/lib/smart-calendar';
import type {RentalGroup} from '@/lib/order-group';
export const runtime='nodejs';
const MAX_ITEMS=5000,MAX_ORDERS=5000;
/** Bounded, read-only query over ALL current inventory, then global sort and pagination.
 * No order/customer details are returned: details still pass through /api/calendar access controls.
 */
export async function GET(req:NextRequest){
 try{
  await staffUser(req);
  const params=new URL(req.url).searchParams;
  const start=params.get('start')||'';
  if(!/^\d{4}-\d{2}-\d{2}$/.test(start)||!Number.isFinite(Date.parse(start+'T00:00:00Z')))throw new ApiError(400,'Ngày đầu lịch không hợp lệ.');
  const page=Number(params.get('page')||1);
  if(!Number.isInteger(page)||page<1||page>500)throw new ApiError(400,'Số trang lịch không hợp lệ.');
  const group=params.get('group')||'CLOTHING';
  if(group!=='CLOTHING'&&group!=='CAMERA')throw new ApiError(400,'Nhóm lịch không hợp lệ.');
  const category=(params.get('category')||'ALL').slice(0,80);
  const status=params.get('status')||'ALL';
  if(!['ALL','FREE','RESERVED','PICKED_UP','OVERDUE','LAUNDRY','MAINTENANCE','MISSING','UNPRICED'].includes(status))throw new ApiError(400,'Trạng thái lọc không hợp lệ.');
  const creator=(params.get('creator')||'ALL').slice(0,128);
  const query=(params.get('q')||'').slice(0,80);
  const result=await Promise.all([
   pgPool().query<{id:string;data:Omit<InventoryItem,'id'>}>(`SELECT id,data FROM gu_documents WHERE collection='items'
    AND NOT (data ? 'archivedAt' AND coalesce(data->>'archivedAt','') NOT IN ('','null'))
    ORDER BY id LIMIT $1`,[MAX_ITEMS+1]),
   pgPool().query<{id:string;data:Omit<RentalOrder,'id'>}>(`SELECT id,data FROM gu_documents WHERE collection='orders'
    AND data->>'status' IN ('RESERVED','PICKED_UP')
    AND (coalesce(data->>'returnDate','') >= $1 OR data->>'status'='PICKED_UP')
    AND coalesce(data->>'pickupDate','') <= $2
    ORDER BY id LIMIT $3`,[start,addDays(start,6),MAX_ORDERS+1]),
  ]);
  if(result[0].rows.length>MAX_ITEMS||result[1].rows.length>MAX_ORDERS)
   throw new ApiError(503,'Dữ liệu lịch vượt giới hạn an toàn. Hãy liên hệ quản trị để tối ưu phân trang, không hiển thị thứ tự thiếu.');
  const items=result[0].rows.map(row=>({...row.data,id:row.id} as InventoryItem));
  const orders=result[1].rows.map(row=>({...row.data,id:row.id} as RentalOrder));
  const ranked=globalCalendarPage({items,orders,start,today:vietnamToday(),group:group as RentalGroup,
   page,query,category,status:status as CalendarFilter,creator,
   riskItemIds:new Set(tomorrowReturnRisk(orders,new Date()).map(r=>r.itemId))});
  return NextResponse.json(ranked,{headers:{'Cache-Control':'private,no-store'}});
 }catch(e){return handleError(e,'GET /api/calendar/page');}
}
