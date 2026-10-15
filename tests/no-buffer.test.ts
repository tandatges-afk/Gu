import test from 'node:test';
import assert from 'node:assert/strict';
import {makeAddedLines} from '../src/lib/booking-rules.ts';
import type {InventoryItem} from '../src/lib/types.ts';

test('đồ từ kho cũ có đệm 1 ngày vẫn tạo dòng thuê mới không đệm',()=>{
 const item:InventoryItem={id:'abcdefghijkl',name:'Áo dài',sku:'GU-ABC',category:'Áo dài',size:'M',color:'Đỏ',dailyRate:300000,bufferDays:1,replacementValue:1000000,status:'AVAILABLE',createdAt:'2026-10-15T00:00:00Z'};
 const lines=makeAddedLines([item],'2026-10-15','2026-10-15');
 assert.equal(lines.length,1);
 assert.equal(lines[0].bufferDays,0);
 assert.equal(lines[0].lineTotal,300000);
});
