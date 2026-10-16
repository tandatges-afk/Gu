import { addDays, daysInclusive, occupiedDays, parseDate, vietnamToday } from './rental.ts';
import type { RentalLine, RentalOrder } from './types';

/** A rental extension changes the contractual return date; it is not a late-return fee.
 * We deliberately disallow backdating once a booking is overdue, so overdue charges
 * cannot be silently erased by staff. The server is authoritative for price and slots.
 */
export function planRentalExtension(
  order: Pick<RentalOrder,'status'|'pickupDate'|'returnDate'|'lines'|'total'>,
  nextReturnDate: string,
  today=vietnamToday()
) {
  if(order.status!=='RESERVED' && order.status!=='PICKED_UP')
    throw new Error('Chỉ gia hạn đơn đang giữ lịch hoặc đang thuê.');
  parseDate(nextReturnDate);
  if(order.returnDate<today)
    throw new Error('Đơn đã quá hạn; hãy nhận trả và tính phí trễ thay vì gia hạn hồi tố.');
  if(nextReturnDate<=order.returnDate)
    throw new Error('Ngày trả mới phải sau ngày trả đã hẹn.');
  const rentalDays=daysInclusive(order.pickupDate,nextReturnDate);
  const addedDays=daysInclusive(addDays(order.returnDate,1),nextReturnDate);
  const newLines: RentalLine[]=order.lines.map(line=>({
    ...line,
    lineTotal:line.lineTotal+addedDays*line.dailyRate
  }));
  // Compare full date sets so legacy bufferDays can stay locked without an
  // accidental conflict against the order's own existing slot documents.
  const additionalSlots=order.lines.flatMap(line=>{
    const start=line.startDate||order.pickupDate;
    const previous=new Set(occupiedDays(start,order.returnDate,line.bufferDays||0));
    return occupiedDays(start,nextReturnDate,line.bufferDays||0)
      .filter(day=>!previous.has(day))
      .map(day=>({itemId:line.itemId,day}));
  });
  const additionalTotal=addedDays*order.lines.reduce((sum,line)=>sum+line.dailyRate,0);
  return {nextReturnDate,rentalDays,addedDays,additionalTotal,newTotal:order.total+additionalTotal,newLines,additionalSlots};
}
