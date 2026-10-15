import { daysInclusive, occupiedDays, requiresLaundry, assertSlotCapacity, vietnamToday } from './rental.ts';
import type { InventoryItem, RentalLine, RentalOrder } from './types';

export function bookingMode(value: unknown): 'RESERVE'|'PICKUP' {
  if (value !== 'RESERVE' && value !== 'PICKUP') throw new Error('Chọn đặt lịch trước hoặc tạo đơn lấy ngay.');
  return value;
}
export function verifyImmediatePickup(mode:'RESERVE'|'PICKUP', pickupDate:string, today=vietnamToday()) {
  if (mode==='PICKUP' && pickupDate!==today) throw new Error('Đơn giao ngay phải nhận đồ trong ngày hôm nay. Nếu nhận sau, hãy chọn Đặt lịch trước.');
}
export function mustBeReadyAtPickup(items: InventoryItem[]): void {
  const blocked=items.filter(i=>i.status!=='AVAILABLE');
  if(blocked.length)throw new Error('Chưa thể giao đồ đang thuê, đang giặt, bảo trì hoặc thất lạc: '+blocked.map(i=>i.sku).join(', '));
}
export function extraStartDate(order:Pick<RentalOrder,'status'|'pickupDate'|'returnDate'>,today=vietnamToday()):string {
  if(order.status!=='RESERVED'&&order.status!=='PICKED_UP')throw new Error('Chỉ thêm đồ vào đơn đang giữ hoặc đang thuê.');
  if(order.status==='PICKED_UP' && today>order.returnDate)throw new Error('Đơn đã quá hạn trả; hãy xử lý trả đồ trước.');
  return order.status==='PICKED_UP' ? (today>order.pickupDate ? today : order.pickupDate) : order.pickupDate;
}
export function lineOccupiedDays(line:Pick<RentalLine,'bufferDays'|'startDate'>,order:Pick<RentalOrder,'pickupDate'|'returnDate'>) {
  return occupiedDays(line.startDate || order.pickupDate,order.returnDate,line.bufferDays);
}
export function makeAddedLines(items:InventoryItem[],start:string,end:string):RentalLine[] {
  const days=daysInclusive(start,end);
  assertSlotCapacity(items.reduce((count,item)=>count+occupiedDays(start,end,0).length,0));
  return items.map(item=>({itemId:item.id,name:item.name,sku:item.sku,size:item.size,dailyRate:item.dailyRate,bufferDays:0,replacementValue:item.replacementValue,lineTotal:days*item.dailyRate,startDate:start}));
}
export { requiresLaundry };
