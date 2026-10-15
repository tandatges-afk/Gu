import assert from 'node:assert/strict';
import {test} from 'node:test';
import {MAX_IMAGES,MAX_PHONE_SOURCE_BYTES,MAX_UPLOAD_BYTES,validateImageSelection,validateImageSource} from '../src/lib/mobile-images.ts';

test('GU Mobile allows up to five photos per product and rejects overflow',()=>{
  assert.equal(MAX_IMAGES,5);
  assert.equal(validateImageSelection(3,2),null);
  assert.match(validateImageSelection(4,2) || '',/tối đa 5/);
  assert.ok(validateImageSelection(0,0));
});
test('Phone photo source guard accepts supported formats but accepts HEIC for attempted conversion and rejects empty files',()=>{
  assert.equal(validateImageSource('image/jpeg',1024),null);
  assert.equal(validateImageSource('image/png',1024),null);
  assert.equal(validateImageSource('image/webp',1024),null);
  assert.equal(validateImageSource('image/heic',1024),null);
  assert.ok(validateImageSource('application/pdf',1024));
  assert.ok(validateImageSource('image/jpeg',0));
  assert.ok(validateImageSource('image/jpeg',MAX_PHONE_SOURCE_BYTES+1));
  assert.equal(MAX_UPLOAD_BYTES,3*1024*1024);
});
