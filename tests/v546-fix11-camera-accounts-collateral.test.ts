import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {cameraCollateralForLines,cameraCollateralQuote,CAMERA_CASH_COLLATERAL_PER_ITEM,CAMERA_SETTLEMENT_VERSION} from '../src/lib/camera-collateral.ts';
import {cameraQuoteForLine} from '../src/lib/camera-rental.ts';
import type {RentalOrder} from '../src/lib/types.ts';
const read=(s:string)=>readFileSync(s,'utf8');
const one=[{category:'Máy ảnh'}];
function makeOrder(overrides:Partial<RentalOrder>={}):RentalOrder{return {
 id:'a'.repeat(24),code:'TH-261028-0C603',customerId:'c'.repeat(24),customerName:'Đạt',customerPhone:'0876555506',
 pickupDate:'2026-10-28',returnDate:'2026-10-28',rentalDays:1,
 lines:[{itemId:'b'.repeat(24),name:'Canon EOS R50 1',sku:'GU-00001',size:'',dailyRate:0,bufferDays:0,replacementValue:0,lineTotal:110000,category:'Máy ảnh',cameraModel:'Canon EOS R50',cameraPackageHours:3,cameraPackageBasePrice:110000}],
 total:110000,paid:0,depositDue:0,bookingKind:'WALK_IN',rentalGroup:'CAMERA',settlementPolicyVersion:CAMERA_SETTLEMENT_VERSION,status:'PICKED_UP',note:'',createdAt:'2026-10-28T01:00:00Z',updatedAt:'2026-10-28T01:00:00Z',createdBy:'staff',history:[],...overrides};}

test('R50 3h has fixed base 110k; 120k only after one started overtime hour',()=>{
 const line=makeOrder().lines[0];
 assert.deepEqual(cameraQuoteForLine(line,'2026-10-28T01:00:00Z','2026-10-28T04:00:00Z'),{amount:110000,packageHours:3,basePrice:110000,lateHours:0,lateFee:0});
 assert.equal(cameraQuoteForLine(line,'2026-10-28T01:00:00Z','2026-10-28T04:00:01Z').amount,110000); // Seconds must not create a fake 10k fee.
 assert.deepEqual(cameraQuoteForLine(line,'2026-10-28T01:00:00Z','2026-10-28T04:01:00Z'),{amount:120000,packageHours:3,basePrice:110000,lateHours:1,lateFee:10000});
});
test('18m collateral per camera is not rent',()=>{
 assert.equal(CAMERA_CASH_COLLATERAL_PER_ITEM,18000000);
 assert.equal(cameraCollateralForLines(one),18000000);
 assert.equal(cameraCollateralForLines([...one,...one]),36000000);
});
test('walk-in camera: 18m deposit minus 110k rent when returning on time',()=>{
 assert.deepEqual(cameraCollateralQuote({security:18000000,rent:110000,extras:0,paidRent:0,kind:'CASH'}),{outstanding:110000,applied:110000,refund:17890000,collect:0,returnId:false});
});
test('pre-booked camera: full 18m returned if rent was prepaid; 10k overtime deducted only once',()=>{
 assert.deepEqual(cameraCollateralQuote({security:18000000,rent:120000,extras:0,paidRent:110000,kind:'CASH'}),{outstanding:10000,applied:10000,refund:17990000,collect:0,returnId:false});
});
test('CCCD does not offset rent or fees automatically',()=>{
 assert.deepEqual(cameraCollateralQuote({security:0,rent:120000,extras:0,paidRent:0,kind:'CCCD'}),{outstanding:120000,applied:0,refund:0,collect:120000,returnId:true});
});
test('camera physically returned is never automatically moved into laundry, even for old camera configuration',()=>{
 const route=read('src/app/api/v5/orders/[id]/route.ts');
 assert.match(route,/isCameraCategory\(item\.category\)\|\|item\.requiresLaundry===false/);
 assert.match(route,/\bcurrentOrderId:id\b/);
});
test('new camera deposit requires 18m or CCCD with server side confirmation and accurate refund audit',()=>{
 const route=read('src/app/api/v5/orders/[id]/route.ts');
 assert.match(route,/cameraCollateralForLines\(order\.lines\)/);
 assert.match(route,/kind:'COLLATERAL_APPLIED'/);
 assert.match(route,/kind:'COLLATERAL_REFUND'/);
 assert.match(route,/currentCameraPolicy\?cameraCollateralQuote:collateralReturnQuote/);
 assert.match(route,/cameraPolicy&&order\.status!=='RETURNED'/);
});
