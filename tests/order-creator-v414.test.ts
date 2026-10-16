import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {orderCreatorName} from '../src/lib/order-creator.ts';
const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('nhân viên tạo đơn: tên chụp tại lúc tạo ưu tiên hơn tên đã đổi',()=>{
  assert.equal(orderCreatorName({createdBy:'uid-abc',createdByName:'Nguyễn Thị An'},{'uid-abc':'An cập nhật'}),'Nguyễn Thị An');
});
test('đơn cũ có UID tra ra tên nhân viên, trường hợp không tìm được không đoán tên',()=>{
  assert.equal(orderCreatorName({createdBy:'uid1'},{uid1:'Lê Mỹ Linh'}),'Lê Mỹ Linh');
  assert.equal(orderCreatorName({createdBy:'uid2'},{}),'Chưa rõ nhân viên');
  assert.equal(orderCreatorName({createdBy:'uid2',createdByName:'  '},{uid2:'Phạm Anh'}),'Phạm Anh');
});
test('máy chủ tự chụp tên từ staffUser, không đọc tên do client tự nhập',()=>{
  const route=read('src/app/api/orders/route.ts');
  assert.match(route,/const me=await staffUser\(req\)/);
  assert.match(route,/createdBy:me\.uid,createdByName:me\.name/);
  assert.doesNotMatch(route,/createdByName:b\./);
});
test('đơn cũ được xử lý trong bootstrap và khi admin mở công nợ',()=>{
  assert.match(read('src/app/api/bootstrap/route.ts'),/staffNames:/);
  assert.match(read('src/app/api/orders/[id]/route.ts'),/if\(!order\.createdByName&&order\.createdBy\)/);
});
test('lịch hiện nhân viên trên ô lịch desktop/mobile và có lọc theo nhân viên',()=>{
  const page=read('src/app/page.tsx');
  assert.match(page,/gu-calendar-cell-creator/);
  assert.match(page,/Lọc theo nhân viên tạo đơn/);
  assert.match(page,/Nhân viên tạo đơn/);
  assert.match(page,/orderCreatorName/);
});
test('mã sản phẩm giữ nguyên mã cũ và không còn gợi ý thừa ở phần chọn đồ',()=>{
  for(const file of ['src/app/page.tsx','src/components/GuRentalForms.tsx','src/components/GuReturnFlow.tsx']){
    const src=read(file);
    assert.doesNotMatch(src,/mã móc|Mã móc|gu-smart-hint|className="hint"/);
  }
  const page=read('src/app/page.tsx');
  assert.match(page,/getProductCode/);
  assert.doesNotMatch(read('src/app/globals.css'),/\.gu-smart-hint\b/);
  assert.match(read('src/lib/hanger-code.ts'),/getProductCode=getHangerCode/);
});
