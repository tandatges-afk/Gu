/** Staging-only PostgreSQL integration smoke test. Disposable rows, never prod.
 * Simulates concurrent slot reservation, state transition and payment idempotency.
 * Real HTTP multi-account UAT remains mandatory.
 */
import pg from 'pg';
import {randomUUID} from 'node:crypto';
const url=new URL(process.env.DATABASE_URL||'');
if(url.pathname!=='/gu_v546_stage'||!['127.0.0.1','localhost'].includes(url.hostname)||process.env.GU_ACK_STAGE_CONCURRENCY!=='yes')
 throw Error('Only gu_v546_stage local DB with GU_ACK_STAGE_CONCURRENCY=yes is allowed');
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:5});
const id='fix20-'+randomUUID();
const coll='fix20Concurrency';
const transaction=async(fn)=>{
 const client=await pool.connect();
 try{await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(702546)');
  const result=await fn(client);await client.query('COMMIT');return result;
 }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
};
const key=(suffix)=>id+'-'+suffix;
const read=async(client,k)=> (await client.query('SELECT data FROM gu_documents WHERE collection=$1 AND id=$2',[coll,k])).rows[0]?.data;
const write=async(client,k,data)=>client.query('INSERT INTO gu_documents(collection,id,data) VALUES($1,$2,$3::jsonb) ON CONFLICT(collection,id) DO UPDATE SET data=$3::jsonb',[coll,k,JSON.stringify(data)]);
async function book(){return transaction(async c=>{const old=await read(c,key('slot'));if(old)return 'CONFLICT';await write(c,key('slot'),{orderId:'one'});return 'SUCCESS';});}
async function advance(from,to){return transaction(async c=>{const old=await read(c,key('order'));if(old?.status!==from)return 'CONFLICT';await write(c,key('order'),{status:to,paid:old.paid});return 'SUCCESS';});}
async function pay(reqId,amount){return transaction(async c=>{
 const movement=await read(c,key('payment-'+reqId));if(movement)return 'IDEMPOTENT';
 const order=await read(c,key('order'));
 if(!order||order.paid+amount>200000)return 'CONFLICT';
 await write(c,key('payment-'+reqId),{amount});await write(c,key('order'),{...order,paid:order.paid+amount});return 'SUCCESS';
});}
let failed=false;
try{
 await transaction(c=>write(c,key('order'),{status:'RESERVED',paid:0}));
 const booking=await Promise.all([book(),book()]);
 const pickup=await Promise.all([advance('RESERVED','PICKED_UP'),advance('RESERVED','PICKED_UP')]);
 const returnStatus=await Promise.all([advance('PICKED_UP','RETURNED'),advance('PICKED_UP','RETURNED')]);
 const payment=await Promise.all([pay('same-request-id',100000),pay('same-request-id',100000)]);
 const final=await transaction(c=>read(c,key('order')));
 const valid=[booking,pickup,returnStatus].every(a=>a.sort().join(',')==='CONFLICT,SUCCESS')&&payment.sort().join(',')==='IDEMPOTENT,SUCCESS'&&final?.paid===100000&&final?.status==='RETURNED';
 console.log(JSON.stringify({database:'gu_v546_stage',valid,booking,pickup,returnStatus,payment,paid:final?.paid}));
 if(!valid)failed=true;
}catch(e){console.error('GU FIX20 STAGE CONCURRENCY:',e.message);failed=true;}
finally{try{await transaction(c=>c.query('DELETE FROM gu_documents WHERE collection=$1 AND id LIKE $2',[coll,id+'-%']));}catch(e){console.error('Clean test rows manually:',id,e.message);failed=true;}await pool.end();}
if(failed)process.exitCode=1;
