import 'server-only';
import { db } from './firebase-admin';
import { ApiError } from './http';
import { occupiedDays, slotId, daysInclusive, vietnamToday, assertSlotCapacity } from './rental';
import { InventoryItem } from './types';

export function rentalRequest(b: Record<string,unknown>) {
  if (!Array.isArray(b.itemIds) || b.itemIds.length < 1 || b.itemIds.some(x=>typeof x!=='string' || !/^[a-zA-Z0-9]{10,64}$/.test(x)) || new Set(b.itemIds).size!==b.itemIds.length)
    throw new ApiError(400,'Hãy chọn ít nhất một sản phẩm, không chọn trùng món.');
  if (typeof b.pickupDate!=='string' || typeof b.returnDate!=='string') throw new ApiError(400,'Vui lòng chọn ngày nhận và trả.');
  const rentalDays=daysInclusive(b.pickupDate,b.returnDate);
  const totalSlots = b.itemIds.length * (rentalDays + 2);
  assertSlotCapacity(totalSlots);
  if (b.pickupDate < vietnamToday()) throw new ApiError(400,'Không thể tạo đơn cho ngày đã qua (giờ Việt Nam).');
  return {itemIds:b.itemIds as string[], pickupDate:b.pickupDate,returnDate:b.returnDate,rentalDays};
}
export function requiredSlots(items:InventoryItem[], start:string,end:string) {
  return items.flatMap(item=>occupiedDays(start,end,0).map(day=>({item,day,ref:db().collection('rentalSlots').doc(slotId(item.id,day))})));
}
export function assertItems(items:InventoryItem[]) {
  const blocked=items.filter(x=>Boolean(x.archivedAt) || x.status==='MAINTENANCE' || x.status==='LAUNDRY' || x.status==='MISSING' || !(x.replacementValue > 0) || (x.status==='RENTED' && !!x.expectedReturnDate && x.expectedReturnDate < vietnamToday()));
  if (blocked.length) throw new ApiError(409,'Sản phẩm đang giặt/bảo trì/thất lạc hoặc chưa được Admin định giá: '+blocked.map(x=>x.sku).join(', '));
}
