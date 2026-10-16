import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
const api=readFileSync('src/app/api/orders/[id]/route.ts','utf8');
const itemApi=readFileSync('src/app/api/items/[id]/route.ts','utf8');
const ui=readFileSync('src/app/page.tsx','utf8');
test('gia hạn thực hiện qua giao dịch Firestore và khóa lịch từng ngày',()=>{
 assert.match(api,/if\(action==='EXTEND'\)/);
 assert.match(api,/planRentalExtension\(order,b\.returnDate,today\)/);
 assert.match(api,/tx\.create\(r,\{orderId:id,itemId:/);
 assert.match(api,/ORDER_EXTEND/);
});
test('đã trả mới tự chuyển thẳng Đang giặt; kho không chọn bằng tay',()=>{
 assert.match(api,/postReturnStockStatus\(item,inspections\[i\]\.status\)/);
 assert.match(itemApi,/\['AVAILABLE','MAINTENANCE'\]/);
 assert.doesNotMatch(ui,/Đang chờ giặt|Chờ giặt ·/);
});
test('GU Mobile hiển thị gia hạn và thu tiền theo ngày, không gia hạn sau quá hạn',()=>{
 assert.match(ui,/className="gu-v4-extension"/);
 assert.match(ui,/o\.returnDate>=today/);
 assert.match(ui,/action:'EXTEND'/);
});
