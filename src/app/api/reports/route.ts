import {NextRequest,NextResponse} from 'next/server';
import {FieldPath} from 'firebase-admin/firestore';
import {db} from '@/lib/firebase-admin';
import {staffUser,handleError,ApiError} from '@/lib/http';
import {vietnamToday} from '@/lib/rental';
import {cached,countQuery,countDoc,measureRoute} from '@/lib/read-optimization';
export const runtime='nodejs';
export const preferredRegion='sin1';
function range(mode:string){
 const today=vietnamToday(),day=new Date(today+'T00:00:00Z');
 if(mode==='day')day.setUTCDate(day.getUTCDate()-13);
 else if(mode==='month'){day.setUTCDate(1);day.setUTCMonth(day.getUTCMonth()-11);}
 else if(mode==='year'){day.setUTCMonth(0,1);day.setUTCFullYear(day.getUTCFullYear()-4);}
 else throw new ApiError(400,'Khoảng thống kê không hợp lệ.');
 return {start:day.toISOString().slice(0,10),end:today};
}
export async function GET(req:NextRequest){return measureRoute('GET /api/reports',async()=>{
 try{
  const me=await staffUser(req);if(me.role!=='admin')throw new ApiError(403,'Chỉ Admin được xem báo cáo tiền thu.');
  const mode=new URL(req.url).searchParams.get('mode')||'month';
  const {start,end}=range(mode);
  const payload=await cached('reports:'+mode+':'+start+':'+end,120_000,async()=>{
   const [snap,history,migration]=await Promise.all([
    db().collection('cashDaily').orderBy(FieldPath.documentId()).startAt(start).endAt(end).limit(2001).get(),
    db().collection('cashHistoryDaily').orderBy(FieldPath.documentId()).startAt(start).endAt(end).limit(2001).get(),
    db().collection('systemMigrations').doc('revenueHistory-v42').get()
   ]);
   countQuery(snap);countQuery(history);countDoc(migration);
   if(snap.size>2000||history.size>2000)throw new ApiError(503,'Khoảng ngày báo cáo vượt giới hạn an toàn.');
   const sums=new Map<string,{date:string;amount:number;payments:number}>();
   for(const doc of [...snap.docs,...history.docs]){
    const row=sums.get(doc.id)||{date:doc.id,amount:0,payments:0};
    row.amount+=Number(doc.data().amount||0);row.payments+=Number(doc.data().payments||0);sums.set(doc.id,row);
   }
   const rows=[...sums.values()].sort((a,b)=>a.date.localeCompare(b.date));
   return {rows,since:'GU 4.2',mode,historicalImported:migration.data()?.completed===true,
    note:migration.data()?.completed===true?'Dòng tiền gồm dữ liệu lịch sử đã chuyển đổi và thu mới. Đối soát với sổ thu thực tế.':
     'Thiếu dòng tiền lịch sử trước GU 4.2; Admin cần chạy chuyển đổi doanh thu.'};
  });
  return NextResponse.json(payload,{headers:{'Cache-Control':'private,no-store'}});
 }catch(e){return handleError(e,'GET /api/reports');}
});}
