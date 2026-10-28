import assert from 'node:assert/strict';
import test from 'node:test';
import {postReturnStockStatus} from '../src/lib/rental.ts';
test('đã trả đủ đồ cần giặt chuyển thẳng Đang giặt, không có Chờ giặt',()=>{
 assert.equal(postReturnStockStatus({requiresLaundry:true},'OK'),'LAUNDRY');
});
test('đồ không yêu cầu giặt quay về sẵn sàng sau kiểm nhận',()=>{
 assert.equal(postReturnStockStatus({requiresLaundry:false},'OK'),'AVAILABLE');
});
test('thiếu sản phẩm luôn ưu tiên trạng thái thất lạc',()=>{
 assert.equal(postReturnStockStatus({requiresLaundry:true},'MISSING'),'MISSING');
});
test('sản phẩm cũ có ngày đệm tiếp tục yêu cầu giặt sau trả',()=>{
 assert.equal(postReturnStockStatus({bufferDays:1},'OK'),'LAUNDRY');
});
