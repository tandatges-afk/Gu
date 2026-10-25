import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(p:string)=>readFileSync(p,'utf8');
test('Calendar controls are in a dedicated horizontal-scroll row for staff and admin',()=>{
 const page=read('src/app/page.tsx');const css=read('src/app/globals.css');
 assert.match(page,/gu-calendar-controls-viewport/);
 assert.match(page,/gu-calendar-controls-admin/);
 assert.match(page,/gu-calendar-controls-staff/);
 assert.match(css,/\.calendar-panel \.calendar-controls\{[\s\S]*?grid-auto-flow:column/);
 assert.match(css,/\.calendar-panel \.gu-calendar-controls-viewport\{[\s\S]*?overflow-x:auto/);
 assert.match(css,/\.calendar-panel \.calendar-controls \.gu-calendar-cat,/);
});
test('Redundant calendar help and hover hints removed but accessible labels remain',()=>{
 const page=read('src/app/page.tsx');
 assert.doesNotMatch(page,/Ô tìm kiếm này dùng chung cho lịch thuê/);
 assert.doesNotMatch(page,/title="Lùi 1 ngày"|title="Tiến 1 ngày"/);
 assert.match(page,/aria-label="Lùi 1 ngày"/);
 assert.match(page,/aria-label="Tiến 1 ngày"/);
 assert.match(page,/aria-label="Tải lại dữ liệu"/);
});
