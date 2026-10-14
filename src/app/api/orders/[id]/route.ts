import { NextRequest,NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { staffUser,handleError,jsonBody,ApiError } from '@/lib/http';
import { occupiedDays,slotId,positiveVnd,vietnamToday } from '@/lib/rental';
import { RentalOrder, ReturnInspection } from '@/lib/types';
import { calculateInspection } from '@/lib/inspection';
import { auditInTransaction } from '@/lib/audit';
export const runtime='nodejs';
export async function PATCH(req:NextRequest,ctx:{params:Promise<{id:string}>}) {
  try {
    const me=await staffUser(req);
    const {id}=await ctx.params;
    if(!/^[a-zA-Z0-9]{10,64}$/.test(id))throw new ApiError(400,'Mã đơn hàng không hợp lệ.');
    const b=await jsonBody(req);
    const action=String(b.action);
    if(!['PICKUP','RETURN','CANCEL','PAY'].includes(action))throw new ApiError(400,'Thao tác không hợp lệ.');
    const amount=action==='PAY'?positiveVnd(b.amount,'Số tiền thanh toán'):0;
    const ref=db().collection('orders').doc(id);
    await db().runTransaction(async tx=>{
      const snap=await tx.get(ref);
      if(!snap.exists)throw new ApiError(404,'Không tìm thấy đơn hàng.');
      const order={id:snap.id,...snap.data()} as RentalOrder;
      if(action==='PICKUP'&&order.status!=='RESERVED')throw new ApiError(409,'Chỉ đơn đặt trước mới được giao hàng.');
      if(action==='PICKUP'&&order.pickupDate>vietnamToday())throw new ApiError(409,'Chưa đến ngày nhận hàng của đơn.');
      if(action==='RETURN'&&order.status!=='PICKED_UP')throw new ApiError(409,'Chỉ đơn đã giao mới được kiểm nhận trả hàng.');
      if(action==='CANCEL'&&order.status!=='RESERVED')throw new ApiError(409,'Chỉ có thể hủy đơn chưa giao.');
      if(action==='CANCEL'&&order.paid>0)throw new ApiError(409,'Đơn đã thu tiền. Cần xử lý hoàn tiền trước khi hủy.');
      if(action==='PAY'&&order.status==='CANCELLED')throw new ApiError(409,'Đơn đã hủy không thể thu tiền.');
      if(action==='PAY'&&order.paid+amount>order.total+(order.compensationTotal||0))throw new ApiError(400,'Số tiền vượt công nợ gồm cả phí đền bù.');
      // On RETURN checklist must include exactly one decision per rental line.

      const itemRefs=order.lines.map(l=>db().collection('items').doc(l.itemId));
      const slots=order.lines.flatMap(l=>occupiedDays(order.pickupDate,order.returnDate,l.bufferDays).map(day=>db().collection('rentalSlots').doc(slotId(l.itemId,day))));
      const itemSnaps=action==='PICKUP'||action==='RETURN'?await Promise.all(itemRefs.map(r=>tx.get(r))):[];
      const lockSnaps=action==='CANCEL'||action==='RETURN'?await Promise.all(slots.map(r=>tx.get(r))):[];
      if(itemSnaps.some(s=>!s.exists))throw new ApiError(409,'Có sản phẩm trong đơn không còn tồn tại.');
      if(action==='PICKUP'&&itemSnaps.some(s=>s.data()?.status!=='AVAILABLE'))throw new ApiError(409,'Có sản phẩm đang giặt, bảo trì hoặc chưa sẵn sàng.');
      if((action==='CANCEL'||action==='RETURN')&&lockSnaps.some(s=>s.exists&&s.data()?.orderId!==id))throw new ApiError(409,'Lịch giữ hàng có xung đột; cần kiểm tra thủ công.');
      let inspections:ReturnInspection[]=[];
      if(action==='RETURN') {
        try{
          inspections=calculateInspection(order.lines,b.inspection,Object.fromEntries(order.lines.map((l,i)=>[l.itemId,Number(itemSnaps[i].data()?.replacementValue||0)])));
        }catch(e){const message=e instanceof Error?e.message:'Checklist không hợp lệ.';throw new ApiError(message.startsWith('Admin')?409:400,message);}
      }
      const compensationTotal=inspections.reduce((s,c)=>s+c.compensation,0);
      const now=new Date().toISOString();
      const status=action==='PICKUP'?'PICKED_UP':action==='RETURN'?'RETURNED':action==='CANCEL'?'CANCELLED':order.status;
      tx.update(ref,{
        status, paid:order.paid+amount, updatedAt:now,
        ...(action==='RETURN'?{compensationTotal,returnInspection:inspections,returnedAt:now}:{}),
        history:[...order.history,{action,by:me.uid,at:now,
          ...(action==='PAY'?{amount,detail:`Đã thu ${amount} VND`}:{}),
          ...(action==='RETURN'?{detail:`Nhận ${inspections.filter(x=>x.status==='OK').length} món, thiếu ${inspections.filter(x=>x.status==='MISSING').length} món, đền bù ${compensationTotal} VND`}:{})}]
      });
      if(action==='PICKUP')itemRefs.forEach(r=>tx.update(r,{status:'RENTED',currentOrderId:id,expectedReturnDate:order.returnDate}));
      if(action==='RETURN')itemRefs.forEach((r,i)=>tx.update(r,{status:inspections[i].status==='MISSING'?'MISSING':'LAUNDRY',currentOrderId:null,expectedReturnDate:null}));
      if(action==='CANCEL'||action==='RETURN')lockSnaps.forEach((snap,i)=>{if(snap.exists)tx.delete(slots[i]);});
      auditInTransaction(tx,me,`ORDER_${action}`,'order',id,
        `Đơn ${order.code}${action==='RETURN'?`; thiếu ${inspections.filter(x=>x.status==='MISSING').map(x=>x.sku).join(', ')||'không'}; phí ${compensationTotal} VND`:action==='PAY'?`; thu ${amount} VND`:''}`,now);
    });
    return NextResponse.json({ok:true});
  }catch(e){return handleError(e);}
}
