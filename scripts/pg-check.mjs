import pg from 'pg';
const expected=['staff_users','auth_sessions','categories','customers','inventory_items','rental_orders','rental_order_lines','item_reservations','order_events','payments','debt_ledger','staff_shifts','secure_evidence','audit_logs','system_settings','auth_login_attempts'];
if(!process.env.DATABASE_URL){console.error('Thiếu DATABASE_URL');process.exit(1);}
const client=new pg.Client({connectionString:process.env.DATABASE_URL,ssl:false});
try{
 await client.connect();
 const result=await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public'");
 const current=new Set(result.rows.map(r=>r.tablename));
 const missing=expected.filter(n=>!current.has(n));
 console.log(`PostgreSQL OK: ${result.rows.length} bảng; còn thiếu ${missing.length} bảng: ${missing.join(', ')||'không'}`);
 if(missing.length)process.exitCode=1;
}catch(e){console.error('Kết nối hoặc schema lỗi:',e instanceof Error?e.message:String(e));process.exitCode=1;}
finally{await client.end();}
