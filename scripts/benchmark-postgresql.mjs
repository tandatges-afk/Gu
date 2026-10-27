/** Read-only query latency sampler on staging, no customer fields logged. */
import pg from 'pg';
import {performance} from 'node:perf_hooks';
if(!process.env.DATABASE_URL)throw Error('Missing DATABASE_URL');
const cfg=new URL(process.env.DATABASE_URL);
if(cfg.pathname.replace(/^\//,'')!=='gu_v546_stage' && process.env.GU_BENCH_ALLOW_OTHER_DB!=='yes'){
 console.error('Safety: benchmark defaults to gu_v546_stage only.');process.exit(1);
}
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:4});
const cases=[
 ['inventory count',"SELECT COUNT(*) FROM gu_documents WHERE collection='items' AND COALESCE(data->>'archivedAt','')=''",[]],
 ['available inventory',"SELECT COUNT(*) FROM gu_documents WHERE collection='items' AND data->>'status'=$1",['AVAILABLE']],
 ['recent orders',"SELECT id,data FROM gu_documents WHERE collection='orders' ORDER BY data->>'createdAt' DESC NULLS LAST,id ASC LIMIT 80",[]],
 ['customer phone lookup',"SELECT id,data FROM gu_documents WHERE collection='customers' AND data->>'phone'=$1 LIMIT 1",['0900000000']],
 ['stock by code',"SELECT id,data FROM gu_documents WHERE collection='items' ORDER BY data->>'hangerCode' ASC NULLS LAST,id ASC LIMIT 80",[]],
 ['calendar slots batch',"SELECT id,data FROM gu_documents WHERE collection='rentalSlots' AND id=ANY($1::text[])",[['GU-00001_2026-10-27','GU-00002_2026-10-27']]],
];
const p=v=>Number(v.toFixed(2));
try{
 await pool.query('SELECT 1');
 console.log('Read-only staging query latency; figures are VPS-specific, not promises for production.');
 for(const [name,sql,args] of cases){
  for(let i=0;i<3;i++)await pool.query(sql,args);
  const samples=[];
  for(let i=0;i<25;i++){
   const t0=performance.now();await pool.query(sql,args);samples.push(performance.now()-t0);
  }
  samples.sort((a,b)=>a-b);
  console.log(`${name}: p50=${p(samples[12])}ms p95=${p(samples[23])}ms max=${p(samples[24])}ms`);
 }
}catch(e){console.error('Benchmark failed:',e.message);process.exitCode=1}finally{await pool.end();}
