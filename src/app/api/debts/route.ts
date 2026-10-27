import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/firebase-admin';
import {staffUser,handleError,ApiError} from '@/lib/http';
import {summaryFromDebtIndex,debtIndexRecord} from '@/lib/debt-index';
import {buildDebtSummary} from '@/lib/debts';
import type {RentalOrder} from '@/lib/types';
import {pgPool} from '@/lib/pg-firestore';
export const runtime='nodejs';
export const preferredRegion='sin1';
export async function GET(req:NextRequest){
 try{
  const me=await staffUser(req);
  if(me.role!=='admin')throw new ApiError(403,'Chỉ Admin được xem danh sách công nợ.');
  // Index contains only unpaid/anticipated orders, not 90,000+ completed rentals.
  // New V5 installations or pre-migration data have no reliable debt ledger yet.
  // Only read active/returned orders, never 90,000+ settled historical orders.
  const migration=await db().collection('systemMigrations').doc('debtLedger-v42').get();
  if(migration.data()?.completed!==true){
   const scan=await pgPool().query<{data:RentalOrder}>(`SELECT data FROM gu_documents
    WHERE collection='orders' AND data->>'status' IN ('RESERVED','PICKED_UP','RETURNED')
      AND (data->>'status' <> 'RETURNED'
        OR coalesce(data->>'cameraLateFeePending','false') = 'true'
        OR (CASE WHEN data->>'total' ~ '^[0-9]+([.][0-9]+)?$' THEN (data->>'total')::numeric ELSE 0 END
          + CASE WHEN data->>'compensationTotal' ~ '^[0-9]+([.][0-9]+)?$' THEN (data->>'compensationTotal')::numeric ELSE 0 END
          + CASE WHEN data->>'lateFeeTotal' ~ '^[0-9]+([.][0-9]+)?$' THEN (data->>'lateFeeTotal')::numeric ELSE 0 END
          + CASE WHEN data->>'otherFeeTotal' ~ '^[0-9]+([.][0-9]+)?$' THEN (data->>'otherFeeTotal')::numeric ELSE 0 END)
          > CASE WHEN data->>'paid' ~ '^[0-9]+([.][0-9]+)?$' THEN (data->>'paid')::numeric ELSE 0 END)
    LIMIT 10001`);
   if(scan.rowCount!==null&&scan.rowCount>10000)throw new ApiError(503,'Cần phân trang công nợ. Có hơn 10.000 đơn đang chờ đối soát.');
   const result=buildDebtSummary(scan.rows.map(r=>r.data));
   return NextResponse.json({...result,indexed:false,legacyMigrationRequired:true,legacyScanned:scan.rows.length},
    {headers:{'Cache-Control':'private, no-store'}});
  }
  // pg-query-compiler rejects limit > 10,000. Previous limit(10001) caused a
  // GU_SERVER_ERROR even when the table was empty.
  const snap=await db().collection('debtLedger').limit(10000).get();
  if(snap.size>=10000)throw new ApiError(503,'Công nợ vượt giới hạn hiển thị. Cần phân trang.');
  const rows=snap.docs.map(d=>d.data() as ReturnType<typeof debtIndexRecord>).filter(r=>r&&typeof r==='object')
   .map(r=>({...r,customerName:String(r.customerName||'Khách chưa có tên'),customerPhone:String(r.customerPhone||''),
     outstanding:Math.max(0,Number(r.outstanding)||0),paid:Math.max(0,Number(r.paid)||0),amount:Math.max(0,Number(r.amount)||0)}));
  const result=summaryFromDebtIndex(rows);
  return NextResponse.json({...result,indexed:true,legacyMigrationRequired:migration.data()?.completed!==true,legacyScanned:Number(migration.data()?.processed||0)},
    {headers:{'Cache-Control':'private, no-store'}});
 }catch(e){return handleError(e,'GET /api/debts');}
}
