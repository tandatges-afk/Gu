import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/firebase-admin';
import {staffUser,handleError,ApiError} from '@/lib/http';
import {buildDebtSummary} from '@/lib/debts';
import type {RentalOrder} from '@/lib/types';
import type {QueryDocumentSnapshot} from 'firebase-admin/firestore';

export const runtime='nodejs';
export const preferredRegion='sin1';

export async function GET(req:NextRequest){
  try {
    const me=await staffUser(req);
    if(me.role!=='admin')throw new ApiError(403,'Chỉ Admin được xem danh sách công nợ.');
    const orders:RentalOrder[]=[];
    let last:QueryDocumentSnapshot|undefined;
    // Paginate beyond the 300 most recent orders loaded for the general dashboard.
    // Refuse to show a misleading partial total if the dataset exceeds the safety cap.
    for(let i=0;i<40;i++){
      let query=db().collection('orders').orderBy('createdAt','desc').limit(250);
      if(last)query=query.startAfter(last);
      const snapshot=await query.get();
      orders.push(...snapshot.docs.map(d=>({id:d.id,...d.data()} as RentalOrder)));
      if(snapshot.size<250){
        return NextResponse.json(buildDebtSummary(orders),{headers:{'Cache-Control':'private, no-store'}});
      }
      last=snapshot.docs[snapshot.docs.length-1];
    }
    throw new ApiError(503,'Số lượng đơn vượt giới hạn đối soát. Vui lòng phân trang theo kỳ để xem đầy đủ, không dùng số tổng tạm tính.');
  }catch(e){return handleError(e);}
}
