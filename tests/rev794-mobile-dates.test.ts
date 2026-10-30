import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isoDayFromVN,formatVNDateKey} from '../src/lib/vn-datetime.ts';

test('DD/MM/YYYY accepts a single-digit day or month and pads on display',()=>{
 assert.equal(isoDayFromVN('1/11/2026'),'2026-11-01');
 assert.equal(isoDayFromVN('1/1/2026'),'2026-01-01');
 assert.equal(formatVNDateKey(isoDayFromVN('1/11/2026')!), '01/11/2026');
 assert.equal(isoDayFromVN('31/11/2026'),null);
 assert.equal(isoDayFromVN('29/2/2028'),'2028-02-29');
 assert.equal(isoDayFromVN('29/2/2027'),null);
 assert.equal(isoDayFromVN('1/a/2026'),null);
});

test('calendar and booking share non-editable separators and native touch date target',()=>{
 const fields=readFileSync('src/components/GuVNDateTimeInput.tsx','utf8');
 assert.match(fields,/gu-vn-date-parts/);
 assert.match(fields,/aria-hidden="true">\/<\/span>/);
 assert.match(fields,/inputMode="numeric"/);
 assert.match(fields,/gu-vn-picker/);
 assert.match(fields,/type="date" className="gu-vn-native-date"/);
 assert.doesNotMatch(fields,/showPicker\(/);
 const css=readFileSync('src/app/globals.css','utf8');
 assert.match(css,/\.gu-vn-picker>\.gu-vn-native-date/);
 assert.match(css,/pointer-events:auto!important/);
});

test('booked return time is derived from pickup and selected package in the same render',()=>{
 const booking=readFileSync('src/components/GuV5Booking.tsx','utf8');
 assert.match(booking,/const returnAt=useMemo\(\(\)=>rentalHours\?addPackageHours\(pickupAt,rentalHours\)/);
 assert.doesNotMatch(booking,/setReturnAt/);
 assert.match(booking,/typed!==pickupAt\.slice\(0,10\)/);
});
