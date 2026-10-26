import {NextRequest,NextResponse} from 'next/server';
import {pgTransaction} from '@/lib/pg-vps';
import {pgCurrentUser,pgError,checkOrigin,jsonObject,pgUuid,PgHttpError,requirePgAdmin} from '@/lib/pg-security';
export const runtime='nodejs';
export async function PATCH(req:NextRequest,ctx:{params:Promise<{id:string}>}){try{
  checkOrigin(req);const me=await pgCurrentUser(req);const id=pgUuid((await ctx.params).id);
  const body=await jsonObject(req);const next=String(body.status||'');
  if(!['PICKED_UP','RETURNED','CANCELLED'].includes(next))throw new PgHttpError(400,'Trạng thái đơn không hợp lệ.');
  if(next==='CANCELLED')requirePgAdmin(me);
  const result=await pgTransaction(async(client)=>{
    const result=await client.query<{status:string}>('SELECT status FROM rental_orders WHERE id=$1 FOR UPDATE',[id]);
    const from=result.rows[0]?.status;
    if(!from)throw new PgHttpError(404,'Không tìm thấy đơn thuê.');
    if(!(from==='RESERVED' && (next==='PICKED_UP'||next==='CANCELLED') || from==='PICKED_UP'&&next==='RETURNED'))
      throw new PgHttpError(409,`Không thể chuyển đơn từ ${from} sang ${next}.`);
    await client.query('UPDATE rental_orders SET status=$2,updated_at=now() WHERE id=$1',[id,next]);
    await client.query('UPDATE item_reservations SET state=$2 WHERE order_id=$1',[id,next]);
    if(next==='PICKED_UP'){
      await client.query(`UPDATE inventory_items SET status='RENTED',updated_at=now()
        WHERE id IN (SELECT item_id FROM rental_order_lines WHERE order_id=$1)`,[id]);
    } else if(next==='RETURNED'){
      await client.query(`UPDATE inventory_items SET status='LAUNDRY',laundry_started_at=now(),updated_at=now()
        WHERE id IN (SELECT item_id FROM rental_order_lines WHERE order_id=$1)`,[id]);
    }
    await client.query('INSERT INTO order_events(order_id,actor_id,event_type) VALUES($1,$2,$3)',[id,me.id,'STATUS_'+next]);
    await client.query('INSERT INTO audit_logs(actor_id,action,entity_type,entity_id) VALUES($1,$2,\'rental_order\',$3)',[me.id,'STATUS_'+next,id]);
    return {id,status:next};
  });
  return NextResponse.json({order:result});
}catch(e){return pgError(e);}}
