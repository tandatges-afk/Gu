import {NextRequest,NextResponse} from 'next/server';
import {randomBytes} from 'node:crypto';
import {pgRows,pgTransaction} from '@/lib/pg-vps';
import {pgCurrentUser,pgError,checkOrigin,jsonObject,pgUuid,needString,PgHttpError} from '@/lib/pg-security';
export const runtime='nodejs';

type Row={id:string;name:string;daily_rate:string;status:string};
export async function GET(req:NextRequest){try{
  await pgCurrentUser(req);
  const orders=await pgRows(`SELECT o.id,o.code,o.status,o.pickup_at,o.return_at,o.total_vnd::text,o.paid_vnd::text,
    c.name AS customer_name,c.phone AS customer_phone,
    coalesce(json_agg(json_build_object('itemId',l.item_id,'name',i.name,'sku',i.sku)) FILTER (WHERE l.id IS NOT NULL),'[]'::json) AS lines
    FROM rental_orders o JOIN customers c ON c.id=o.customer_id
    LEFT JOIN rental_order_lines l ON l.order_id=o.id LEFT JOIN inventory_items i ON i.id=l.item_id
    GROUP BY o.id,c.id ORDER BY o.created_at DESC LIMIT 100`);
  return NextResponse.json({orders});
}catch(e){return pgError(e);}}

export async function POST(req:NextRequest){try{
  checkOrigin(req);const me=await pgCurrentUser(req);const body=await jsonObject(req);
  const customerId=pgUuid(body.customerId,'Khách hàng');
  const values=body.itemIds;
  if(!Array.isArray(values)||values.length===0||values.length>40)throw new PgHttpError(400,'Chọn từ 1 đến 40 sản phẩm.');
  const itemIds=values.map(v=>pgUuid(v,'Sản phẩm'));
  if(new Set(itemIds).size!==itemIds.length)throw new PgHttpError(400,'Không thể thêm trùng sản phẩm trong một đơn.');
  const pickupAt=needString(body.pickupAt,'Ngày nhận',40);
  const returnAt=needString(body.returnAt,'Ngày trả',40);
  const start=new Date(pickupAt),end=new Date(returnAt);
  if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||end<=start||end.getTime()-start.getTime()>366*86400000)
    throw new PgHttpError(400,'Thời gian thuê không hợp lệ.');
  const durationDays=Math.max(1,Math.ceil((end.getTime()-start.getTime())/86400000));
  const note=String(body.note||'').slice(0,2000);
  const order=await pgTransaction(async(client)=>{
    // Lock inventory rows and let PostgreSQL exclusion constraint enforce overlapping booking.
    const rows=await client.query<Row>('SELECT id,name,daily_rate::text,status FROM inventory_items WHERE id=ANY($1::uuid[]) AND archived_at IS NULL ORDER BY id FOR UPDATE',[itemIds]);
    if(rows.rowCount!==itemIds.length)throw new PgHttpError(400,'Có sản phẩm không tồn tại.');
    if(rows.rows.some(i=>['MISSING','MAINTENANCE'].includes(i.status)))throw new PgHttpError(409,'Có sản phẩm đang bảo trì hoặc bị thất lạc.');
    const total=rows.rows.reduce((sum,i)=>sum+Number(i.daily_rate)*durationDays,0);
    if(!Number.isSafeInteger(total))throw new PgHttpError(400,'Tổng tiền quá lớn.');
    const code='GU-'+new Date().toISOString().slice(0,10).replace(/-/g,'')+'-'+randomBytes(4).toString('hex').toUpperCase();
    const created=await client.query<{id:string;code:string}>(`INSERT INTO rental_orders(code,customer_id,created_by,pickup_at,return_at,status,booking_kind,total_vnd,note)
       VALUES($1,$2,$3,$4,$5,'RESERVED','RESERVE',$6,$7) RETURNING id,code`,[code,customerId,me.id,start.toISOString(),end.toISOString(),total,note]);
    const o=created.rows[0];
    for(const item of rows.rows){
      await client.query('INSERT INTO rental_order_lines(order_id,item_id,item_snapshot,line_total_vnd) VALUES($1,$2,$3::jsonb,$4)',[
        o.id,item.id,JSON.stringify({name:item.name}),Number(item.daily_rate)*durationDays]);
      await client.query(`INSERT INTO item_reservations(order_id,item_id,pickup_at,return_at,state)
        VALUES($1,$2,$3,$4,'RESERVED')`,[o.id,item.id,start.toISOString(),end.toISOString()]);
    }
    await client.query('INSERT INTO order_events(order_id,actor_id,event_type) VALUES($1,$2,$3)',[o.id,me.id,'ORDER_CREATED']);
    await client.query(`INSERT INTO audit_logs(actor_id,action,entity_type,entity_id) VALUES($1,'CREATE','rental_order',$2)`,[me.id,o.id]);
    return {...o,totalVnd:total};
  });
  return NextResponse.json({order},{status:201});
}catch(e){return pgError(e);}}
