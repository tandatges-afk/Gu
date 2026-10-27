/** GU staff rota. All boundaries are evaluated in Asia/Ho_Chi_Minh (+07, no DST).
 * Pure module: shared by server, React and Node tests.
 */
export const TIME_ZONE = 'Asia/Ho_Chi_Minh';
export const SHIFT_MAX_STAFF = 2;
export const MIN_WORK_DAYS = 5;
export const SHIFT_GRACE_MINUTES = 15;
export const SHIFT_DEFS = [
  {id:'S1', label:'Ca sáng', start:'08:00', end:'13:00'},
  {id:'S2', label:'Ca trưa', start:'13:00', end:'17:00'},
  {id:'S3', label:'Ca tối', start:'17:00', end:'22:00'},
] as const;
export type ShiftId = typeof SHIFT_DEFS[number]['id'];
export type ShiftSeat = {uid:string;name:string;registeredAt:string};
export type ShiftSeats = Record<string,ShiftSeat[]>;
export type ShiftWeekRecord = {weekStart:string;seats:ShiftSeats;updatedAt?:string};
const VN_OFFSET_MS = 7*60*60*1000;
const MS_DAY = 24*60*60*1000;
function dateUTC(day:string){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day))throw Error('Ngày lịch ca không hợp lệ.');
 const parsed=new Date(day+'T00:00:00.000Z');
 if(Number.isNaN(parsed.getTime())||parsed.toISOString().slice(0,10)!==day)throw Error('Ngày lịch ca không hợp lệ.');
 return parsed;
}
export function addShiftDays(day:string,days:number){return new Date(dateUTC(day).getTime()+days*MS_DAY).toISOString().slice(0,10);}
export function vnDate(now:Date){return new Date(now.getTime()+VN_OFFSET_MS).toISOString().slice(0,10);}
export function vnHourMinute(now:Date){return new Date(now.getTime()+VN_OFFSET_MS).toISOString().slice(11,16);}
export function isoWeekMonday(day:string){const dayNumber=dateUTC(day).getUTCDay();return addShiftDays(day,-((dayNumber+6)%7));}
export function weekDays(monday:string){if(isoWeekMonday(monday)!==monday)throw Error('Tuần phải bắt đầu vào thứ Hai.');return Array.from({length:7},(_,i)=>addShiftDays(monday,i));}
export function shiftSlotId(date:string,shiftId:ShiftId){return date+'_'+shiftId;}
export function shiftSlots(monday:string){return weekDays(monday).flatMap(date=>SHIFT_DEFS.map(s=>({date,...s,key:shiftSlotId(date,s.id)})));}
export function shiftStartMillis(date:string,hour:string){const [hh,mm]=hour.split(':').map(Number);return dateUTC(date).getTime()+((hh*60+mm)*60*1000)-VN_OFFSET_MS;}
export function registrationPeriod(now:Date){
 const today=vnDate(now);const weekday=dateUTC(today).getUTCDay();
 const thisSunday=addShiftDays(today,(7-weekday)%7);
 const mins=Number(vnHourMinute(now).slice(0,2))*60+Number(vnHourMinute(now).slice(3));
 const isOpen=weekday===0&&mins>=12*60&&mins<20*60;
 const sunday=weekday===0&&mins>=20*60?addShiftDays(today,7):thisSunday;
 const weekStart=addShiftDays(sunday,1);
 return {isOpen,weekStart,weekEnd:addShiftDays(weekStart,6),opensAt:sunday+'T12:00:00+07:00',closesAt:sunday+'T20:00:00+07:00'};
}
/** Admin can open registration early for the UPCOMING week, in exactly one 8-hour window. */
export type EarlyRegistrationWindow={weekStart:string;opensAt:string;closesAt:string};
export function upcomingRegistrationWeek(now:Date){return addShiftDays(isoWeekMonday(vnDate(now)),7);}
export function earlyWindow(now:Date,weekStart:string):EarlyRegistrationWindow{
 if(weekStart!==upcomingRegistrationWeek(now))throw Error('Chỉ được mở sớm cho tuần sau.');
 return {weekStart,opensAt:now.toISOString(),closesAt:new Date(now.getTime()+8*60*60*1000).toISOString()};
}
export function effectiveRegistrationPeriod(now:Date,override?:EarlyRegistrationWindow|null){
 const normal=registrationPeriod(now);
 if(override&&override.weekStart===upcomingRegistrationWeek(now)&&Date.parse(override.opensAt)<=now.getTime()&&now.getTime()<Date.parse(override.closesAt))
  return {...normal,isOpen:true,weekStart:override.weekStart,weekEnd:addShiftDays(override.weekStart,6),opensAt:override.opensAt,closesAt:override.closesAt,early:true};
 return {...normal,early:false};
}
export function uniqueSelections(ids:unknown,monday:string){
 if(!Array.isArray(ids)||ids.length>21||ids.some(v=>typeof v!=='string'))throw Error('Danh sách ca đăng ký không hợp lệ.');
 const slots=new Set(shiftSlots(monday).map(s=>s.key));
 const values=new Set(ids as string[]);
 if(values.size!==ids.length||[...values].some(id=>!slots.has(id)))throw Error('Danh sách ca trùng hoặc ngoài tuần đăng ký.');
 const days=new Set([...values].map(id=>id.slice(0,10)));
 if(days.size<MIN_WORK_DAYS)throw Error('Mỗi tuần phải đăng ký ít nhất 5 NGÀY khác nhau.');
 return [...values].sort();
}
export function myShifts(seats:ShiftSeats,uid:string,monday:string){
 return shiftSlots(monday).filter(s=>(seats[s.key]||[]).some(x=>x.uid===uid));
}
export function currentStaffAccess(now:Date,uid:string,record?:ShiftWeekRecord|null){
 const today=vnDate(now);const monday=isoWeekMonday(today);
 const week=record?.weekStart===monday?record:null;
 const shifts=week?myShifts(week.seats||{},uid,monday):[];
 const current=shifts.find(s=>now.getTime()>=shiftStartMillis(s.date,s.start)&&now.getTime()<shiftStartMillis(s.date,s.end));
 // A staff session remains permitted for exactly 15 minutes after an assigned
 // shift, including when this is the last shift of the day.
 const grace=shifts.find(s=>now.getTime()>=shiftStartMillis(s.date,s.end)&&now.getTime()<shiftStartMillis(s.date,s.end)+SHIFT_GRACE_MINUTES*60_000);
 const slot=current||grace;
 const next=shifts.filter(s=>shiftStartMillis(s.date,s.start)>now.getTime()).sort((a,b)=>shiftStartMillis(a.date,a.start)-shiftStartMillis(b.date,b.start))[0];
 return {
   canWork:Boolean(slot),
   grace:Boolean(!current&&grace),
   activeSlot:slot?.key||null,
   shiftEndedAt:slot?new Date(shiftStartMillis(slot.date,slot.end)).toISOString():null,
   allowedUntil:slot?new Date(shiftStartMillis(slot.date,slot.end)+SHIFT_GRACE_MINUTES*60_000).toISOString():null,
   nextSlot:next?{id:next.key,startAt:new Date(shiftStartMillis(next.date,next.start)).toISOString()}:null,
   weekStart:monday,
 };
}
export function rosterStats(seats:ShiftSeats,monday:string){
 const stats=new Map<string,{name:string;days:Set<string>;shifts:number}>();
 for(const slot of shiftSlots(monday))for(const member of seats[slot.key]||[]){
  const st=stats.get(member.uid)||{name:member.name,days:new Set<string>(),shifts:0};
  st.days.add(slot.date);st.shifts++;stats.set(member.uid,st);
 }
 return [...stats.entries()].map(([uid,x])=>({uid,name:x.name,days:x.days.size,shifts:x.shifts,compliant:x.days.size>=MIN_WORK_DAYS})).sort((a,b)=>a.name.localeCompare(b.name,'vi'));
}
/** Compute new roster inside an atomic Firestore transaction. Throws if any slot is full.
 * Existing seats retain their initial registeredAt even if user revises other slots.
 */
export function applyStaffRegistration(input:{weekStart:string;seats:ShiftSeats;uid:string;name:string;slotIds:string[];now:string}){
 const {weekStart,uid,name,now}=input;
 const selection=uniqueSelections(input.slotIds,weekStart);
 const selected=new Set(selection);
 const slots=shiftSlots(weekStart);
 const previous=slots.filter(s=>(input.seats[s.key]||[]).some(m=>m.uid===uid)).map(s=>s.key);
 const next:ShiftSeats={};
 for(const s of slots){
  const original=(input.seats[s.key]||[]);
  const others=original.filter(member=>member.uid!==uid);
  if(selected.has(s.key)&&others.length>=SHIFT_MAX_STAFF)throw Error(`Ca ${s.date} ${s.label} đã đủ 2 nhân viên. Tải lại danh sách ca.`);
  next[s.key]=selected.has(s.key)?[...others,original.find(member=>member.uid===uid)||{uid,name,registeredAt:now}]:others;
 }
 return {seats:next,previous,selected:selection};
}
