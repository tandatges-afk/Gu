/** Explicit online index migration. Do not run during the busiest shift.
 * CREATE INDEX CONCURRENTLY avoids taking an exclusive write lock. Keep a
 * database backup before changing indexes on a live GU installation.
 */
import pg from 'pg';
if(!process.env.DATABASE_URL){console.error('DATABASE_URL is required');process.exit(1);}
const dbUrl=new URL(process.env.DATABASE_URL);
const dbName=decodeURIComponent(dbUrl.pathname.slice(1));
if(!['gu_v546_stage','gu_v546_prod'].includes(dbName)||!['127.0.0.1','localhost'].includes(dbUrl.hostname)){
 console.error('Safety: optimization is restricted to local gu_v546_stage / gu_v546_prod.');process.exit(1);
}
if(dbName==='gu_v546_prod'&&process.env.GU_OPTIMIZE_ALLOW_OTHER_DB!=='yes'){
 console.error('Safety: production optimization requires explicit GU_OPTIMIZE_ALLOW_OTHER_DB=yes after a verified backup.');process.exit(1);
}
const indexes=[
 ['gu_docs_by_status',"CREATE INDEX CONCURRENTLY IF NOT EXISTS gu_docs_by_status ON gu_documents(collection,(data->>'status'),id)"],
 ['gu_docs_by_created_at',"CREATE INDEX CONCURRENTLY IF NOT EXISTS gu_docs_by_created_at ON gu_documents(collection,(data->>'createdAt') DESC,id)"],
 ['gu_docs_by_name',"CREATE INDEX CONCURRENTLY IF NOT EXISTS gu_docs_by_name ON gu_documents(collection,(data->>'name'),id)"],
 ['gu_docs_by_hanger_code',"CREATE INDEX CONCURRENTLY IF NOT EXISTS gu_docs_by_hanger_code ON gu_documents(collection,(data->>'hangerCode'),id)"],
 ['gu_docs_by_phone',"CREATE INDEX CONCURRENTLY IF NOT EXISTS gu_docs_by_phone ON gu_documents(collection,(data->>'phone'),id)"],
 ['gu_docs_by_pickup_date',"CREATE INDEX CONCURRENTLY IF NOT EXISTS gu_docs_by_pickup_date ON gu_documents(collection,(data->>'pickupDate'),id)"],
 ['gu_docs_by_return_date',"CREATE INDEX CONCURRENTLY IF NOT EXISTS gu_docs_by_return_date ON gu_documents(collection,(data->>'returnDate'),id)"],
 ['gu_docs_by_item_id',"CREATE INDEX CONCURRENTLY IF NOT EXISTS gu_docs_by_item_id ON gu_documents(collection,(data->>'itemId'),id)"],
 ['gu_docs_by_code',"CREATE INDEX CONCURRENTLY IF NOT EXISTS gu_docs_by_code ON gu_documents(collection,(data->>'code'),id)"],
 ['gu_docs_unique_active_order_code',"CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS gu_docs_unique_active_order_code ON gu_documents((data->>'code')) WHERE collection='orders' AND NULLIF(data->>'code','') IS NOT NULL"],
 ['gu_docs_by_role',"CREATE INDEX CONCURRENTLY IF NOT EXISTS gu_docs_by_role ON gu_documents(collection,(data->>'role'),id)"],
 ['gu_docs_by_stage',"CREATE INDEX CONCURRENTLY IF NOT EXISTS gu_docs_by_stage ON gu_documents(collection,(data->>'stage'),id)"],
 ['gu_docs_by_approved_date',"CREATE INDEX CONCURRENTLY IF NOT EXISTS gu_docs_by_approved_date ON gu_documents(collection,(data->>'archivedAt'),id)"],
 ['gu_docs_name_bigrams_gin',"CREATE INDEX CONCURRENTLY IF NOT EXISTS gu_docs_name_bigrams_gin ON gu_documents USING gin ((data->'nameSearchBigrams'))"],
];
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:2,connectionTimeoutMillis:10000});
try {
  const chk=await pool.query("SELECT to_regclass('public.gu_documents') AS table_name");
  if(!chk.rows[0].table_name)throw Error('Missing gu_documents. Run db:init first.');
  for(const [name,sql] of indexes){
    console.log('Creating or checking',name);
    await pool.query(sql);
  }
  await pool.query('ANALYZE gu_documents');
  console.log('GU PostgreSQL indexes ready. No customer data was modified.');
}catch(e){console.error(e);process.exitCode=1;}finally{await pool.end();}
