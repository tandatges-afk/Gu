// Database-only smoke test. Uses a transaction and always ROLLBACKs; leaves no data.
import pg from 'pg';
import {randomUUID} from 'node:crypto';
if(!process.env.DATABASE_URL){console.error('Thiếu DATABASE_URL');process.exit(1);}
const client=new pg.Client({connectionString:process.env.DATABASE_URL,ssl:false});
try{
 await client.connect();await client.query('BEGIN');
 const [{id:customerId}]=(await client.query("INSERT INTO customers(name,phone) VALUES('Gu Smoke Test','0900000000') RETURNING id")).rows;
 const [{id:itemId}]=(await client.query('INSERT INTO inventory_items(name,sku) VALUES($1,$2) RETURNING id',['Gu Smoke Test',`TEST-${randomUUID()}`])).rows;
 const [{id:order1}]=(await client.query(`INSERT INTO rental_orders(code,customer_id,pickup_at,return_at)
   VALUES($1,$2,'2027-01-01T09:00:00+07','2027-01-02T09:00:00+07') RETURNING id`,[`TEST-${randomUUID()}`,customerId])).rows;
 const [{id:order2}]=(await client.query(`INSERT INTO rental_orders(code,customer_id,pickup_at,return_at)
   VALUES($1,$2,'2027-01-02T09:00:00+07','2027-01-03T09:00:00+07') RETURNING id`,[`TEST-${randomUUID()}`,customerId])).rows;
 await client.query(`INSERT INTO item_reservations(order_id,item_id,pickup_at,return_at) VALUES($1,$2,'2027-01-01T09:00:00+07','2027-01-02T09:00:00+07')`,[order1,itemId]);
 await client.query('SAVEPOINT overlapping');
 let blocked=false;
 try{
   await client.query(`INSERT INTO item_reservations(order_id,item_id,pickup_at,return_at)
     VALUES($1,$2,'2027-01-01T12:00:00+07','2027-01-02T12:00:00+07')`,[order2,itemId]);
 }catch(e){if(e?.code==='23P01')blocked=true;else throw e;}
 await client.query('ROLLBACK TO SAVEPOINT overlapping');
 if(!blocked)throw new Error('NGUY HIEM: database cho phép hai lịch chồng nhau!');
 await client.query(`INSERT INTO item_reservations(order_id,item_id,pickup_at,return_at)
   VALUES($1,$2,'2027-01-02T09:00:00+07','2027-01-03T09:00:00+07')`,[order2,itemId]);
 console.log('PASS: lịch chồng nhau bị từ chối, hai lịch tiếp giáp được chấp nhận.');
}catch(e){console.error('FAIL:',e instanceof Error?e.message:String(e));process.exitCode=1;}
finally{try{await client.query('ROLLBACK');}catch{} await client.end();}
