import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('route công nợ chỉ cho admin, tính theo dữ liệu server',()=>{
 const code=read('src/app/api/debts/route.ts');
 assert.match(code,/me.role!=='admin'/);
 assert.match(code,/summaryFromDebtIndex\(rows\)/);
 assert.match(code,/legacyMigrationRequired/);
 assert.match(code,/Cache-Control.*no-store/);
});
test('trang công nợ có khách, số điện thoại, từng đơn và thao tác gọi',()=>{
 const code=read('src/components/GuDebts.tsx');
 for(const key of ['customerName','customerPhone','o.code','o.paid','o.outstanding','tel:'])assert.ok(code.includes(key),`missing ${key}`);
});
test('chọn món phải có nhãn rõ và không chỉ đổi sắc độ',()=>{
 const markup=read('src/components/GuRentalForms.tsx');
 const css=read('src/app/globals.css');
 assert.match(markup,/gu-selection-chip/);
 assert.match(css,/rental-product\.rental-selected[\s\S]*?2\.5px solid/);
 assert.match(css,/badge-purple/);
});
test('mục công nợ riêng trong nhóm admin, không tính đơn đặt trước',()=>{
 const page=read('src/app/page.tsx');
 const accounting=read('src/lib/debts.ts');
 assert.match(page,/ids:\[(?:'reviews',)?'debts','reports','staff','audit','system'\]/);
 assert.match(accounting,/order.status==='RESERVED'/);
 assert.match(accounting,/reservationUnpaid/);
});
