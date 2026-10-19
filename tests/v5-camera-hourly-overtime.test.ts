import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {cameraQuoteForLine,cameraPackageSnapshot,rentalCharge,cameraPrice, type CameraModel} from '../src/lib/camera-rental.ts';
import {approvedLineQuote} from '../src/lib/v5-review-pricing.ts';
const start='2026-10-18T02:00:00.000Z';
const after=(minutes:number)=>new Date(Date.parse(start)+minutes*60_000).toISOString();
const lines=(model:CameraModel,packageHours:3|6|24|48)=>{
 const snap=cameraPackageSnapshot(model,start,after(packageHours*60));
 return {category:'Máy ảnh',cameraModel:model,...snap,lineTotal:snap.cameraPackageBasePrice};
};
for(const [model,prices] of [
 ['Canon EOS R50',[110000,130000,190000,350000]],
 ['Canon M50',[90000,110000,180000,340000]]
] as const){
 for(let i=0;i<4;i++){
  const hours=([3,6,24,48] as const)[i],base=prices[i];
  test(`${model}: ${hours}h package, exact boundary and each started extra hour`,()=>{
   const line=lines(model,hours);
   assert.equal(cameraPrice(model,hours),base);
   assert.equal(cameraQuoteForLine(line,start,after(hours*60)).amount,base);
   assert.deepEqual(cameraQuoteForLine(line,start,after(hours*60+1)),{amount:base+10000,packageHours:hours,basePrice:base,lateHours:1,lateFee:10000});
   assert.equal(cameraQuoteForLine(line,start,after(hours*60+60)).amount,base+10000);
   assert.equal(cameraQuoteForLine(line,start,after(hours*60+61)).amount,base+20000);
   assert.equal(approvedLineQuote(line,start,after(hours*60+61)).pendingCameraLatePricing,false);
   assert.equal(rentalCharge(line,start,after(hours*60+61)),base+20000);
  });
 }
}
test('R50 3h rental 181 minutes 120k; 241 minutes 130k even though a 6h package exists',()=>{
 const line=lines('Canon EOS R50',3);
 assert.equal(cameraQuoteForLine(line,start,after(180)).amount,110000);
 assert.equal(cameraQuoteForLine(line,start,after(181)).amount,120000);
 assert.equal(cameraQuoteForLine(line,start,after(240)).amount,120000);
 assert.equal(cameraQuoteForLine(line,start,after(241)).amount,130000);
 assert.equal(cameraQuoteForLine(line,start,after(360)).amount,140000); // do not re-tier
});
test('1 day 24:01 and 2 days 48:01 add exactly 10k (both cameras)',()=>{
 assert.equal(cameraQuoteForLine(lines('Canon EOS R50',24),start,after(1441)).amount,200000);
 assert.equal(cameraQuoteForLine(lines('Canon M50',24),start,after(1441)).amount,190000);
 assert.equal(cameraQuoteForLine(lines('Canon EOS R50',48),start,after(2881)).amount,360000);
 assert.equal(cameraQuoteForLine(lines('Canon M50',48),start,after(2881)).amount,350000);
});
test('Snapshot preserves contract base and period, even if app tariffs later change',()=>{
 const quote=cameraQuoteForLine({...lines('Canon EOS R50',3),cameraPackageBasePrice:105000},start,after(181));
 assert.equal(quote.amount,115000);
});
test('Existing beta-3 3h orders without snapshots recover agreed package from lineTotal',()=>{
 const old={category:'Máy ảnh',cameraModel:'Canon EOS R50' as const,lineTotal:110000};
 assert.equal(cameraQuoteForLine(old,start,after(181)).amount,120000);
 assert.equal(cameraQuoteForLine(old,start,after(241)).amount,130000);
});
test('No camera line can silently use clothing late fees; invalid times rejected',()=>{
 assert.throws(()=>cameraQuoteForLine(lines('Canon M50',3),start,start),/sau lúc giao/);
 assert.throws(()=>cameraQuoteForLine({category:'Máy ảnh'},start,after(181)),/chưa xác định mẫu/);
});
test('Server stores camera package at create and add-items, and quotes it upon Admin approval',()=>{
 const create=readFileSync('src/app/api/v5/orders/route.ts','utf8');
 const edit=readFileSync('src/app/api/v5/orders/[id]/route.ts','utf8');
 const review=readFileSync('src/components/GuV5Review.tsx','utf8');
 for(const text of [create,edit])assert.match(text,/cameraPackageSnapshot/);
 assert.match(edit,/approvedLineQuote/);
 assert.match(edit,/cameraOvertimeFeeTotal/);
 assert.match(edit,/lateFeeTotal:0/); // avoid double counting fees in the debt ledger
 assert.match(edit,/AUTO_RESOLVE_CAMERA_LATE/);
 assert.match(review,/cameraOvertimeFeeTotal|Máy ảnh chưa đối soát phí trễ/);
});
