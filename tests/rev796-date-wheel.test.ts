import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {vnWheelRange,vnWheelBounds,vnWheelDateError,vnWheelISO,vnWheelMove,vnWheelPad} from '../src/lib/vn-wheel.ts';
const read=(path:string)=>readFileSync(path,'utf8');

test('wheel displays four items before/after current, clipped at date/clock boundaries',()=>{
 assert.deepEqual(vnWheelRange(20,1,31),[16,17,18,19,20,21,22,23,24]);
 assert.deepEqual(vnWheelRange(30,1,31),[26,27,28,29,30,31]);
 assert.deepEqual(vnWheelRange(23,0,23),[19,20,21,22,23]);
 assert.deepEqual(vnWheelRange(10,1,12),[6,7,8,9,10,11,12]);
 assert.deepEqual(vnWheelRange(1,1,31),[1,2,3,4,5]);
 assert.equal(vnWheelMove(23,10,vnWheelBounds('hour')),23);
 assert.equal(vnWheelMove(1,-100,vnWheelBounds('day')),1);
 assert.equal(vnWheelPad(3),'03');
});

test('year edits only the last two digits within existing century',()=>{
 assert.deepEqual(vnWheelBounds('year',2026),{min:2000,max:2099});
 assert.deepEqual(vnWheelBounds('year',1998),{min:1900,max:1999});
 assert.deepEqual(vnWheelRange(2026,2000,2099),[2022,2023,2024,2025,2026,2027,2028,2029,2030]);
});

test('invalid dates preserve the day and show a precise message without auto-clamping',()=>{
 assert.match(vnWheelDateError({day:31,month:11,year:2026})||'',/Tháng 11 không có ngày 31/);
 assert.equal(vnWheelISO({day:31,month:11,year:2026}),null);
 assert.match(vnWheelDateError({day:29,month:2,year:2027})||'',/không phải năm nhuận/);
 assert.equal(vnWheelISO({day:29,month:2,year:2027}),null);
 assert.equal(vnWheelISO({day:29,month:2,year:2028}),'2028-02-29');
 assert.equal(vnWheelISO({day:29,month:2,year:2000}),'2000-02-29');
 assert.equal(vnWheelISO({day:29,month:2,year:2100}),null);
 assert.equal(vnWheelISO({day:30,month:10,year:2026}),'2026-10-30');
 assert.equal(vnWheelISO({day:31,month:12,year:2026}),'2026-12-31');
});

test('booking wheel preserves the last selected value and never submits draft-invalid dates',()=>{
 const picker=read('src/components/GuVNDateTimeInput.tsx');
 const booking=read('src/components/GuV5Booking.tsx');
 assert.match(picker,/selected=\{draft\[active\.part/);
 assert.match(picker,/data-vn-valid=\{String\(Boolean\(iso\)\)\}/);
 assert.match(picker,/role="dialog"/);
 assert.match(picker,/onTouchMove=\{onTouchMove\}/);
 assert.match(picker,/onWheel=\{onWheel\}/);
 assert.match(picker,/type="date" className="gu-vn-native-date"/);
 assert.doesNotMatch(picker,/showPicker\(/);
 assert.match(booking,/parts\.dataset\.vnValid!==['"]true['"]/);
 assert.match(booking,/clock\.dataset\.vnValid!==['"]true['"]/);
 assert.match(booking,/setReturnOverride\(''\)/);
 assert.match(booking,/returnAt:scheduledReturnAt/);
 assert.match(booking,/returnIssue/);
 assert.match(booking,/Trả dự kiến \(tự tính theo gói\)/);
});
