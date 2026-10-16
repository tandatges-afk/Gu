import {NextRequest,NextResponse} from 'next/server';
import {FieldPath} from 'firebase-admin/firestore';
import {db} from '@/lib/firebase-admin';
import {staffUser,handleError,ApiError} from '@/lib/http';
export const runtime='nodejs';
export const preferredRegion='sin1';
export async function GET(req:NextRequest){
 try{
  const me=await staffUser(req);if(me.role!=='admin')throw new ApiError(403,'Chỉ Admin được xem báo cáo tiền thu.');
  const now=new Date(),y=now.getUTCFullYear();const start=`${y-4}-01-01`,end=`${y+1}-01-01`;
  const [snap,history,migration]=await Promise.all([
    db().collection('cashDaily').orderBy(FieldPath.documentId()).startAt(start).endBefore(end).limit(2001).get(),
    db().collection('cashHistoryDaily').orderBy(FieldPath.documentId()).startAt(start).endBefore(end).limit(2001).get(),
    db().collection('systemMigrations').doc('revenueHistory-v42').get()
  ]);
  if(snap.size>2000||history.size>2000)throw new ApiError(503,'Khoảng ngày báo cáo vượt giới hạn an toàn.');
  const sums=new Map<string,{date:string;amount:number;payments:number}>();
  for(const doc of [...snap.docs,...history.docs]){
    const row=sums.get(doc.id)||{date:doc.id,amount:0,payments:0};
    row.amount+=Number(doc.data().amount||0);row.payments+=Number(doc.data().payments||0);sums.set(doc.id,row);
  }
  const rows=[...sums.values()].sort((a,b)=>a.date.localeCompare(b.date));
  return NextResponse.json({rows,since:'GU 4.2',historicalImported:migration.data()?.completed===true,
    note:migration.data()?.completed===true?'Dòng tiền đã bao gồm dữ liệu lịch sử trước GU 4.2 và thu mới. Đối soát với sổ thu thực tế.':
      'Đang thiếu dòng tiền cũ trước GU 4.2. Chưa thể coi biểu đồ hoặc tổng tiền là số liệu lịch sử đầy đủ; Admin cần chạy chuyển đổi doanh thu.'},
    {headers:{'Cache-Control':'private, no-store'}});
 }catch(e){return handleError(e);}
}
