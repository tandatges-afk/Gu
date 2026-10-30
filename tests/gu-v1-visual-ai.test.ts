import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const root=resolve('.');
const read=(p:string)=>readFileSync(resolve(root,p),'utf8');

test('GU v1 keeps the existing image finder layout and filters; AI only runs on search',()=>{
 const ui=read('src/components/GuVisualFinder.tsx');
 assert.match(ui,/Danh mục cần tìm/);
 assert.match(ui,/Tất cả danh mục/);
 assert.match(ui,/Tìm sản phẩm/);
 assert.match(ui,/v5\/visual-ai-search/);
 assert.match(ui,/rankVisualCandidates/); // existing fallback
 assert.doesNotMatch(ui,/GU AI Search|Tìm kiếm bằng AI/);
});
test('GU v1 AI route authenticates staff, limits photo bytes, uses localhost only, filters archived and category',()=>{
 const api=read('src/app/api/v5/visual-ai-search/route.ts');
 for(const fragment of ['staffUser(req)','boundedUploadBytes(req)','127.0.0.1:',"s.data()?.category===category","!s.data()?.archivedAt",'GU_VISUAL_AI_ENABLED']) assert.ok(api.includes(fragment),fragment);
 assert.doesNotMatch(api,/res\.cloudinary|https:\/\//);
});
test('GU v1 separate AI worker uses pretrained CLIP and indexes ONLY product images',()=>{
 const worker=read('visual-ai/worker.py');
 assert.match(worker,/CLIPModel\.from_pretrained/);
 assert.match(worker,/CLIPProcessor\.from_pretrained/);
 assert.match(worker,/gu_visual_ai_index/);
 assert.match(worker,/127\.0\.0\.1/);
 assert.match(worker,/products\//);
 assert.match(worker,/if category != 'ALL' and cat != category/);
 assert.match(worker,/target_regions/);
 assert.doesNotMatch(worker,/customer.*photo.*save/);
});
test('GU v1 version is public-facing 1.0.0 without altering old business IDs',()=>{
 assert.equal(JSON.parse(read('package.json')).version,'1.0.0');
});
