import pg from 'pg';
import {randomUUID} from 'node:crypto';
if(!process.env.DATABASE_URL)throw Error('DATABASE_URL chưa cấu hình');
const c=new pg.Client({connectionString:process.env.DATABASE_URL,ssl:false});
await c.connect();let failed=false;
try{
 await c.query('BEGIN');
 const phone='09'+String(Math.floor(Math.random()*100000000)).padStart(8,'0');
 const customer=(await c.query("INSERT INTO customers(name,phone) VALUES('GU SMOKE TEST',$1) RETURNING id",[phone])).rows[0].id;
 const item=(await c.query('INSERT INTO inventory_items(name,sku) VALUES($1,$2) RETURNING id',['GU SMOKE TEST',randomUUID()])).rows[0].id;
 const mkOrder=async()=> (await c.query("INSERT INTO rental_orders(code,customer_id,pickup_at,return_at) VALUES($1,$2,'2030-01-01T10:00:00Z','2030-01-03T10:00:00Z') RETURNING id",[randomUUID(),customer])).rows[0].id;
 const a=await mkOrder(),b=await mkOrder(),d=await mkOrder();
 const base="INSERT INTO item_reservations(order_id,item_id,pickup_at,return_at,state) VALUES($1,$2,$3,$4,'RESERVED')";
 await c.query(base,[a,item,'2030-01-01T10:00:00Z','2030-01-03T10:00:00Z']);
 await c.query('SAVEPOINT conflict_test');
 try{await c.query(base,[b,item,'2030-01-02T10:00:00Z','2030-01-04T10:00:00Z']);throw Error('BUG: PostgreSQL không từ chối lịch thuê giao nhau');}catch(e){if(e.code!=='23P01')throw e;console.log('PASS: Chặn đặt trùng sản phẩm');}
 await c.query('ROLLBACK TO SAVEPOINT conflict_test');
 await c.query(base,[d,item,'2030-01-03T10:00:00Z','2030-01-04T10:00:00Z']);
 console.log('PASS: Cho phép đơn thuê tiếp giáp, không trùng giờ');
} catch(e){failed=true;console.error('FAIL:',e.message);}finally{await c.query('ROLLBACK').catch(()=>{});await c.end();}
if(failed)process.exitCode=1;
