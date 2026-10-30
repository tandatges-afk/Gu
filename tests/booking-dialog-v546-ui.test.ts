import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(file:string)=>readFileSync(file,'utf8');
test('Booking desktop/mobile use one scoped layout and one clear modal title',()=>{
 const page=read('src/app/page.tsx');
 const form=read('src/components/GuV5Booking.tsx');
 const css=read('src/components/GuV5Booking.module.css');
 assert.match(page,/bookingStyle\.bookingDialog/);
 assert.match(page,/bookingMode==='RESERVE'\?'Đặt lịch trước':'Tạo đơn thuê'/);
 assert.match(form,/ui\.bookingForm/);
 assert.doesNotMatch(form,/rentalTabs\.groupLabel/);
 for (const section of ['Khách hàng','Thời gian thuê','Sản phẩm thuê']) assert.ok(form.includes(section));
 for (const layout of ['customerGrid','dateGrid','productList','summary','actions']) assert.ok(css.includes(`.${layout}`));
 assert.match(css,/@media\(max-width:680px\)/);
 assert.match(css,/grid-template-columns:minmax\(0,1fr\)/);
});
test('Booking UI refactor preserves submit validation, phone lookup, secure photo and camera tier',()=>{
 const form=read('src/components/GuV5Booking.tsx');
 assert.match(form,/onSubmit=\{e=>void submit\(e\)\}/);
 assert.match(form,/phoneIndex|quickCustomer:\{name:name\.trim\(\),phone:digits\(phone\)\}/);
 assert.match(form,/gu-customer-search-anchor/);
 assert.match(form,/setShowPhoneSuggestions\(false\)/);
 assert.match(form,/returnAt=useMemo\(\(\)=>rentalHours\?addPackageHours\(pickupAt,rentalHours\)/);
 assert.match(form,/GuSecureUpload purpose="reservation"/);
 assert.match(form,/aria-pressed=\{selected\.includes\(i\.id\)\}/);
 assert.match(form,/GuVNDateTimeInput required value=\{pickupAt\}/);
 assert.match(form,/Giờ trả tự tính theo thời lượng thuê/);
});
test('24h date picker uses accessible calendar icon instead of glyph',()=>{
 const date=read('src/components/GuVNDateTimeInput.tsx');
 assert.match(date,/import \{CalendarDays\} from 'lucide-react'/);
 assert.match(date,/<CalendarDays size=\{17\}/);
 assert.doesNotMatch(date,/▦/);
 assert.match(date,/isoDayFromVN/);
 assert.match(date,/isValidHHMM/);
});
