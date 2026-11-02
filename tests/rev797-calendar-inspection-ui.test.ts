import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const load=(file:string)=>readFileSync(file,'utf8');
const datePicker=load('src/components/GuVNDateTimeInput.tsx');
const calendar=load('src/app/page.tsx');
const capture=load('src/components/GuOrderCapture.tsx');
const css=load('src/app/globals.css');

test('calendar year renders full four-digit year as one atomic button, while wheel edits its last two digits',()=>{
 assert.match(datePicker,/className="gu-vn-year-button"/);
 assert.match(datePicker,/>\{draft\.year\}<\/button>/);
 assert.doesNotMatch(datePicker,/gu-vn-year-prefix/);
 assert.match(datePicker,/part==='year'\?n%100:n/);
 assert.match(datePicker,/year=\{draft\.year\}/);
 assert.match(css,/\.gu-vn-date-parts>button\.gu-vn-year-button\{width:51px/);
 assert.match(css,/\.gu-vn-date-parts\{display:flex;align-items:center;justify-content:center;gap:0!important/);
});

test('date navigation maintains previous, next, today and native calendar controls without duplicate date state',()=>{
 assert.match(calendar,/gu-calendar-date-heading/);
 assert.match(calendar,/aria-label="Về ngày hôm nay" onClick=\{\(\)=>setCalendarStart\(today\)\}/);
 assert.match(calendar,/setCalendarStart\(addDays\(calendarStart,-1\)\)/);
 assert.match(calendar,/setCalendarStart\(addDays\(calendarStart,1\)\)/);
 assert.match(calendar,/value=\{calendarStart\} onChange=\{setCalendarStart\}/);
 assert.match(datePicker,/type="date" className="gu-vn-native-date"/);
 assert.match(css,/grid-template-columns:42px minmax\(0,1fr\) 42px/);
 assert.match(css,/@media\(max-width:600px\)\{/);
});

test('inspection states and issue photo use the existing persisted proof fields and keep conditional issue panel',()=>{
 assert.match(capture,/className="gu-capture-condition-actions"/);
 assert.match(capture,/aria-pressed=\{conditions\[line\.itemId\]===c\}/);
 assert.match(capture,/conditions\[line\.itemId\]&&conditions\[line\.itemId\]!=='OK'/);
 assert.match(capture,/gu-capture-issue-evidence/);
 assert.match(capture,/gu-capture-issue-upload/);
 assert.match(capture,/type="file" accept="image\/\*" capture="environment"/);
 assert.match(capture,/issuePhotoUrls:issuePictures\[l\.itemId\]/);
 assert.match(capture,/!notes\[l\.itemId\]\?\.trim\(\)&&!\(issuePictures\[l\.itemId\]/);
 assert.match(capture,/placeholder="Vị trí, hiện trạng hoặc thông tin bổ sung/);
 assert.match(css,/\.gu-capture-issue\.is-missing\{background:#fff9f9/);
 assert.match(css,/\.gu-capture-issue-upload input\[type="file"\]/);
});


test('calendar pending action has a taller shared desktop row and cannot overlap the next product',()=>{
 assert.match(calendar,/gu-calendar-has-pending/);
 assert.match(css,/\.calendar-grid \.calendar-row\.gu-calendar-has-pending>\.calendar-item\{/);
 assert.match(css,/height:auto!important;min-height:120px!important/);
 assert.match(css,/\.calendar-grid \.calendar-item \.gu-calendar-pending-action/);
});

test('walk-in label is limited to today and never hides an overdue pickup alert',()=>{
 assert.match(calendar,/const displayStateLabel=late\?'Trả trễ':pickupLate\?\(isPast\?'Chưa nhận':'Quá giờ nhận'\)/);
 assert.match(calendar,/shown\?\.status==='RESERVED'&&isPast\?'Chưa nhận'/);
 assert.match(calendar,/shown\.bookingKind==='WALK_IN'&&day===today\?'Chờ bàn giao'/);
 assert.match(calendar,/RESERVED:'Đã giữ'/);
});


// Regression for Oct 30/31 bookings viewed after midnight Nov 2 in Vietnam.
// Unresolved past orders are operational alerts TODAY, not new rentals tomorrow.
test('three-day calendar keeps historical booking, live missed pickup, and next-day availability separate',async()=>{
 const {calendarSlotState}=await import('../src/lib/calendar-presentation.ts');
 const day='2026-11-02', now=Date.parse('2026-11-01T19:15:00Z');
 const item={id:'GU-00020',name:'Áo đen',sku:'GU-00020',category:'Áo dài',size:'',color:'',dailyRate:50000,bufferDays:0,replacementValue:300000,status:'AVAILABLE' as const,createdAt:'2026-10-30'};
 const make=(id:string,pickupDate:string,returnDate:string,pickupAt:string,status:'RESERVED'|'PICKED_UP'='RESERVED')=>({
  id,code:id,customerId:id,customerName:id,customerPhone:'0900000000',pickupDate,returnDate,pickupAt,scheduledPickupAt:pickupAt,
  rentalDays:1,lines:[{itemId:item.id,name:'Áo đen',sku:item.sku,size:'',dailyRate:50000,bufferDays:0,replacementValue:300000,lineTotal:50000}],
  total:50000,paid:0,depositDue:0,note:'',status,bookingKind:'WALK_IN' as const,createdAt:pickupAt,updatedAt:pickupAt,createdBy:'staff',history:[]
 });
 const old=make('old','2026-10-30','2026-10-31','2026-10-30T09:04:00Z');
 const oct30=calendarSlotState(item,'2026-10-30',[old],day,new Set(),now);
 const nov1=calendarSlotState(item,'2026-11-01',[old],day,new Set(),now);
 const nov2=calendarSlotState(item,day,[old],day,new Set(),now);
 const nov3=calendarSlotState(item,'2026-11-03',[old],day,new Set(),now);
 assert.equal(oct30.shown?.id,'old');assert.equal(oct30.isPast,true);
 assert.equal(oct30.pickupLate,true,'uncollected past booking must be purple');
 assert.equal(oct30.visual.className,'stateWarning');
 assert.equal(nov1.visual.label,'Đã qua');
 assert.equal(nov2.visual.label,'Quá giờ nhận');assert.equal(nov2.shown?.id,'old');
 assert.equal(nov2.matching.length,1);
 assert.equal(nov3.visual.label,'Còn trống');assert.equal(nov3.shown,undefined);
 const oct31=calendarSlotState(item,'2026-10-31',[old],day,new Set(),now);
 assert.equal(oct31.pickupLate,true);
 assert.equal(oct31.visual.className,'stateWarning');
 const next=make('next','2026-11-02','2026-11-03','2026-11-02T06:00:00Z');
 const todayBooked=calendarSlotState(item,day,[old,next],day,new Set(),now);
 assert.equal(todayBooked.shown?.id,'next');assert.equal(todayBooked.matching.length,2);
 assert.equal(todayBooked.followupRisk,true);
 const tomorrowBooked=calendarSlotState(item,'2026-11-03',[old,next],day,new Set(),now);
 assert.equal(tomorrowBooked.shown?.id,'next');assert.equal(tomorrowBooked.matching.length,1);
 assert.equal(tomorrowBooked.followupRisk,true);
 assert.equal(tomorrowBooked.pickupLate,false,'a reservation not due yet remains amber');
 assert.equal(tomorrowBooked.visual.className,'stateReserved');
 const missed=make('missed','2026-11-02','2026-11-03','2026-11-01T17:47:00Z');
 const missedTomorrow=calendarSlotState(item,'2026-11-03',[missed],day,new Set(),now);
 assert.equal(missedTomorrow.pickupLate,true,'missed pickup stays purple during the actual reservation range');
 assert.equal(missedTomorrow.visual.className,'stateWarning');
 const future=make('future','2026-11-03','2026-11-04','2026-11-03T07:00:00Z');
 const notYetDue=calendarSlotState(item,'2026-11-03',[future],day,new Set(),now);
 assert.equal(notYetDue.pickupLate,false,'future pickup should stay amber until agreed time');
 assert.equal(notYetDue.visual.className,'stateReserved');
});


test('pickup warnings share purple for historical / live / booked future days without reusing the amber reserved tone',()=>{
 assert.match(css,/button\.calendar-cell\.gu-calendar-pickup-late\{background:#f0eafa!important;border:2px solid #9a7bc8!important/);
 assert.match(css,/\.gu-calendar-pickup-late-legend\{[^\n]*background:#f0eafa/);
 assert.match(calendar,/pickupLate\?\(isPast\?'Chưa nhận':'Quá giờ nhận'\)/);
});

test('6092285 audit: calendar APIs and UI use bounded historical alerts and fresh matching scopes',()=>{
 const pageRoute=load('src/app/api/calendar/page/route.ts');
 const detailRoute=load('src/app/api/calendar/route.ts');
 const smart=load('src/lib/smart-calendar.ts');
 assert.match(pageRoute,/\$1 <= \$4 AND \$4 <= \$2/,'old operational alerts only belong to current-week query');
 assert.match(detailRoute,/jsonb_array_elements/,'unresolved old orders must be individually retrievable');
 assert.match(detailRoute,/start<=today&&today<=dates\[6\]/);
 assert.match(smart,/calendarSlotState\(item,today,relevant,today/,'filter must reuse today slot urgency');
 assert.match(calendar,/setCalendarOrderScope\(scope\)/,'stale request cannot present unrelated page order list');
 assert.match(calendar,/calendarOrderScope===currentCalendarScope/);
 assert.match(calendar,/calendarReload,minuteTick/);
 assert.match(calendar,/followupRisk&&day>today&&!window\.confirm/,'future risky booking needs explicit warning');
});

test('6092285 audit: successful physical handover is never reported as failed by a later refresh',()=>{
 assert.match(capture,/committed=true;setSubmitted\(true\)/);
 assert.match(capture,/KHÔNG gửi lần nữa/);
 assert.match(capture,/void onDone\(\)\.catch/);
});
