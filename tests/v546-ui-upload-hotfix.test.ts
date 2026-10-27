import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(p:string)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('visual finder keeps category, removes index controls and search breadth',()=>{
 const ui=read('src/components/GuVisualFinder.tsx');
 assert.match(ui,/Danh mục cần tìm/);
 assert.match(ui,/relaxed:false,take:6/);
 for(const label of ['Lập chỉ mục ảnh cũ','Làm mới chỉ mục','Độ rộng tìm kiếm','backfill'])assert.ok(!ui.includes(label),label);
});
test('all three upload components call shared binary API helper',()=>{
 for(const p of ['GuExtras','GuOrderCapture','GuSecureUpload']){
  const ui=read(`src/components/${p}.tsx`);
  assert.match(ui,/uploadImageToApi\(/);
  assert.doesNotMatch(ui,/new FormData\(\)/);
 }
 const helper=read('src/lib/upload-client.ts');
 assert.match(helper,/body:image/);
 assert.match(helper,/X-GU-Upload-Purpose/);
 assert.match(helper,/credentials:'same-origin'/);
});
test('upload routes avoid multipart parsing and retain auth and content validation',()=>{
 for(const p of ['src/app/api/uploads/route.ts','src/app/api/v5/secure-photo/route.ts']){
  const api=read(p);
  assert.doesNotMatch(api,/req\.formData\(\)/);
  assert.match(api,/await req\.arrayBuffer\(\)/);
  assert.match(api,/await staffUser\(req\)/);
  assert.match(api,/3\*1024\*1024/);
 }
});
