import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {VISUAL_CACHE_MS,VISUAL_FAST_LIMIT,visualCategoryAllowed,visualCategoryQuery,visualCacheKey,normalizedVector,vectorSimilarity,cropBounds,automaticVisualCrops} from '../src/lib/visual-search-v55.ts';
const read=(file:string)=>readFileSync(file,'utf8');
test('visual category selection is required and server-side exact equality prevents catalog-wide reads',()=>{
 assert.throws(()=>visualCategoryQuery(''),/Danh mục/);
 assert.equal(visualCategoryQuery('Chân váy'),'Chân váy');
 assert.ok(visualCategoryAllowed('Chân váy',['Chân váy','Áo']));
 assert.equal(visualCategoryAllowed('Quần',['Chân váy','Áo']),false);
 assert.match(read('src/app/api/v5/visual-catalog/route.ts'),/where\('category','==',category\)/);
 assert.match(read('src/app/api/v5/visual-catalog/route.ts'),/await staffUser\(req\)/);
});
test('normalized CLIP vectors use cosine similarity and distinguish unlike vectors',()=>{
 const up=normalizedVector([3,4]);const other=normalizedVector([4,-3]);
 assert.ok(Math.abs(vectorSimilarity(up,up)-1)<1e-8);
 assert.ok(Math.abs(vectorSimilarity(up,other))<1e-8);
 assert.throws(()=>normalizedVector([0,0]));
});
test('crop presets stay inside image and cache is isolated per uid and category',()=>{
 for(const id of ['full','center','lower','left','right'] as const){const [x,y,w,h]=cropBounds(id);assert.ok(x>=0&&y>=0&&w>0&&h>0&&x+w<=1&&y+h<=1);}
 assert.notEqual(visualCacheKey('a','Chân váy'),visualCacheKey('b','Chân váy'));
 assert.equal(VISUAL_CACHE_MS,300000);assert.equal(VISUAL_FAST_LIMIT,60);
});
test('browser always uses CLIP AI and an automatic shortlist',()=>{
 const finder=read('src/components/GuVisualFinder.tsx');
 const ai=read('src/lib/visual-ai-client.ts');
 assert.match(finder,/visualAiEmbedding\(url\)/);
 assert.match(finder,/readVisualVector\(photoUrl\)/);
 assert.match(finder,/categoryOptions/);
 assert.match(finder,/setChosen\(item\)/);
 assert.match(finder,/basicVisualFingerprint/);
 assert.match(ai,/Xenova|VISUAL_MODEL_ID/);
 assert.match(ai,/indexedDB\.open/);
 assert.doesNotMatch(finder,/fetch\([^)]*api\.openai/);
});
test('visual catalog response never returns phone, rental or deposit information',()=>{
 const code=read('src/app/api/v5/visual-catalog/route.ts');
 assert.match(code,/imagePaths/);
 assert.match(code,/no-store/);
 assert.doesNotMatch(code,/customerPhone|handoverDepositProofId|reservationPaymentProofId/);
});

test('automatic crop selection uses the chosen category without manual controls',()=>{
 assert.deepEqual(automaticVisualCrops('Chân váy'),['lower','full']);
 assert.deepEqual(automaticVisualCrops('Áo'),['center','full']);
 assert.deepEqual(automaticVisualCrops('Phụ kiện'),['full']);
 const finder=read('src/components/GuVisualFinder.tsx');
 assert.doesNotMatch(finder,/2 · Tập trung vào phần ảnh cần tìm|3 · Cách so sánh|Quét kỹ toàn danh mục/);
 assert.match(finder,/automaticVisualCrops\(category\)/);
 assert.doesNotMatch(finder,/useState<\s*'ai'\|'basic'/);
});
