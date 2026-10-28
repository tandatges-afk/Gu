import test from 'node:test';
import assert from 'node:assert/strict';
import {validProductImageUrl,imageMagicMatches} from '../src/lib/cloudinary-images.ts';
const cloud='gucloud';const uid='abc123';const image='https://res.cloudinary.com/gucloud/image/upload/v1760463917/gu/products/abc123/550e8400-e29b-41d4-a716-446655440000.jpg';
test('Chỉ chấp nhận URL sản phẩm Cloudinary đúng cloud / đúng nhân viên',()=>{
  assert.equal(validProductImageUrl(image,uid,cloud),true);
  assert.equal(validProductImageUrl(image,'abc456',cloud),false);
  assert.equal(validProductImageUrl(image,uid,'othercloud'),false);
  assert.equal(validProductImageUrl(image+'?x=1',uid,cloud),false);
  assert.equal(validProductImageUrl('https://evil.com/'+image,uid,cloud),false);
});
test('Kiểm tra chữ ký nhị phân định dạng ảnh',()=>{
  assert.equal(imageMagicMatches(new Uint8Array([0xff,0xd8,0xff,1]),'image/jpeg'),true);
  assert.equal(imageMagicMatches(new Uint8Array([0x89,80,78,71,13,10,26,10]),'image/png'),true);
  assert.equal(imageMagicMatches(new Uint8Array([82,73,70,70,0,0,0,0,87,69,66,80]),'image/webp'),true);
  assert.equal(imageMagicMatches(new Uint8Array([1,2,3,4]),'image/png'),false);
});
