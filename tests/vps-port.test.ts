import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validProductImageUrl,imageMagicMatches,thumbCloudinaryUrl} from '../src/lib/cloudinary-images.ts';
const read=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8');
const uid='aabbccddeeff00112233445566778899';
const valid=`/api/local-media/products/${uid}/8b56c125-bf25-4b0d-a9ab-5512736b1eee.jpg`;
test('only permit local product images for the uploader',()=>{
 assert.equal(validProductImageUrl(valid,uid,''),true);
 assert.equal(validProductImageUrl(valid,'aabbccddeeff00112233445566778898',''),false);
 assert.equal(validProductImageUrl(valid+'?redirect=evil',uid,''),false);
 assert.equal(validProductImageUrl('/api/local-media/products/'+uid+'/../../etc/passwd',uid,''),false);
 assert.equal(validProductImageUrl('https://res.cloudinary.com/gu/image/upload/photo.jpg',uid,''),false);
 assert.equal(thumbCloudinaryUrl(valid,400),valid);
});
test('photo content is checked against actual magic bytes',()=>{
 assert.equal(imageMagicMatches(new Uint8Array([255,216,255,0]),'image/jpeg'),true);
 assert.equal(imageMagicMatches(new Uint8Array([1,2,3,4]),'image/jpeg'),false);
});
test('V5 UI is preserved, client auth is local not Firebase',()=>{
 const ui=read('../src/app/page.tsx');
 assert.match(ui,/GuV5Booking/);assert.match(ui,/GuReturnFlow/);assert.doesNotMatch(ui,/GuDebts/);
 assert.match(ui,/from '@\/lib\/client-auth'/);
 assert.doesNotMatch(ui,/from 'firebase\/auth'/);
});
test('PostgreSQL transaction serialization and conditional unique document ids',()=>{
 const s=read('../src/lib/pg-firestore.ts');
 assert.match(s,/pg_advisory_xact_lock/);
 assert.match(s,/PRIMARY KEY\(collection,id\)/);
 assert.match(s,/CREATE TABLE IF NOT EXISTS gu_documents/);
 assert.match(s,/if\(w.kind==='create'&&current.exists\)/);
});
test('private evidence storage uses local files and guards GET by order access',()=>{
 const evidence=read('../src/app/api/v5/secure-photo/route.ts');
 const storage=read('../src/lib/cloudinary-secure.ts');
 assert.match(evidence,/canReadEvidence\(me,order.data\(\)/);
 assert.match(evidence,/no-store/);
 assert.match(storage,/savePhoto\('secure'/);
 assert.doesNotMatch(storage,/api.cloudinary.com/);
});
test('auth cookies HttpOnly and same-site strict, session revocation',()=>{
 const auth=read('../src/app/api/local-auth/route.ts');
 const server=read('../src/lib/local-auth.ts');
 assert.match(auth,/httpOnly:true/);assert.match(auth,/sameSite:'strict'/);
 assert.match(server,/timingSafeEqual/);assert.match(server,/revoked_after/);
});
