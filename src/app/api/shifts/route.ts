import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/firebase-admin';
import {staffUser,handleError,ApiError,jsonBody} from '@/lib/http';
import {auditInTransaction} from '@/lib/audit';
import {activeRegistrationPeriod} from '@/lib/shift-registration-window';
import {earlyWindow,upcomingRegistrationWeek,isoWeekMonday,weekDays,shiftSlots,uniqueSelections,rosterStats,applyStaffRegistration,SHIFT_MAX_STAFF,type ShiftWeekRecord,type ShiftSeats} from '@/lib/shift-schedule';
export const runtime='nodejs';
const noStore={'Cache-Control':'no-store'};
function cleanSeats(value:unknown,monday:string):ShiftSeats{
 const old=value&&typeof value==='object'&&!Array.isArray(value)?value as ShiftSeats:{};
 return Object.fromEntries(shiftSlots(monday).map(s=>[s.key,Array.isArray(old[s.key])?old[s.key].filter(p=>p&&typeof p.uid==='string'):[]]));
}
export async function GET(req:NextRequest){
 try{
  const me=await staffUser(req,{allowSchedule:true});const now=new Date();const period=await activeRegistrationPeriod(now);
  const week=new URL(req.url).searchParams.get('week')||period.weekStart;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(week))throw new ApiError(400,'Ngày bắt đầu tuần không hợp lệ.');
  try{if(isoWeekMonday(week)!==week)throw new Error();}catch{throw new ApiError(400,'Tuần phải bắt đầu thứ Hai.');}
  if(me.role!=='admin'&&week!==period.weekStart&&week!==me.shift?.weekStart)throw new ApiError(403,'Chỉ xem được lịch tuần hiện tại hoặc tuần sắp mở.');
  if(me.role!=='admin'&&!me.shift?.canWork&&!period.isOpen)throw new ApiError(403,'Chỉ xem đăng ký trong thời gian mở hoặc trong ca làm việc.');
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
  const now=new Date();const period=await activeRegistrationPeriod(now);
  if(!period.isOpen)throw new ApiError(403,'Chưa mở đăng ký ca, Admin có thể mở sớm 8 giờ cho tuần sau.');
  const input=await jsonBody(req);
  // No user-provided week or employee UID: both are derived and verified server-side.
  const selected=uniqueSelections(input.slotIds,period.weekStart);
  const ref=db().collection('shiftWeeks').doc(period.weekStart);
  await db().runTransaction(async tx=>{
   if(Date.now()>=Date.parse(period.closesAt))throw new ApiError(403,'Đã hết thời gian đăng ký ca.');
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

/** Admin-controlled opening, each action lasts exactly 8 hours, with audit trail. */
export async function POST(req:NextRequest){
 try{
  const me=await staffUser(req);if(me.role!=='admin')throw new ApiError(403,'Chỉ Admin được mở đăng ký ca sớm.');
  const input=await jsonBody(req);if(input.action!=='OPEN_EARLY')throw new ApiError(400,'Thao tác không hợp lệ.');
  const now=new Date(),week=upcomingRegistrationWeek(now),window=earlyWindow(now,week);
  const ref=db().collection('shiftRegistrationWindows').doc(week);
  await db().runTransaction(async tx=>{
   const old=await tx.get(ref);
   if(old.exists&&Date.parse(String(old.data()?.closesAt||''))>now.getTime())throw new ApiError(409,'Đợt đăng ký sớm vẫn còn mở, không thể mở chồng.');
   tx.set(ref,{...window,openedBy:me.uid,updatedAt:now.toISOString()});
   auditInTransaction(tx,me,'SHIFT_OPEN_EARLY','shiftRegistrationWindows',week,'Admin mở đăng ký ca 8 giờ cho tuần '+week,now.toISOString());
  });
  return NextResponse.json({ok:true,window},{headers:noStore});
 }catch(e){return handleError(e,'POST /api/shifts');}
}
