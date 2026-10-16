import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/firebase-admin';
import {staffUser,handleError,ApiError} from '@/lib/http';
import {summaryFromDebtIndex,debtIndexRecord} from '@/lib/debt-index';
export const runtime='nodejs';
export const preferredRegion='sin1';
export async function GET(req:NextRequest){
 try{
  const me=await staffUser(req);
  if(me.role!=='admin')throw new ApiError(403,'Chỉ Admin được xem danh sách công nợ.');
  // Index contains only unpaid/anticipated orders, not 90,000+ completed rentals.
  const [snap,migration]=await Promise.all([db().collection('debtLedger').limit(10001).get(),db().collection('systemMigrations').doc('debtLedger-v42').get()]);
  if(snap.size>10000)throw new ApiError(503,'Công nợ đang mở quá lớn để hiển thị một lần. Cần phân trang chỉ mục công nợ.');
  const rows=snap.docs.map(d=>d.data() as ReturnType<typeof debtIndexRecord>);
  const result=summaryFromDebtIndex(rows);
  return NextResponse.json({...result,indexed:true,legacyMigrationRequired:migration.data()?.completed!==true,legacyScanned:Number(migration.data()?.processed||0)},
    {headers:{'Cache-Control':'private, no-store'}});
 }catch(e){return handleError(e);}
}
