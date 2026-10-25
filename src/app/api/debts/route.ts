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
  const global=await cached('debts:global:v553',30_000,async()=>{
   const pendingPromise=db().collection('debtLedger').where('cameraLateFeePending','==',true).count().get();
   const migrationPromise=db().collection('systemMigrations').doc('debtLedger-v42').get();
   let totalOutstanding=0,unpaidOrders=0,futureReservations=0,reservationUnpaid=0,indexFallback=false;
   try{
    const [open,reserved]=await Promise.all([
      db().collection('debtLedger').where('kind','==','open').aggregate({total:AggregateField.sum('outstanding'),count:AggregateField.count()}).get(),
      db().collection('debtLedger').where('kind','==','reserved').aggregate({total:AggregateField.sum('outstanding'),count:AggregateField.count()}).get(),
    ]);
    totalOutstanding=Number(open.data().total||0);unpaidOrders=Number(open.data().count||0);
    futureReservations=Number(reserved.data().count||0);reservationUnpaid=Number(reserved.data().total||0);
   }catch(e){
    const error=e as {code?:number|string;message?:string};
    if(!(String(error.code)==='9'&&/index/i.test(error.message||'')))throw e;
    // Existing installations often have the sum-index declared locally but not deployed remotely.
    // Fallback uses two ordinary single-field queries. It is bounded and TTL-cached;
    // never return fake zero totals if the debt ledger has outgrown this safe limit.
    const load=async(kind:string)=>{
      let q=db().collection('debtLedger').where('kind','==',kind).limit(3001);
      const snap=countQuery(await q.get());
      if(snap.size>3000)throw new ApiError(503,'Công nợ có trên 3.000 dòng; cần tạo composite index debtLedger (kind ASC, outstanding ASC) để tổng hợp chính xác.');
      return {total:snap.docs.reduce((sum,d)=>sum+Math.max(0,Number(d.data().outstanding)||0),0),count:snap.size};
    };
    const [open,reserved]=await Promise.all([load('open'),load('reserved')]);
    totalOutstanding=open.total;unpaidOrders=open.count;
    reservationUnpaid=reserved.total;futureReservations=reserved.count;indexFallback=true;
   }
   const [pending,migration]=await Promise.all([pendingPromise,migrationPromise]);
   countDoc(migration);
   return {totalOutstanding,unpaidOrders,futureReservations,reservationUnpaid,
    pendingCameraLateCount:Number(pending.data().count||0),legacyMigrationRequired:migration.data()?.completed!==true,
    legacyScanned:Number(migration.data()?.processed||0),indexFallback};
  });
  return NextResponse.json({...page,...global,indexed:true,cursor:next,hasMore:Boolean(next),pageSize:PAGE_SIZE,
    pageNote:global.indexFallback?'Tổng công nợ dùng bộ đếm dự phòng có giới hạn 3.000 dòng vì index Firebase chưa được triển khai.':'Danh sách theo trang; số tổng hợp lấy từ SUM/COUNT toàn bộ sổ nợ.'},
    {headers:{'Cache-Control':'private,no-store'}});
 }catch(e){
  // Indexes are remote Firestore resources. The checked-in JSON is not enough until deployed.
  const failure=e as {code?:number|string;message?:string};
  if((failure.code===9||failure.code==='9')&&/index/i.test(failure.message||''))
   return handleError(new ApiError(503,'Firestore thiếu index debtLedger (kind ASC, outstanding ASC). Admin cần tạo index theo liên kết Firebase hoặc chạy firebase deploy --only firestore:indexes --project gugu-547e3.'),'GET /api/debts');
  return handleError(e,'GET /api/debts');
 }
});}
