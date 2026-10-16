import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { staffUser, handleError, jsonBody, ApiError } from '@/lib/http';
import { assertText, positiveVnd, occupiedDays, slotId, assertSlotCapacity } from '@/lib/rental';
import { rentalRequest, assertItems } from '@/lib/booking-server';
import { bookingMode, verifyImmediatePickup, mustBeReadyAtPickup } from '@/lib/booking-rules';
import type { Customer, InventoryItem, RentalLine, RentalOrder } from '@/lib/types';
import { auditInTransaction } from '@/lib/audit';
export const runtime = 'nodejs';
export const preferredRegion = 'sin1';
export async function POST(req:NextRequest) {
  try {
    const me=await staffUser(req);
    const b=await jsonBody(req);
    const parsed=rentalRequest(b);
    const mode=bookingMode(b.mode);
    verifyImmediatePickup(mode,parsed.pickupDate);
    const customerId=assertText(b.customerId,'Khách hàng',80);
    if(!/^[a-zA-Z0-9]{10,64}$/.test(customerId)) throw new ApiError(400,'Mã khách hàng không hợp lệ.');
    const note=assertText(b.note??'','Ghi chú',500,false);
    const depositDue=positiveVnd(b.depositDue??0,'Tiền cọc',true);
    const ref=db().collection('orders').doc();
    const itemRefs=parsed.itemIds.map(id=>db().collection('items').doc(id));
    const customerRef=db().collection('customers').doc(customerId);
    const now=new Date().toISOString();
    const result=await db().runTransaction(async tx=>{
      const [customerSnap,...itemSnaps]=await Promise.all([tx.get(customerRef),...itemRefs.map(r=>tx.get(r))]);
      if(!customerSnap.exists) throw new ApiError(404,'Không tìm thấy khách hàng.');
      if(itemSnaps.some(s=>!s.exists)) throw new ApiError(404,'Có sản phẩm không tồn tại.');
      const customer={id:customerSnap.id,...customerSnap.data()} as Customer;
      const items=itemSnaps.map(s=>({id:s.id,...s.data()} as InventoryItem));
      assertItems(items);
      if(mode==='PICKUP')mustBeReadyAtPickup(items);
      const slots=items.flatMap(item=>occupiedDays(parsed.pickupDate,parsed.returnDate,0)
        .map(day=>({item,day,ref:db().collection('rentalSlots').doc(slotId(item.id,day))})));
      assertSlotCapacity(slots.length);
      const lockSnaps=await Promise.all(slots.map(s=>tx.get(s.ref)));
      const conflicts=lockSnaps.flatMap((snap,i)=>snap.exists?[{sku:slots[i].item.sku,date:slots[i].day}]:[]);
      if(conflicts.length) throw new ApiError(409,'Lịch thuê đã bị giữ bởi đơn khác.',conflicts.slice(0,10));
      const lines:RentalLine[]=items.map(item=>({itemId:item.id,name:item.name,sku:item.sku,hangerCode:item.hangerCode||'',size:item.size,dailyRate:item.dailyRate,bufferDays:0,replacementValue:item.replacementValue,lineTotal:item.dailyRate*parsed.rentalDays,startDate:parsed.pickupDate}));
      const total=lines.reduce((sum,l)=>sum+l.lineTotal,0);
      if(depositDue>total) throw new ApiError(400,'Tiền cọc không thể cao hơn tổng đơn.');
      const code='TH-'+now.slice(2,10).replace(/-/g,'')+'-'+ref.id.slice(0,5).toUpperCase();
      const status=mode==='PICKUP'?'PICKED_UP':'RESERVED';
      const order:Omit<RentalOrder,'id'>={code,customerId,customerName:customer.name,customerPhone:customer.phone,
        pickupDate:parsed.pickupDate,returnDate:parsed.returnDate,rentalDays:parsed.rentalDays,lines,total,paid:0,depositDue,note,status,
        createdAt:now,updatedAt:now,createdBy:me.uid,createdByName:me.name,history:[{action:status==='RESERVED'?'RESERVED':'PICKUP',by:me.uid,at:now,detail:mode==='PICKUP'?'Tạo đơn và giao đồ ngay':'Đặt lịch, chờ giao đồ'}]};
      tx.create(ref,order);
      auditInTransaction(tx,me,mode==='PICKUP'?'ORDER_CREATE_PICKUP':'ORDER_RESERVE','order',ref.id,`${code} / ${customer.name} / ${items.length} món`,now);
      slots.forEach(({item,day,ref:lockRef})=>tx.create(lockRef,{orderId:ref.id,itemId:item.id,date:day}));
      if(mode==='PICKUP')itemRefs.forEach(r=>tx.update(r,{status:'RENTED',currentOrderId:ref.id,expectedReturnDate:parsed.returnDate}));
      return {id:ref.id,...order};
    });
    return NextResponse.json(result,{status:201});
  }catch(e){return handleError(e);}
}
