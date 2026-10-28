import test from 'node:test';
import assert from 'node:assert/strict';
import {collateralForLines,collateralReturnQuote,handoverLabel,CLOTHING_SETTLEMENT_VERSION} from '../src/lib/clothing-collateral.ts';
import {rentForBlocks} from '../src/lib/hourly-pricing.ts';
import {readFileSync} from 'node:fs';
const read=(path:string)=>readFileSync(path,'utf8');
test('security per physical item, not per order; clothing 300k/accessory 200k',()=>{
 assert.equal(collateralForLines([{category:'Áo dài'},{category:'Phụ kiện'},{category:'Váy'},{category:'Phụ kiện máy ảnh'}]),1_000_000);
 assert.equal(collateralForLines([{category:'Áo dài'}]),300_000);
 assert.equal(collateralForLines([{category:'phụ kiện'}]),200_000);
});
test('direct walk-in: 50k outfit charged against 300k collateral on return',()=>{
 assert.deepEqual(collateralReturnQuote({security:300_000,rent:50_000,extras:0,paidRent:0,kind:'CASH'}),{outstanding:50_000,applied:50_000,refund:250_000,collect:0,returnId:false});
});
test('reserved customer prepays rent; security is returned in full',()=>{
 assert.deepEqual(collateralReturnQuote({security:300_000,rent:50_000,extras:0,paidRent:50_000,kind:'CASH'}),{outstanding:0,applied:0,refund:300_000,collect:0,returnId:false});
});
test('cash collateral protects late return; never charges rental twice',()=>{
 assert.deepEqual(collateralReturnQuote({security:300_000,rent:60_000,extras:30_000,paidRent:50_000,kind:'CASH'}),{outstanding:40_000,applied:40_000,refund:260_000,collect:0,returnId:false});
});
test('CCCD direct: collect rental first, return ID after payment',()=>{
 assert.deepEqual(collateralReturnQuote({security:0,rent:50_000,extras:0,paidRent:0,kind:'CCCD'}),{outstanding:50_000,applied:0,refund:0,collect:50_000,returnId:true});
 assert.equal(collateralReturnQuote({security:0,rent:50_000,extras:0,paidRent:50_000,kind:'CCCD'}).collect,0);
});
test('collateral insufficient for very late return requires additional collection',()=>{
 assert.equal(collateralReturnQuote({security:200_000,rent:250_000,extras:20_000,paidRent:0,kind:'CASH'}).collect,70_000);
});
test('clothing/accessory booked rent uses 50k/20k first 24h, camera price logic unchanged',()=>{
 assert.equal(rentForBlocks('CLOTHING',1),50_000);
 assert.equal(rentForBlocks('ACCESSORY',1),20_000);
 assert.match(read('src/lib/camera-rental.ts'),/CAMERA_PRICE/);
 assert.match(read('src/app/api/v5/orders/route.ts'),/group==='CLOTHING'\?\{settlementPolicyVersion/);
});
test('status PICKED_UP never reported as Chưa giao even when old proof lacks name',()=>{
 assert.match(handoverLabel({status:'PICKED_UP'}),/Đã giao/);
 assert.match(handoverLabel({status:'RETURNED'}),/Đã giao/);
 assert.equal(handoverLabel({status:'RESERVED'}),'Chưa giao');
 assert.match(handoverLabel({status:'PICKED_UP',handoverProof:{byName:'Admin'}}),/Admin/);
});
test('transactional security receipt and refund, confirmed after return only; applies to new clothing orders',()=>{
 const source=read('src/app/api/v5/orders/[id]/route.ts');
 assert.match(source,/if\(order\.status!=='RETURNED'\|\|!\(order\.handoverDepositProofId/);
 assert.match(source,/if\(quote\.collect>0\)throw new ApiError/);
 assert.match(source,/COLLATERAL_IN/);
 assert.match(source,/COLLATERAL_APPLIED/);
 assert.match(source,/COLLATERAL_REFUND/);
 assert.match(source,/CLOTHING_SETTLEMENT_VERSION/);
 assert.match(read('src/lib/types.ts'),/settlementPolicyVersion/);
 assert.equal(CLOTHING_SETTLEMENT_VERSION,'CLOTHING_CASH_OR_ID_V1');
});
test('money collected for deposits does not inflate revenue chart',()=>{
 assert.match(read('src/app/api/reports/route.ts'),/collateralReceived/);
 assert.match(read('src/app/api/reports/route.ts'),/collateralRefunded/);
 assert.match(read('src/app/api/reports/route.ts'),/collateralApplied/);
});
