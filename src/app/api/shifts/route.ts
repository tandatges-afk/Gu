import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/firebase-admin';
import {staffUser,handleError,ApiError,jsonBody} from '@/lib/http';
import {auditInTransaction} from '@/lib/audit';
import {registrationPeriod,isoWeekMonday,weekDays,shiftSlots,uniqueSelections,rosterStats,applyStaffRegistration,SHIFT_MAX_STAFF,type ShiftWeekRecord,type ShiftSeats} from '@/lib/shift-schedule';
export const runtime='nodejs';
const noStore={'Cache-Control':'no-store'};
function cleanSeats(value:unknown,monday:string):ShiftSeats{
 const old=value&&typeof value==='object'&&!Array.isArray(value)?value as ShiftSeats:{};
 return Object.fromEntries(shiftSlots(monday).map(s=>[s.key,Array.isArray(old[s.key])?old[s.key].filter(p=>p&&typeof p.uid==='string'):[]]));
}
export async function GET(req:NextRequest){
 try{
  const me=await staffUser(req,{allowSchedule:true});const now=new Date();const period=registrationPeriod(now);
  const week=new URL(req.url).searchParams.get('week')||period.weekStart;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(week))throw new ApiError(400,'Ngày bắt đầu tuần không hợp lệ.');
  try{if(isoWeekMonday(week)!==week)throw new Error();}catch{throw new ApiError(400,'Tuần phải bắt đầu thứ Hai.');}
  if(me.role!=='admin'&&week!==period.weekStart&&week!==me.shift?.weekStart)throw new ApiError(403,'Chỉ xem được lịch tuần hiện tại hoặc tuần sắp mở.');
  if(me.role!=='admin'&&!me.shift?.canWork&&!period.isOpen)throw new ApiError(403,'Chỉ xem đăng ký vào Chủ nhật 12:00–20:00 hoặc trong ca làm việc.');
  const snap=await db().collection('shiftWeeks').doc(week).get();const seats=cleanSeats(snap.data()?.seats,week);
  const registered=rosterStats(seats,week);
  const staffStats=me.role==='admin'?await db().collection('staff').where('role','in',['staff','staff_mobile']).limit(300).get():null;
  const allStats=staffStats?staffStats.docs.filter(d=>d.data().disabled!==true).map(d=>registered.find(p=>p.uid===d.id)||{uid:d.id,name:String(d.data().name||'Nhân viên'),days:0,shifts:0,compliant:false}).sort((a,b)=>a.name.localeCompare(b.name,'vi')):undefined;
  return NextResponse.json({weekStart:week,weekEnd:weekDays(week)[6],period,slots:shiftSlots(week).map(s=>({...s,members:seats[s.key],remaining:Math.max(0,SHIFT_MAX_STAFF-seats[s.key].length)})),selected:shiftSlots(week).filter(s=>seats[s.key].some(m=>m.uid===me.uid)).map(s=>s.key),stats:allStats,canEdit:me.role==='staff'&&period.isOpen&&week===period.weekStart},{headers:noStore});
 }catch(e){return handleError(e,'GET /api/shifts');}
}
export async function PUT(req:NextRequest){
 try{
  const me=await staffUser(req,{allowSchedule:true});if(me.role!=='staff')throw new ApiError(403,'Chỉ nhân viên đăng ký ca.');
  const now=new Date();const period=registrationPeriod(now);
  if(!period.isOpen)throw new ApiError(403,'Chỉ đăng ký ca từ 12:00 đến trước 20:00 Chủ nhật (giờ Việt Nam).');
  const input=await jsonBody(req);
  // No user-provided week or employee UID: both are derived and verified server-side.
  const selected=uniqueSelections(input.slotIds,period.weekStart);
  const ref=db().collection('shiftWeeks').doc(period.weekStart);
  await db().runTransaction(async tx=>{
   if(!registrationPeriod(new Date()).isOpen)throw new ApiError(403,'Đã hết giờ đăng ký, vui lòng thử tuần sau.');
   const snap=await tx.get(ref);
   const seats=cleanSeats(snap.data()?.seats,period.weekStart);
   let plan:ReturnType<typeof applyStaffRegistration>;
   try{plan=applyStaffRegistration({weekStart:period.weekStart,seats,uid:me.uid,name:me.name,slotIds:selected,now:now.toISOString()});}
   catch(e){throw new ApiError(409,e instanceof Error?e.message:'Ca đã đầy, vui lòng chọn ca khác.');}
   const previous=plan.previous;
   const confirmedAt=new Date().toISOString();
   tx.set(ref,{weekStart:period.weekStart,seats:plan.seats,updatedAt:confirmedAt}, {merge:true});
   auditInTransaction(tx,me,'SHIFT_WEEK_REGISTER','shiftWeeks',period.weekStart,`Đăng ký ${selected.length} ca trên ${new Set(selected.map(id=>id.slice(0,10))).size} ngày; trước đó ${previous.length} ca`,confirmedAt);
  });
  return NextResponse.json({ok:true,weekStart:period.weekStart,selected},{headers:noStore});
 }catch(e){
  if(e&&typeof e==='object'&&'code' in e&&['aborted','deadline-exceeded','resource-exhausted'].includes(String(e.code).toLowerCase()))
   return NextResponse.json({error:'Hệ thống đang nhận nhiều đăng ký cùng lúc. Vui lòng tải lại số chỗ và đăng ký lại.'},{status:409,headers:noStore});
  return handleError(e,'PUT /api/shifts');
 }
}
