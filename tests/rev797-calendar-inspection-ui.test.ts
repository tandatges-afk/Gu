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
 assert.match(capture,/issuePhotoUrl:pictures\[l\.itemId\+'\|issue'\]/);
 assert.match(capture,/!notes\[l\.itemId\]\?\.trim\(\)&&!pictures\[l\.itemId\+'\|issue'\]/);
 assert.match(capture,/placeholder="Vị trí, hiện trạng hoặc thông tin bổ sung/);
 assert.match(css,/\.gu-capture-issue\.is-missing\{background:#fff9f9/);
 assert.match(css,/\.gu-capture-issue-upload input\[type="file"\]/);
});
