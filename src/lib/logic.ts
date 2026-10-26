/** Pure rules shared by client/API and test harness. */
export function overlap(aStart:number,aEnd:number,bStart:number,bEnd:number){return aStart<bEnd&&bStart<aEnd;}
export function normalizeVN(v:string){return v.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').toLowerCase().trim();}
export function bookingDays(a:number,b:number){if(!Number.isFinite(a)||!Number.isFinite(b)||b<=a)throw Error('Khoảng thuê không hợp lệ');return Math.max(1,Math.ceil((b-a)/86400000));}
export function rentalBalance(total:number,paid:number){return Math.max(0,total-paid);}
