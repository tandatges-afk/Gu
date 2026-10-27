import { NextRequest,NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { staffUser,handleError,jsonBody,ApiError } from '@/lib/http';
import { occupiedDays,slotId,positiveVnd,vietnamToday,assertSlotCapacity,lateDays,lateBaseCharge,assertText,postReturnStockStatus } from '@/lib/rental';
import { extraStartDate, lineOccupiedDays, makeAddedLines, mustBeReadyAtPickup } from '@/lib/booking-rules';
import { assertItems } from '@/lib/booking-server';
import type { RentalOrder, ReturnInspection, InventoryItem } from '@/lib/types';
import { calculateInspection } from '@/lib/inspection';
import { auditInTransaction } from '@/lib/audit';
import { planRentalExtension } from '@/lib/rental-extension';
import {syncDebtIndex} from '@/lib/debt-index';
import {FieldValue} from '@/lib/pg-firestore';
export const runtime='nodejs';
export const preferredRegion='sin1';

// Allow administrators to open historical unpaid orders outside the bootstrap 300-row window.
export async function GET(req:NextRequest,ctx:{params:Promise<{id:string}>}) {
  try {
    const me=await staffUser(req);
    if(me.role!=='admin')throw new ApiError(403,'Chỉ Admin được mở đơn công nợ lịch sử.');
    const {id}=await ctx.params;
    if(!/^[a-zA-Z0-9]{10,64}$/.test(id))throw new ApiError(400,'Mã đơn không hợp lệ.');
    const doc=await db().collection('orders').doc(id).get();
    if(!doc.exists)throw new ApiError(404,'Không tìm thấy đơn.');
    const order={id:doc.id,...doc.data()} as RentalOrder;
    // For old orders without a name snapshot, resolve the creator using their immutable UID.
    if(!order.createdByName&&order.createdBy){
      const creator=await db().collection('staff').doc(order.createdBy).get();
      if(creator.exists)order.createdByName=String(creator.data()?.name||'').trim();
    }
    return NextResponse.json(order,{headers:{'Cache-Control':'private, no-store'}});
  } catch(e){return handleError(e,'/api/orders/[id]');}
}

export async function PATCH(req:NextRequest,ctx:{params:Promise<{id:string}>}) {
  try {
    const me=await staffUser(req);
    const {id}=await ctx.params;
    if(!/^[a-zA-Z0-9]{10,64}$/.test(id))throw new ApiError(400,'Mã đơn hàng không hợp lệ.');
    const b=await jsonBody(req);
    const action=String(b.action);
    if(!['PICKUP','RETURN','CANCEL','PAY','ADD_ITEMS','EXTEND'].includes(action))throw new ApiError(400,'Thao tác không hợp lệ.');
    if(action==='CANCEL'&&me.role!=='admin')throw new ApiError(403,'Chỉ Admin được hủy lịch, kể cả đơn được tạo từ phiên bản cũ.');
    const amount=action==='PAY'?positiveVnd(b.amount,'Số tiền thanh toán'):0;
    const addIds=action==='ADD_ITEMS'?b.itemIds:[];
    if(action==='ADD_ITEMS'&&(!Array.isArray(addIds)||!addIds.length||addIds.some(x=>typeof x!=='string'||!/^[a-zA-Z0-9]{10,64}$/.test(x))||new Set(addIds).size!==addIds.length))
      throw new ApiError(400,'Chọn ít nhất một sản phẩm hợp lệ, không trùng nhau.');
    const ref=db().collection('orders').doc(id);
    await db().runTransaction(async tx=>{
      const snap=await tx.get(ref);
      if(!snap.exists)throw new ApiError(404,'Không tìm thấy đơn hàng.');
      const order={id:snap.id,...snap.data()} as RentalOrder;
      if(order.pricingVersion)throw new ApiError(409,'Đơn này dùng quy trình chụp ảnh và bảng giá 24 giờ; hãy thao tác trong trang đơn GU mới.');
      const today=vietnamToday();
      if(action==='PICKUP'&&order.status!=='RESERVED')throw new ApiError(409,'Chỉ đơn đặt trước mới được giao hàng.');
      if(action==='PICKUP'&&(order.pickupDate>today||order.returnDate<today))throw new ApiError(409,'Chưa đến lịch nhận hoặc đã qua ngày trả; cần điều chỉnh lịch trước.');
      if(action==='RETURN'&&order.status!=='PICKED_UP')throw new ApiError(409,'Chỉ đơn đã giao mới được kiểm nhận trả hàng.');
      if(action==='CANCEL'&&order.status!=='RESERVED')throw new ApiError(409,'Chỉ có thể hủy đơn chưa giao.');
      if(action==='CANCEL'&&order.paid>0)throw new ApiError(409,'Đơn đã thu tiền. Cần xử lý hoàn tiền trước khi hủy.');
      if(me.role==='staff'&&['RETURNED','CANCELLED'].includes(order.status))throw new ApiError(403,'Đơn đã hoàn tất chỉ Admin được truy cập.');
      if(action==='PAY'&&order.status==='CANCELLED')throw new ApiError(409,'Đơn đã hủy không thể thu tiền.');
      if(action==='PAY'&&order.paid+amount>order.total+(order.compensationTotal||0)+(order.lateFeeTotal||0)+(order.otherFeeTotal||0))throw new ApiError(400,'Số tiền vượt công nợ gồm cả phí đền bù.');

      if(action==='EXTEND'){
        if(typeof b.returnDate!=='string')throw new ApiError(400,'Vui lòng chọn ngày trả mới.');
        let plan:ReturnType<typeof planRentalExtension>;
        try{plan=planRentalExtension(order,b.returnDate,today);}
        catch(e){throw new ApiError(409,e instanceof Error?e.message:'Ngày gia hạn không hợp lệ.');}
        const currentSlots=order.lines.reduce((sum,line)=>sum+lineOccupiedDays(line,order).length,0);
        assertSlotCapacity(currentSlots+plan.additionalSlots.length);
        const refs=plan.additionalSlots.map(s=>db().collection('rentalSlots').doc(slotId(s.itemId,s.day)));
        const itemRefs=order.lines.map(line=>db().collection('items').doc(line.itemId));
        // Read all documents before writing: Firestore transactions require that order.
        const lockSnaps=await Promise.all(refs.map(r=>tx.get(r)));
        const itemSnaps=await Promise.all(itemRefs.map(r=>tx.get(r)));
        // GU v5 blocks hourly intervals. Legacy extensions occupy an entire day and must not overlap any v5 reservation.
        const hourlySnaps=await Promise.all(plan.additionalSlots.map(s=>tx.get(db().collection('v5DayIntervals').doc(s.itemId+'_'+s.day))));
        if(hourlySnaps.some(s=>Array.isArray(s.data()?.entries)&&s.data()!.entries.length>0))throw new ApiError(409,'Lịch theo giờ đã được giữ bởi đơn phiên bản mới.');
        const conflicts=lockSnaps.flatMap((snap,i)=>snap.exists?[{date:plan.additionalSlots[i].day,itemId:plan.additionalSlots[i].itemId}]:[]);
        if(conflicts.length)throw new ApiError(409,'Lịch gia hạn trùng với đơn khác.',conflicts.slice(0,10));
        if(itemSnaps.some(s=>!s.exists||s.data()?.archivedAt||['MISSING','MAINTENANCE'].includes(String(s.data()?.status))))
          throw new ApiError(409,'Có sản phẩm đã thất lạc, bảo trì hoặc ngừng kinh doanh; không thể gia hạn.');
        if(order.status==='PICKED_UP' && itemSnaps.some(s=>s.data()?.status!=='RENTED'||s.data()?.currentOrderId!==id))
          throw new ApiError(409,'Có sản phẩm không còn ở trạng thái thuê của đơn này.');
        const now=new Date().toISOString();
        syncDebtIndex(tx,db(),{...order,total:plan.newTotal,returnDate:plan.nextReturnDate,updatedAt:now});
        tx.update(ref,{
          returnDate:plan.nextReturnDate,rentalDays:plan.rentalDays,
          total:plan.newTotal,lines:plan.newLines,updatedAt:now,
          history:[...order.history,{action:'EXTEND',by:me.uid,at:now,
            detail:`Gia hạn ${order.returnDate} → ${plan.nextReturnDate}; thêm ${plan.addedDays} ngày; phí thuê thêm ${plan.additionalTotal} VND`,
            amount:plan.additionalTotal}]
        });
        refs.forEach((r,i)=>tx.create(r,{orderId:id,itemId:plan.additionalSlots[i].itemId,date:plan.additionalSlots[i].day}));
        if(order.status==='PICKED_UP')itemRefs.forEach(r=>tx.update(r,{expectedReturnDate:plan.nextReturnDate}));
        auditInTransaction(tx,me,'ORDER_EXTEND','order',id,
          `${order.code}: ${order.returnDate} → ${plan.nextReturnDate}; tăng ${plan.additionalTotal} VND`,now);
        return;
      }

      if(action==='ADD_ITEMS'){
        let start:string;
        try{start=extraStartDate(order,today);}catch(e){throw new ApiError(409,(e as Error).message);}
        const existing=new Set(order.lines.map(l=>l.itemId));
        if((addIds as string[]).some(x=>existing.has(x)))throw new ApiError(409,'Sản phẩm đã có trong đơn.');
        const itemRefs=(addIds as string[]).map(x=>db().collection('items').doc(x));
        const itemSnaps=await Promise.all(itemRefs.map(x=>tx.get(x)));
        if(itemSnaps.some(s=>!s.exists))throw new ApiError(404,'Không tìm thấy sản phẩm thêm vào.');
        const newItems=itemSnaps.map(s=>({id:s.id,...s.data()} as InventoryItem));
        assertItems(newItems);
        if(order.status==='PICKED_UP')mustBeReadyAtPickup(newItems);
        const newLines=makeAddedLines(newItems,start,order.returnDate);
        const slotList=newLines.flatMap(l=>lineOccupiedDays(l,order).map(day=>({line:l,day,ref:db().collection('rentalSlots').doc(slotId(l.itemId,day))})));
        // Count every existing lock and new lock for transaction safety.
        assertSlotCapacity(slotList.length+order.lines.reduce((s,l)=>s+lineOccupiedDays(l,order).length,0));
        const locks=await Promise.all(slotList.map(x=>tx.get(x.ref)));
        const hourlySnaps=await Promise.all(slotList.map(s=>tx.get(db().collection('v5DayIntervals').doc(s.line.itemId+'_'+s.day))));
        if(hourlySnaps.some(s=>Array.isArray(s.data()?.entries)&&s.data()!.entries.length>0))throw new ApiError(409,'Món bổ sung đã có lịch theo giờ từ GU mới.');
        const conflicts=locks.flatMap((s,i)=>s.exists?[{sku:slotList[i].line.sku,date:slotList[i].day}]:[]);
        if(conflicts.length)throw new ApiError(409,'Các sản phẩm thêm vào đã có người giữ lịch.',conflicts.slice(0,10));
        const now=new Date().toISOString();
        syncDebtIndex(tx,db(),{...order,total:order.total+newLines.reduce((s,l)=>s+l.lineTotal,0),updatedAt:now});
        tx.update(ref,{lines:[...order.lines,...newLines],total:order.total+newLines.reduce((s,l)=>s+l.lineTotal,0),updatedAt:now,
          history:[...order.history,{action:'ADD_ITEMS',by:me.uid,at:now,detail:'Thêm '+newLines.map(l=>l.sku).join(', ')}]});
        slotList.forEach(({line,day,ref:r})=>tx.create(r,{orderId:id,itemId:line.itemId,date:day}));
        if(order.status==='PICKED_UP')itemRefs.forEach(r=>tx.update(r,{status:'RENTED',currentOrderId:id,expectedReturnDate:order.returnDate}));
        auditInTransaction(tx,me,'ORDER_ADD_ITEMS','order',id,`Thêm ${newLines.map(l=>l.sku).join(', ')} vào ${order.code}`,now);
        return;
      }

      const itemRefs=order.lines.map(l=>db().collection('items').doc(l.itemId));
      const slots=order.lines.flatMap(l=>lineOccupiedDays(l,order).map(day=>db().collection('rentalSlots').doc(slotId(l.itemId,day))));
      const itemSnaps=action==='PICKUP'||action==='RETURN'?await Promise.all(itemRefs.map(r=>tx.get(r))):[];
      const lockSnaps=action==='CANCEL'||action==='RETURN'?await Promise.all(slots.map(r=>tx.get(r))):[];
      if(itemSnaps.some(s=>!s.exists))throw new ApiError(409,'Có sản phẩm trong đơn không còn tồn tại.');
      if(action==='PICKUP'&&itemSnaps.some(s=>s.data()?.status!=='AVAILABLE'))throw new ApiError(409,'Có sản phẩm đang giặt, đang cho thuê, bảo trì hoặc chưa sẵn sàng.');
      if((action==='CANCEL'||action==='RETURN')&&lockSnaps.some(s=>s.exists&&s.data()?.orderId!==id))throw new ApiError(409,'Lịch giữ hàng có xung đột; cần kiểm tra thủ công.');
      let inspections:ReturnInspection[]=[];
      if(action==='RETURN'){
        try{inspections=calculateInspection(order.lines,b.inspection,Object.fromEntries(order.lines.map((l,i)=>[l.itemId,Number(itemSnaps[i].data()?.replacementValue||0)])));}
        catch(e){const message=e instanceof Error?e.message:'Checklist không hợp lệ.';throw new ApiError(message.startsWith('Admin')?409:400,message);}
      }
      const compensationTotal=inspections.reduce((s,c)=>s+c.compensation,0);
      const overdue=action==='RETURN'?lateDays(order.returnDate,today):0;
      const lateBase=action==='RETURN'?lateBaseCharge(order.lines,order.returnDate,today):0;
      // Late fees always come from the server clock and snapshotted rental rates.
      // Clients cannot type/override them during return processing.
      if(action==='RETURN'&&b.lateFeeTotal!==undefined)
        throw new ApiError(400,'Phí trả trễ được hệ thống tự tính, không cần nhập lại.');
      const specifiedLate=lateBase;
      const otherFee=action==='RETURN'&&b.otherFeeTotal!==undefined?positiveVnd(b.otherFeeTotal,'Phụ phí khác',true):0;
      const surchargeNote=action==='RETURN'?assertText(b.surchargeNote??'','Lý do phụ phí',300,false):'';
      if(action==='RETURN'&&otherFee>0&&!surchargeNote)throw new ApiError(400,'Hãy nhập lý do khi thêm phụ phí khác.');
      if(action==='RETURN'&&b.collectRemainingAtReturn!==undefined&&typeof b.collectRemainingAtReturn!=='boolean')
        throw new ApiError(400,'Xác nhận thu tiền không hợp lệ.');
      if(action==='RETURN'&&b.collectRemainingAtReturn===true&&b.collectedAtReturn!==undefined)
        throw new ApiError(400,'Không được chọn hai cách thu tiền cùng lúc.');
      const maxCollection=order.total+compensationTotal+specifiedLate+otherFee-order.paid;
      // Backward-compatible with the older manually-entered collection field.
      // New mobile flow sends only a boolean; amount is computed inside the transaction.
      const collectedAtReturn=action==='RETURN'&&b.collectRemainingAtReturn===true
        ?Math.max(0,maxCollection)
        :action==='RETURN'&&b.collectedAtReturn!==undefined?positiveVnd(b.collectedAtReturn,'Tiền thu khi trả',true):0;
      if(action==='RETURN'&&maxCollection<0)throw new ApiError(409,'Đơn có số dư đã thu lớn hơn tổng tiền. Admin cần kiểm tra trước khi trả.');
      if(action==='RETURN'&&collectedAtReturn>maxCollection)
        throw new ApiError(400,'Số tiền thu vượt công nợ sau khi tính tất cả phụ thu.');
      const now=new Date().toISOString();
      const cashCollected=amount+collectedAtReturn;
      if(cashCollected>0){
        // Daily cash report: constant-size counter, no scanning historical orders.
        const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));
        tx.set(db().collection('cashDaily').doc(date),{amount:FieldValue.increment(cashCollected),payments:FieldValue.increment(1),updatedAt:now},{merge:true});
      }
      const status=action==='PICKUP'?'PICKED_UP':action==='RETURN'?'RETURNED':action==='CANCEL'?'CANCELLED':order.status;
      syncDebtIndex(tx,db(),{...order,status,paid:order.paid+amount+collectedAtReturn,updatedAt:now,
        ...(action==='RETURN'?{compensationTotal,lateFeeTotal:specifiedLate,otherFeeTotal:otherFee}:{}),
      });
      tx.update(ref,{status,paid:order.paid+amount+collectedAtReturn,updatedAt:now,
        ...(action==='RETURN'?{compensationTotal,returnInspection:inspections,returnedAt:now,lateDays:overdue,lateFeeTotal:specifiedLate,otherFeeTotal:otherFee,surchargeNote}:{}),
        history:[...order.history,{action,by:me.uid,at:now,
          ...(action==='PAY'?{amount,detail:`Đã thu ${amount} VND`}:{}),
          ...(action==='RETURN'?{detail:`Nhận ${inspections.filter(x=>x.status==='OK').length} món, thiếu ${inspections.filter(x=>x.status==='MISSING').length} món, đền bù ${compensationTotal} VND, trễ ${overdue} ngày/${specifiedLate} VND, phụ thu khác ${otherFee} VND (${surchargeNote})`}:{})},...(collectedAtReturn>0?[{action:'PAY',by:me.uid,at:now,amount:collectedAtReturn,detail:'Thu tiền khi nhận trả'}]:[])]
      });
      if(action==='PICKUP')itemRefs.forEach(r=>tx.update(r,{status:'RENTED',currentOrderId:id,expectedReturnDate:order.returnDate}));
      if(action==='RETURN')itemRefs.forEach((r,i)=>{
        const item={...itemSnaps[i].data()} as InventoryItem;
        const status=postReturnStockStatus(item,inspections[i].status);
        tx.update(r,{status,currentOrderId:null,expectedReturnDate:null,
          ...(status==='LAUNDRY'?{laundryStartedAt:now,laundryCompletedAt:null}:{})});
      });
      if(action==='CANCEL'||action==='RETURN')lockSnaps.forEach((snap,i)=>{if(snap.exists)tx.delete(slots[i]);});
      auditInTransaction(tx,me,`ORDER_${action}`,'order',id,
        `Đơn ${order.code}${action==='RETURN'?`; thiếu ${inspections.filter(x=>x.status==='MISSING').map(x=>x.sku).join(', ')||'không'}; phí ${compensationTotal} VND`:action==='PAY'?`; thu ${amount} VND`:''}`,now);
    });
    return NextResponse.json({ok:true});
  }catch(e){return handleError(e,'/api/orders/[id]');}
}
