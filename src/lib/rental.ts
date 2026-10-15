/** Pure date and money utilities, use UTC calendar arithmetic (never local timezone increments). */
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86400000;
export function parseDate(value: string): number {
  if (!DATE_RE.test(value)) throw new Error('Ngày phải có định dạng YYYY-MM-DD.');
  const epoch = Date.parse(value + 'T00:00:00.000Z');
  if (!Number.isFinite(epoch) || new Date(epoch).toISOString().slice(0,10) !== value)
    throw new Error('Ngày không hợp lệ.');
  return epoch;
}
export function addDays(value: string, offset: number): string {
  return new Date(parseDate(value) + offset * DAY_MS).toISOString().slice(0,10);
}
export function daysInclusive(start: string, end: string): number {
  const n = Math.round((parseDate(end) - parseDate(start)) / DAY_MS) + 1;
  if (n < 1 || n > 30) throw new Error('Thời gian thuê phải từ 1 đến 30 ngày (tính cả ngày trả).');
  return n;
}
export function occupiedDays(start: string, end: string, bufferDays: number): string[] {
  const count = daysInclusive(start, end);
  if (!Number.isInteger(bufferDays) || bufferDays < 0 || bufferDays > 2)
    throw new Error('Ngày đệm phải nằm trong khoảng 0–2.');
  return Array.from({length: count + bufferDays}, (_, i) => addDays(start, i));
}
export function slotId(itemId: string, date: string): string {
  if (!/^[a-zA-Z0-9]{10,64}$/.test(itemId)) throw new Error('Mã sản phẩm không hợp lệ.');
  parseDate(date);
  return itemId + '__' + date;
}
export function vietnamToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date());
}
/** Number of calendar dates after the scheduled return; never changes the original booking. */
export function lateDays(returnDate:string, actualDate:string):number {
  const delta=Math.round((parseDate(actualDate)-parseDate(returnDate))/DAY_MS);
  return Math.max(0,delta);
}
/** Base charge for every overdue day; input rates were snapshotted at booking time. */
export function lateBaseCharge(lines:{dailyRate:number}[],returnDate:string,actualDate:string):number {
  return lateDays(returnDate,actualDate)*lines.reduce((sum,line)=>sum+line.dailyRate,0);
}
export function money(value: number): string { return new Intl.NumberFormat('vi-VN').format(value) + ' ₫'; }
export function assertText(value: unknown, label: string, max = 160, required = true): string {
  if (typeof value !== 'string') throw new Error(`${label} không hợp lệ.`);
  const trimmed = value.trim();
  if ((required && !trimmed) || trimmed.length > max) throw new Error(`${label} phải có tối đa ${max} ký tự.`);
  return trimmed;
}
export function positiveVnd(value: unknown, label: string, allowZero = false): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < (allowZero ? 0 : 1) || value > 1_000_000_000)
    throw new Error(`${label} phải là số tiền VND hợp lệ.`);
  return value;
}

/** Normalize Vietnamese phone for matching existing customers and uniqueness keys. */
export function normalizePhone(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Số điện thoại không hợp lệ.');
  const phone = value.trim().replace(/[\s.()-]/g, '');
  if (!/^\+?\d{9,13}$/.test(phone)) throw new Error('Số điện thoại không hợp lệ.');
  return phone.startsWith('+84') ? '0' + phone.slice(3) : phone.startsWith('84') && phone.length===11 ? '0'+phone.slice(2):phone;
}

/** New items only require laundry after return when the product is marked so. Legacy bufferDays=1 means laundry. */
export function requiresLaundry(item: {requiresLaundry?:boolean; bufferDays?:number}): boolean {
  return typeof item.requiresLaundry === 'boolean' ? item.requiresLaundry : (item.bufferDays || 0) > 0;
}

/** Protect Firestore transactions from growing past Firestore's 500-write limit. */
export function assertSlotCapacity(slotCount:number): void {
  if(slotCount > 400) throw new Error('Đơn có quá nhiều ngày chiếm lịch (tối đa 400 ô lịch cho một lần lưu). Hãy chia thành nhiều đơn hoặc rút ngắn thời gian thuê.');
}
