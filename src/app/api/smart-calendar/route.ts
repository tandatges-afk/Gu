import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/firebase-admin';
import {staffUser,handleError,jsonBody,ApiError} from '@/lib/http';
import {addDays,slotId,vietnamToday} from '@/lib/rental';
import {validateSmartRange,nearestFreeStart} from '@/lib/smart-calendar';
import type {InventoryItem} from '@/lib/types';
export const runtime='nodejs';
export const preferredRegion='sin1';
const blockedReason=(i:InventoryItem,today:string)=>i.archivedAt?'Sản phẩm đã lưu trữ':i.status==='LAUNDRY'?'Sản phẩm đang giặt':i.status==='MAINTENANCE'?'Sản phẩm đang bảo trì':i.status==='MISSING'?'Sản phẩm thất lạc':!(i.replacementValue>0)?'Chưa được duyệt giá đền bù':i.status==='RENTED'&&(!i.expectedReturnDate||i.expectedReturnDate<today)?'Đồ chưa trả, cần xử lý đơn quá hạn':'';
export async function POST(req:NextRequest){
  try {
    await staffUser(req);
    const b=await jsonBody(req),today=vietnamToday();
    const start=String(b.pickupDate||''),end=String(b.returnDate||'');
    const rentalDays=validateSmartRange(start,end,today);
    if(b.mode==='FIND_AVAILABLE'){
      // The date index on rentalSlots is a built-in Firestore single-field index.
      // Query all occupied slots for the selected interval, not the possibly-truncated dashboard's recent orders.
      // Fail closed if the store is beyond the safe query cap.
      const [stock,locks]=await Promise.all([
        db().collection('items').limit(300).get(),
        db().collection('rentalSlots').where('date','>=',start).where('date','<=',end).limit(4001).get()
      ]);
      if(locks.size>4000)throw new ApiError(409,'Lịch thuê có quá nhiều bản ghi; vui lòng thu hẹp ngày tra cứu.');
      const occupied=new Set(locks.docs.map(d=>String(d.data().itemId||'')));
      const availableIds=stock.docs.filter(d=>!blockedReason({id:d.id,...d.data()} as InventoryItem,today)&&!occupied.has(d.id)).map(d=>d.id);
      return NextResponse.json({mode:'FIND_AVAILABLE',pickupDate:start,returnDate:end,availableIds,checkedItems:stock.size,checkedAt:new Date().toISOString()},{headers:{'Cache-Control':'no-store'}});
    }
    if(b.mode==='NEXT_AVAILABLE'){
      const itemId=b.itemId;
      if(typeof itemId!=='string'||!/^[a-zA-Z0-9]{10,64}$/.test(itemId))throw new ApiError(400,'Sản phẩm không hợp lệ.');
      const ref=db().collection('items').doc(itemId),snap=await ref.get();
      if(!snap.exists)throw new ApiError(404,'Không tìm thấy sản phẩm.');
      const item={id:snap.id,...snap.data()} as InventoryItem;
      const reason=blockedReason(item,today);
      if(reason)return NextResponse.json({mode:'NEXT_AVAILABLE',itemId,nextPickupDate:null,nextReturnDate:null,reason});
      const days=Array.from({length:90+rentalDays},(_,index)=>addDays(start,index));
      const refs=days.map(date=>db().collection('rentalSlots').doc(slotId(itemId,date)));
      // At most 120 IDs. Exact lock read; does not require a composite index.
      const snapshots=await db().getAll(...refs);
      const occupied=new Set(snapshots.flatMap((s,i)=>s.exists?[days[i]]:[]));
      const next=nearestFreeStart(start,rentalDays,occupied);
      return NextResponse.json({mode:'NEXT_AVAILABLE',itemId,nextPickupDate:next,nextReturnDate:next?addDays(next,rentalDays-1):null,reason:next?'':'Không tìm thấy khoảng trống phù hợp trong 90 ngày tới.'},{headers:{'Cache-Control':'no-store'}});
    }
    throw new ApiError(400,'Chế độ tra cứu không hợp lệ.');
  }catch(e){return handleError(e);}
}
