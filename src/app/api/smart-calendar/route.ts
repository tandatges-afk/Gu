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
      const q=String(b.query||'').trim().slice(0,80);
      const limit=40;
      // Cheap discovery: only a page of products, then exact per-item locks. Never scan all rentalSlots.
      let itemQuery=db().collection('items').orderBy('name').limit(limit);
      if(q)itemQuery=db().collection('items').orderBy('name').startAt(q).endAt(q+'\uf8ff').limit(limit);
      const stock=await itemQuery.get();
      const candidates=stock.docs.map(d=>({id:d.id,...d.data()} as InventoryItem))
        .filter(item=>!blockedReason(item,today));
      const dates=Array.from({length:rentalDays},(_,index)=>addDays(start,index));
      if(dates.length>31)throw new ApiError(400,'Chỉ tra cứu nhanh trong khoảng tối đa 31 ngày.');
      const pairs=candidates.flatMap(item=>dates.map(date=>({item,date,ref:db().collection('rentalSlots').doc(slotId(item.id,date))})));
      const busyIds=new Set<string>();
      for(let offset=0;offset<pairs.length;offset+=300){
        const batch=pairs.slice(offset,offset+300);
        const snaps=await db().getAll(...batch.map(p=>p.ref));
        snaps.forEach((snap,i)=>{if(snap.exists)busyIds.add(batch[i].item.id);});
      }
      const available=candidates.filter(i=>!busyIds.has(i.id));
      return NextResponse.json({mode:'FIND_AVAILABLE',pickupDate:start,returnDate:end,
        availableIds:available.map(i=>i.id),products:available,checkedItems:stock.size,
        checkedAt:new Date().toISOString(),hasMore:stock.size===limit},
        {headers:{'Cache-Control':'no-store'}});
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
