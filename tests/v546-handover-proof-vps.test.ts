import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseInspectionPhotoUrl} from '../src/lib/inspection-photo-url.ts';
const uid='staff_0123456789';
const id='3a4b5c6d-7777-4888-8999-1234567890ab';
const path=`/api/local-media/inspections/${uid}/${id}.jpg`;

test('handover accepts a VPS inspection upload URL from the same site',()=>{
 assert.deepEqual(parseInspectionPhotoUrl(path,'https://guthuedo.io.vn'),{url:path,uid,id});
 assert.deepEqual(parseInspectionPhotoUrl('https://guthuedo.io.vn'+path,'https://guthuedo.io.vn'),{url:path,uid,id});
});
test('handover rejects remote, Cloudinary, non-inspection and modified paths',()=>{
 for(const value of [
  'https://res.cloudinary.com/cloud/image/upload/photo.jpg',
  'https://evil.invalid'+path,
  'https://guthuedo.io.vn'+path+'?another=1',
  `/api/local-media/products/${uid}/${id}.jpg`,
  `${path}/../../admin`,
  path+'?x=1',
  'blob:https://guthuedo.io.vn/aaa',
  '',null,42,
 ])assert.equal(parseInspectionPhotoUrl(value,'https://guthuedo.io.vn'),null,String(value));
});
test('handover route keeps authoritative uploader, order and phase verification',()=>{
 const source=readFileSync(new URL('../src/app/api/v5/orders/[id]/route.ts',import.meta.url),'utf8');
 assert.match(source,/parseInspectionPhotoUrl\(url,process\.env\.APP_URL\)/);
 assert.match(source,/uploaded\.uid!==uid/);
 assert.match(source,/s\.data\(\)\?\.uid!==uid/);
 assert.match(source,/s\.data\(\)\?\.orderId!==orderId/);
 assert.match(source,/s\.data\(\)\?\.phase!==phase/);
 assert.doesNotMatch(source,/res\.cloudinary\.com/);
});
