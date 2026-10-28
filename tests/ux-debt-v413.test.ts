import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('chọn món phải có nhãn rõ và không chỉ đổi sắc độ',()=>{
 const markup=read('src/components/GuRentalForms.tsx');
 const css=read('src/app/globals.css');
 assert.match(markup,/gu-selection-chip/);
 assert.match(css,/rental-product\.rental-selected[\s\S]*?2\.5px solid/);
 assert.match(css,/badge-purple/);
});
