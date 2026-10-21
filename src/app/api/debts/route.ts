import {NextRequest,NextResponse} from 'next/server';
import {AggregateField,FieldPath} from 'firebase-admin/firestore';
import {db} from '@/lib/firebase-admin';
import {staffUser,handleError,ApiError} from '@/lib/http';
import {summaryFromDebtIndex,debtIndexRecord} from '@/lib/debt-index';
import {cached,countQuery,countDoc,measureRoute} from '@/lib/read-optimization';
export const runtime='nodejs';
export const preferredRegion='sin1';
const PAGE_SIZE=100;
export async function GET(req:NextRequest){return measureRoute('GET /api/debts',async()=>{
 try{
  const me=await staffUser(req);
  if(me.role!=='admin')throw new ApiError(403,'Chỉ Admin được xem danh sách công nợ.');
  const cursor=new URL(req.url).searchParams.get('cursor')||'';
  if(cursor&&!/^[a-zA-Z0-9]{10,64}$/.test(cursor))throw new ApiError(400,'Trang công nợ không hợp lệ.');
  let q=db().collection('debtLedger').orderBy(FieldPath.documentId()).limit(PAGE_SIZE+1);
  if(cursor)q=q.startAfter(cursor);
  const snap=countQuery(await q.get());
  const rows=snap.docs.slice(0,PAGE_SIZE).map(d=>d.data() as ReturnType<typeof debtIndexRecord>);
  const page=summaryFromDebtIndex(rows);
  const next=snap.size>PAGE_SIZE?snap.docs[PAGE_SIZE-1].id:null;
  const global=await cached('debts:global',2_000,async()=>{
   const [open,reserved,pending,migration]=await Promise.all([
    db().collection('debtLedger').where('kind','==','open').aggregate({total:AggregateField.sum('outstanding'),count:AggregateField.count()}).get(),
    db().collection('debtLedger').where('kind','==','reserved').aggregate({total:AggregateField.sum('outstanding'),count:AggregateField.count()}).get(),
    db().collection('debtLedger').where('cameraLateFeePending','==',true).count().get(),
    db().collection('systemMigrations').doc('debtLedger-v42').get(),
   ]);
   countDoc(migration);
   return {totalOutstanding:Number(open.data().total||0),unpaidOrders:Number(open.data().count||0),
    futureReservations:Number(reserved.data().count||0),reservationUnpaid:Number(reserved.data().total||0),
    pendingCameraLateCount:Number(pending.data().count||0),legacyMigrationRequired:migration.data()?.completed!==true,
    legacyScanned:Number(migration.data()?.processed||0)};
  });
  return NextResponse.json({...page,...global,indexed:true,cursor:next,hasMore:Boolean(next),pageSize:PAGE_SIZE,
    pageNote:'Danh sách công nợ tải theo trang; số tổng hợp lấy từ truy vấn SUM/COUNT trên toàn bộ sổ nợ.'},
    {headers:{'Cache-Control':'private,no-store'}});
 }catch(e){return handleError(e,'GET /api/debts');}
});}
