/** GU 24-hour pricing. Every completed OR commenced 24h block counts, up to 30 blocks. */
export type RentalKind = 'CLOTHING'|'ACCESSORY';
export const DAY_MS=86_400_000;
export function localDateTimeToISO(value:string):string {
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))throw new Error('Thời gian phải có ngày và giờ (VN).');
  const d=new Date(value+':00+07:00');
  if(!Number.isFinite(d.getTime())||new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(d).replace(' ','T')!==value)throw new Error('Ngày giờ Việt Nam không hợp lệ.');
  return d.toISOString();
}
export function billableBlocks(start:string,end:string):number {
  const a=Date.parse(start),b=Date.parse(end);
  if(!Number.isFinite(a)||!Number.isFinite(b)||b<=a)throw new Error('Giờ trả phải sau giờ nhận.');
  const blocks=Math.ceil((b-a)/DAY_MS);
  if(blocks>30)throw new Error('Mỗi lượt thuê tối đa 30 chu kỳ 24 giờ.');
  return Math.max(1,blocks);
}
export function rentalKind(category:string):RentalKind {return /phụ\s*kiện|phu\s*kien|accessor/i.test(category)?'ACCESSORY':'CLOTHING';}
export function rentForBlocks(kind:RentalKind,blocks:number):number {
  if(!Number.isInteger(blocks)||blocks<1||blocks>30)throw new Error('Số chu kỳ phải từ 1 đến 30.');
  // Day 1, 5, 10, 15, 20, 25, 30: base bump; all other days +10,000.
  let amount=0;
  for(let n=1;n<=blocks;n++)amount+=(n===1||n%5===0)?(kind==='CLOTHING'?50_000:20_000):10_000;
  return amount;
}
export function priceForElapsed(kind:RentalKind,startISO:string,endISO:string):number {return rentForBlocks(kind,billableBlocks(startISO,endISO));}
export function vnDayKey(instant:string):string {
  const d=new Date(instant);if(!Number.isFinite(d.getTime()))throw new Error('Ngày giờ không hợp lệ.');
  return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
}
export type DayPart={key:string;start:string;end:string};
export function splitIntoVietnamDays(startISO:string,endISO:string):DayPart[] {
  billableBlocks(startISO,endISO);
  const s=Date.parse(startISO),end=Date.parse(endISO);const result:DayPart[]=[];
  let cursor=s;
  while(cursor<end){
    const day=vnDayKey(new Date(cursor).toISOString());
    const midnight=Date.parse(day+'T00:00:00+07:00');
    const cutoff=Math.min(end,midnight+DAY_MS);
    if(cutoff<=cursor)throw new Error('Không thể chia khoảng thời gian.');
    result.push({key:day,start:new Date(cursor).toISOString(),end:new Date(cutoff).toISOString()});
    cursor=cutoff;
  }
  return result;
}
export function overlap(aStart:string,aEnd:string,bStart:string,bEnd:string){return Date.parse(aStart)<Date.parse(bEnd)&&Date.parse(bStart)<Date.parse(aEnd);}
