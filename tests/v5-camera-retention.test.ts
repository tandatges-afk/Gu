import {test} from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {cameraPrice,rentalCharge,normalizedSerial,isCameraCategory,cameraQuoteForLine,cameraPackageSnapshot} from '../src/lib/camera-rental.ts';
import {addCompletedRound,inspectionPublicId,KEEP_INSPECTION_ROUNDS} from '../src/lib/evidence-retention-rules.ts';
const read=(path:string)=>readFileSync(path,'utf8');
test('Canon R50 and M50 price brackets round up but not earlier',()=>{
 assert.deepEqual([3,6,24,48].map(h=>cameraPrice('Canon EOS R50',h)),[110000,130000,190000,350000]);
 assert.deepEqual([3,6,24,48].map(h=>cameraPrice('Canon M50',h)),[90000,110000,180000,340000]);
 assert.equal(cameraPrice('Canon EOS R50',3.01),130000);
 assert.equal(cameraPrice('Canon M50',6.01),180000);
 assert.equal(cameraPrice('Canon EOS R50',48.001),360000);
});
test('camera is never silently billed at the clothing tariff',()=>{
 assert.equal(isCameraCategory('Máy ảnh'),true);
 assert.equal(rentalCharge({category:'Máy ảnh',cameraModel:'Canon EOS R50'},'2026-10-18T08:00:00Z','2026-10-18T11:00:00Z'),110000);
 assert.throws(()=>rentalCharge({category:'Máy ảnh'},'2026-10-18T08:00:00Z','2026-10-18T11:00:00Z'),/chưa xác định mẫu/);
 assert.equal(normalizedSerial(' 001ab-c2 '),'001AB-C2');
});
test('7 completed paired handover+return cycles are retained PER physical item',()=>{
 const rounds=Array.from({length:7},(_,i)=>({orderId:`order000000${i}`,completedAt:`2026-10-${String(i+1).padStart(2,'0')}T00:00:00Z`}));
 const newRound={orderId:'order0000008',completedAt:'2026-10-08T00:00:00Z'};
 const {keep,expired}=addCompletedRound(rounds,newRound);
 assert.equal(KEEP_INSPECTION_ROUNDS,7);assert.equal(keep.length,7);
 assert.equal(expired.length,1);assert.equal(expired[0].orderId,rounds[0].orderId);
 assert.equal(keep[6].orderId,newRound.orderId);
 assert.equal(addCompletedRound(keep,newRound).expired.length,0);
});
test('Cloudinary deletion only accepts proof image URLs of the targeted order',()=>{
 const target='somerental1234';
 const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 assert.equal(inspectionPublicId(`https://res.cloudinary.com/gu/image/upload/v123/gu/inspections/staff123/${target}/handover/${id}.jpg`,target,'gu'),`gu/inspections/staff123/${target}/handover/${id}`);
 assert.throws(()=>inspectionPublicId(`https://res.cloudinary.com/gu/image/upload/gu/products/staff/xxx.jpg`,target,'gu'));
 assert.throws(()=>inspectionPublicId(`https://res.cloudinary.com/gu/image/upload/gu/inspections/staff123/otherorder333/return/${id}.jpg`,target,'gu'));
});
test('create one individual inventory document per camera serial; admin approval schedules cleanup',()=>{
 const create=read('src/app/api/items/route.ts'),approve=read('src/app/api/v5/orders/[id]/route.ts');
 assert.match(create,/cameraSerialIndex/);assert.match(create,/tx\.create\(serialRef/);
 assert.match(approve,/addCompletedRound/);assert.match(approve,/inspectionCleanup/);
 assert.match(read('src/app/api/v5/evidence-cleanup/route.ts'),/CRON_SECRET/);
});
