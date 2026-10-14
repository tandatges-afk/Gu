import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { staffUser, handleError, jsonBody, ApiError } from '@/lib/http';
import { assertText, positiveVnd, slotId } from '@/lib/rental';
import { rentalRequest, assertItems } from '@/lib/booking-server';
import { Customer, InventoryItem, RentalLine, RentalOrder } from '@/lib/types';
import { auditInTransaction } from '@/lib/audit';
export const runtime = 'nodejs';
export const preferredRegion = 'sin1';
export async function POST(req:NextRequest) {
  try {
    const me=await staffUser(req);
    const b=await jsonBody(req);
    const parsed=rentalRequest(b);
    const customerId=assertText(b.customerId,'Khách hàng',80);
    if(!/^[a-zA-Z0-9]{10,64}$/.test(customerId)) throw new ApiError(400,'Mã khách hàng không hợp lệ.');
    const note=assertText(b.note??'','Ghi chú',500,false);
    const depositDue=positiveVnd(b.depositDue??0,'Tiền cọc',true);
    const ref=db().collection('orders').doc();
    const itemRefs=parsed.itemIds.map(id=>db().collection('items').doc(id));
    const customerRef=db().collection('customers').doc(customerId);
    const now=new Date().toISOString();
    const result=await db().runTransaction(async tx=>{
      // All reads precede ALL writes, so Firestore can retry safely on contention.
      const [customerSnap,...itemSnaps]=await Promise.all([tx.get(customerRef),...itemRefs.map(r=>tx.get(r))]);
      if(!customerSnap.exists) throw new ApiError(404,'Không tìm thấy khách hàng.');
      if(itemSnaps.some(s=>!s.exists)) throw new ApiError(404,'Có sản phẩm không tồn tại.');
      const customer={id:customerSnap.id,...customerSnap.data()} as Customer;
      const items=itemSnaps.map(s=>({id:s.id,...s.data()} as InventoryItem));
      assertItems(items);
      const slots=items.flatMap(item=>Array.from({length:parsed.rentalDays+item.bufferDays},(_,i)=>{
        const date=new Date(Date.parse(parsed.pickupDate+'T00:00:00Z')+i*86400000).toISOString().slice(0,10);
        return {item,day:date,ref:db().collection('rentalSlots').doc(slotId(item.id,date))};
      }));
      const lockSnaps=await Promise.all(slots.map(s=>tx.get(s.ref)));
      const conflicts=lockSnaps.flatMap((snap,i)=>snap.exists?[{sku:slots[i].item.sku,date:slots[i].day}]:[]);
      if(conflicts.length) throw new ApiError(409,'Lịch thuê đã bị giữ bởi đơn khác. Vui lòng đổi ngày hoặc sản phẩm.',conflicts.slice(0,10));
      const lines:RentalLine[]=items.map(item=>({itemId:item.id,name:item.name,sku:item.sku,size:item.size,dailyRate:item.dailyRate,bufferDays:item.bufferDays,replacementValue:item.replacementValue,lineTotal:item.dailyRate*parsed.rentalDays}));
      const total=lines.reduce((sum,l)=>sum+l.lineTotal,0);
      if(depositDue>total) throw new ApiError(400,'Tiền cọc không thể cao hơn tổng đơn.');
      const code='TH-'+now.slice(2,10).replace(/-/g,'')+'-'+ref.id.slice(0,5).toUpperCase();
      const order:Omit<RentalOrder,'id'>={code,customerId,customerName:customer.name,customerPhone:customer.phone,...parsed,lines,total,paid:0,depositDue,note,status:'RESERVED',createdAt:now,updatedAt:now,createdBy:me.uid,history:[{action:'RESERVED',by:me.uid,at:now}]};
      tx.create(ref,order);
      auditInTransaction(tx,me,'ORDER_CREATE','order',ref.id,`Tạo đơn ${code} / ${customer.name}`,now);
      slots.forEach(({item,day,ref:lockRef})=>tx.create(lockRef,{orderId:ref.id,itemId:item.id,date:day}));
      return {id:ref.id,...order};
    });
    return NextResponse.json(result,{status:201});
  }catch(e){return handleError(e);}
}
