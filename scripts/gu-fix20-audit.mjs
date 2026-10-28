/** Read-only production/staging audit. No customers' names, phones, raw records in output.
 * Bounded by row cap and timeout; never uses any update/delete SQL.
 */
import pg from 'pg';
const u=new URL(process.env.DATABASE_URL||'');const database=decodeURIComponent(u.pathname.slice(1));
if(!['gu_v546_stage','gu_v546_prod'].includes(database)||!['127.0.0.1','localhost'].includes(u.hostname))throw Error('GU Fix20 audit: only V5 local databases are permitted');
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:1,connectionTimeoutMillis:10000});
const findings=[];let counts={};
const flag=(severity,code,n,exampleIds=[])=>{if(n)findings.push({severity,code,count:n,exampleIds:exampleIds.slice(0,5)});};
try{
 const client=await pool.connect();
 try{
  await client.query('BEGIN READ ONLY');
  await client.query("SET LOCAL statement_timeout = '20000ms'");
  await client.query("SET LOCAL idle_in_transaction_session_timeout = '40000ms'");
  const sql=async(q,params=[])=> (await client.query(q,params)).rows;
  const rowCount=await sql("SELECT collection,COUNT(*)::int AS count FROM gu_documents WHERE collection IN ('orders','items','v5DayIntervals','rentalSlots','cashDaily','phoneIndex') GROUP BY collection");
  counts=Object.fromEntries(rowCount.map(x=>[x.collection,x.count]));
  const badCodes=await sql("SELECT count(*)::int AS n FROM (SELECT data->>'code' FROM gu_documents WHERE collection='orders' AND data->>'code' IS NOT NULL GROUP BY data->>'code' HAVING COUNT(*)>1) dup");
  flag('P1','DUPLICATE_ORDER_CODE',badCodes[0].n);
  const badMoney=await sql("SELECT id FROM gu_documents WHERE collection='orders' AND (COALESCE(data->>'paid','0') !~ '^[0-9]+$' OR COALESCE(data->>'total','0') !~ '^[0-9]+$') LIMIT 20");
  flag('P1','BAD_TOTAL_OR_PAID',badMoney.length,badMoney.map(x=>x.id));
  const stock=await sql("SELECT id FROM gu_documents WHERE collection='items' AND ((data->>'status'='RENTED' AND COALESCE(data->>'currentOrderId','')='') OR (data->>'status'='AVAILABLE' AND COALESCE(data->>'currentOrderId','')<>'')) LIMIT 20");
  flag('P1','STOCK_ORDER_STATE_MISMATCH',stock.length,stock.map(x=>x.id));
  const link=await sql("SELECT i.id FROM gu_documents i LEFT JOIN gu_documents o ON o.collection='orders' AND o.id=i.data->>'currentOrderId' WHERE i.collection='items' AND i.data->>'status'='RENTED' AND (o.id IS NULL OR o.data->>'status'<>'PICKED_UP') LIMIT 20");
  flag('P1','RENTED_ITEM_MISSING_ACTIVE_ORDER',link.length,link.map(x=>x.id));
  // Every pair of overlapping intervals of DIFFERENT orders is a possible double booking.
  const conflicts=await sql(`SELECT d.id FROM gu_documents d WHERE d.collection='v5DayIntervals' AND EXISTS (
   SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(d.data->'entries')='array' THEN d.data->'entries' ELSE '[]'::jsonb END) a
   JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(d.data->'entries')='array' THEN d.data->'entries' ELSE '[]'::jsonb END) b ON TRUE
   WHERE a->>'orderId'<>b->>'orderId' AND (a->>'start')::timestamptz<(b->>'end')::timestamptz AND (b->>'start')::timestamptz<(a->>'end')::timestamptz
  ) LIMIT 20`);
  flag('P0','OVERLAPPING_RENTAL_INTERVALS',conflicts.length,conflicts.map(x=>x.id));
  const stale=await sql("SELECT i.id FROM gu_documents i LEFT JOIN gu_documents o ON o.collection='orders' AND o.id=i.data->>'currentOrderId' WHERE i.collection='items' AND i.data->>'status'='RENTED' AND o.data->>'status'='PICKED_UP' AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(o.data->'lines')='array' THEN o.data->'lines' ELSE '[]'::jsonb END) l WHERE l->>'itemId'=i.id) LIMIT 20");
  flag('P1','RENTED_ITEM_NOT_IN_ORDER_LINES',stale.length,stale.map(x=>x.id));
  // Reconcile net paid against immutable payment/refund movements for V5 orders.
  // This is diagnostic (historical imported orders may lack complete movements).
  const badLedger=await sql(`SELECT o.id FROM gu_documents o JOIN LATERAL (
    SELECT count(*)::int AS movements, COALESCE(SUM(CASE
      WHEN m.data->>'kind' IN ('PAYMENT','COLLATERAL_APPLIED') THEN (m.data->>'amount')::numeric
      WHEN m.data->>'kind'='REFUND' THEN -(m.data->>'amount')::numeric
      ELSE 0 END),0) AS net
    FROM gu_documents m WHERE m.collection='orders/'||o.id||'/cashMovements'
      AND COALESCE(m.data->>'amount','') ~ '^[0-9]+$'
  ) amounts ON TRUE
  WHERE o.collection='orders' AND o.data->>'pricingVersion'='GU_HOURLY_V1'
    AND COALESCE(o.data->>'paid','') ~ '^[0-9]+$'
    AND amounts.movements>0 AND amounts.net<>(CASE WHEN (o.data->>'paid') ~ '^[0-9]+$' THEN (o.data->>'paid')::numeric ELSE NULL END) LIMIT 20`);
  flag('P1','V5_NET_PAID_LEDGER_MISMATCH',badLedger.length,badLedger.map(x=>x.id));
  const badMovements=await sql("SELECT id FROM gu_documents WHERE collection LIKE 'orders/%/cashMovements' AND (COALESCE(data->>'amount','') !~ '^[0-9]+$' OR (data->>'kind' IS NULL)) LIMIT 20");
  flag('P1','INVALID_CASH_MOVEMENT',badMovements.length,badMovements.map(x=>x.id));
  const missingName=await sql("SELECT id FROM gu_documents WHERE collection='items' AND (COALESCE(data->>'nameKey','')='' OR data->>'nameKey' IS NULL) LIMIT 20");
  flag('P2','PRODUCT_SEARCH_INDEX_INCOMPLETE',missingName.length,missingName.map(x=>x.id));
  await client.query('COMMIT');
 }catch(e){await client.query('ROLLBACK').catch(()=>{});throw e;}finally{client.release();}
 const report={version:'5.4.6-fix20.0',database,checkedAt:new Date().toISOString(),counts,findings,limitations:'Read-only sample (first 20 IDs per rule); not a financial sign-off or live concurrency test.'};
 console.log(JSON.stringify(report,null,2));
 if(findings.some(f=>['P0','P1'].includes(f.severity)))process.exitCode=2;
}catch(e){console.error('GU FIX20 AUDIT ERROR:',e.message);process.exitCode=1;}finally{await pool.end();}
