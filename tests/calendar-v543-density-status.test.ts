import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {calendarDayTone,calendarVisualState} from '../src/lib/calendar-presentation.ts';

const page=readFileSync(new URL('../src/app/page.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/components/GuCalendarTimeline.module.css',import.meta.url),'utf8');

test('Date highlight uses actual Vietnam day keys, never shifted column indices',()=>{
 assert.equal(calendarDayTone('2026-10-21','2026-10-21'),'toneToday');
 assert.equal(calendarDayTone('2026-10-22','2026-10-21'),'toneTomorrow');
 assert.equal(calendarDayTone('2026-10-23','2026-10-21'),'toneAfterTomorrow');
 assert.equal(calendarDayTone('2026-10-24','2026-10-21'),null);
 assert.equal(calendarDayTone('2026-10-22','2026-10-22'),'toneToday');
 assert.equal(calendarDayTone('2026-10-23','2026-10-22'),'toneTomorrow');
 assert.equal(calendarDayTone('2027-01-01','2026-12-31'),'toneTomorrow');
});
test('Urgency overrides order state and availability',()=>{
 const base={late:false,warning:false,orderStatus:'PICKED_UP',blocked:false,isPast:false};
 assert.deepEqual(calendarVisualState({...base,late:true}),{className:'stateOverdue',label:'Trả trễ'});
 assert.deepEqual(calendarVisualState({...base,warning:true}),{className:'stateWarning',label:'Cảnh báo'});
 assert.equal(calendarVisualState(base).label,'Đã lấy');
 assert.equal(calendarVisualState({...base,orderStatus:'RESERVED'}).label,'Đã giữ');
 assert.equal(calendarVisualState({...base,orderStatus:undefined}).label,'Còn trống');
 assert.equal(calendarVisualState({...base,orderStatus:undefined,blocked:true,blockedLabel:'Đang giặt'}).label,'Đang giặt');
 assert.equal(calendarVisualState({...base,orderStatus:undefined,isPast:true}).label,'Đã qua');
});
test('Every product row contains date track; status labels present on each cell',()=>{
 assert.match(page,/calendarDays\.map\(day=>\{const tone=calendarDayTone\(day,today\)/);
 assert.match(page,/calendarUi\.dayTrack/);
 assert.match(page,/calendarUi\.mobileTrack/);
 assert.match(page,/calendarUi\.stateLabel/);
 assert.match(page,/calendarUi\.productCode/);
 assert.match(css,/\.dayTrack\{/);
 assert.match(css,/\.toneTomorrow\{/);
 assert.match(css,/grid-template-columns:284px/);
 assert.match(css,/-webkit-line-clamp:2/);
});
