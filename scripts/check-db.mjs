import pg from 'pg';
if(!process.env.DATABASE_URL)throw Error('Thiếu DATABASE_URL');
const db=new pg.Client({connectionString:process.env.DATABASE_URL,ssl:false});
await db.connect();
try{const tables=['staff_users','auth_sessions','auth_login_attempts','categories','customers','inventory_items','rental_orders','rental_order_lines','item_reservations','order_events','payments','debt_ledger','staff_shifts','secure_evidence','audit_logs','system_settings','media_assets','gu_schema_migrations'];const found=(await db.query('SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname=\'public\'')).rows.map(x=>x.tablename);const missing=tables.filter(t=>!found.includes(t));console.log('PostgreSQL:',(await db.query('SELECT current_database() db,current_user usr')).rows[0]);console.log('Số bảng:',found.length,'/ thiếu:',missing.length);if(missing.length){console.error('Thiếu:',missing.join(', '));process.exitCode=1;}else console.log('OK: Schema GU VPS PostgreSQL v2');}finally{await db.end();}
