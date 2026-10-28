/** GU Fix20 read-only deployment gate: no schema changes. */
import pg from 'pg';
const url=new URL(process.env.DATABASE_URL||'');
const database=decodeURIComponent(url.pathname.slice(1));
const expected=['gu_v546_stage','gu_v546_prod'];
if(!expected.includes(database)||!['127.0.0.1','localhost'].includes(url.hostname))throw Error('Fix20 refuses an unexpected database or remote PG host.');
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:1,connectionTimeoutMillis:8000});
const errors=[];
try{
 const name=await pool.query('SELECT current_database() AS name');
 if(name.rows[0]?.name!==database)errors.push('Unexpected connected database');
 const table=await pool.query("SELECT to_regclass('public.gu_documents') AS relation");
 if(!table.rows[0]?.relation)throw Error('Missing table gu_documents');
 const marker=await pool.query("SELECT data->>'completed' AS completed FROM gu_documents WHERE collection='systemMigrations' AND id='product-name-index-v1'");
 if(marker.rows[0]?.completed!=='true')errors.push('product-name-index-v1 migration not completed');
 // A failed CREATE INDEX CONCURRENTLY can leave an INVALID index whose name
 // still appears in pg_indexes. Require PostgreSQL to report it ready and valid.
 const indexes=await pool.query(`SELECT idx.relname AS indexname, i.indisvalid AS valid,
    i.indisready AS ready, i.indisunique AS is_unique
   FROM pg_class tbl JOIN pg_namespace ns ON ns.oid=tbl.relnamespace
   JOIN pg_index i ON i.indrelid=tbl.oid
   JOIN pg_class idx ON idx.oid=i.indexrelid
   WHERE ns.nspname='public' AND tbl.relname='gu_documents'`);
 const installed=new Map(indexes.rows.map(r=>[r.indexname,r]));
 for(const index of ['gu_docs_by_status','gu_docs_by_code','gu_docs_by_phone','gu_docs_by_pickup_date','gu_docs_by_return_date','gu_docs_unique_active_order_code']){
   const state=installed.get(index);
   if(!state)errors.push(`Missing index: ${index}`);
   else if(!state.valid||!state.ready)errors.push(`Invalid/unready index: ${index} (repair before deployment)`);
 }
 const unique=installed.get('gu_docs_unique_active_order_code');
 if(unique&&!unique.is_unique)errors.push('Order code index is not UNIQUE');
 const dup=await pool.query("SELECT data->>'code' AS code,COUNT(*)::int AS count FROM gu_documents WHERE collection='orders' AND NULLIF(data->>'code','') IS NOT NULL GROUP BY data->>'code' HAVING COUNT(*)>1 LIMIT 10");
 if(dup.rows.length)errors.push(`Duplicate order codes in ${dup.rows.length} groups; investigate before adding unique index`);
 const account=await pool.query("SELECT to_regclass('public.gu_accounts') AS relation");
 if(!account.rows[0]?.relation)errors.push('Missing gu_accounts');
 console.log(JSON.stringify({database,version:'5.4.6-fix20.0',checkedAt:new Date().toISOString(),errors},null,2));
 if(errors.length)process.exitCode=1;
}catch(error){console.error('GU FIX20 PREFLIGHT FAIL:',error.message);process.exitCode=1;}
finally{await pool.end();}
