import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {rankVisualCandidates,validVisualSignatureV2,validVisualIndexEntries,visualDistanceV2,type VisualSignatureV2} from '../src/lib/visual-index.ts';
const sig=(hue=0,offset=0):VisualSignatureV2=>{
 const features=Array(58).fill(0) as number[];
 features[hue%12]=1;
 features[12]=1;features[17]=1;
 features[22]=1;features[38]=1;features[46]=1;
 features[54]=.5;features[55]=.5;features[56]=.5;features[57]=.4;
 features[54]+=offset;
 return {version:2,features,hash:'0000000000000000'};
};
test('V2 blocks incompatible, malicious, stale and duplicate descriptors',()=>{
 assert.ok(validVisualSignatureV2(sig()));
 assert.equal(validVisualSignatureV2({...sig(),version:1}),false);
 assert.equal(validVisualSignatureV2({...sig(),features:Array(58).fill(NaN)}),false);
 assert.equal(validVisualIndexEntries([{imagePath:'https://example.test/a.jpg',signature:sig()}]),true);
 assert.equal(validVisualIndexEntries([{imagePath:'a',signature:sig()},{imagePath:'a',signature:sig()}]),false);
});
test('identical image is exact and multi-photo image can rescue a hard viewpoint',()=>{
 const image=sig(4);
 const list=[
  {id:'A',category:'Trang phục',signatures:[sig(0),image]},
  {id:'B',category:'Trang phục',signatures:[sig(2)]},
 ];
 const matches=rankVisualCandidates(list,image);
 assert.equal(matches[0].row.id,'A');assert.equal(matches[0].distance,0);
 assert.equal(matches[0].referenceCount,2);
 assert.deepEqual(matches.map(x=>x.row.id),['A']);
 assert.equal(visualDistanceV2(image,image),0);
});
test('irrelevant stock is not forcibly returned when there is no good match',()=>{
 const matches=rankVisualCandidates([{id:'wrong',category:'Phụ kiện',signatures:[sig(2)]}],sig(6));
 assert.equal(matches.length,0);
});
test('category filter excludes otherwise exact but wrong product class',()=>{
 const list=[{id:'other',category:'Máy ảnh',signatures:[sig(4)]},{id:'wanted',category:'Áo dài',signatures:[sig(4)]}];
 const matches=rankVisualCandidates(list,sig(4),{category:'Áo dài'});
 assert.deepEqual(matches.map(x=>x.row.id),['wanted']);
});
test('relaxed search can include broader results but still respects a gap from the leader',()=>{
 const list=[{id:'exact',category:'A',signatures:[sig(0)]},{id:'close',category:'A',signatures:[sig(0,.15)]},{id:'wrong',category:'A',signatures:[sig(8)]}];
 const normal=rankVisualCandidates(list,sig(0));
 const broad=rankVisualCandidates(list,sig(0),{relaxed:true});
 assert.ok(normal.length<=broad.length);
 assert.ok(broad.some(x=>x.row.id==='exact'));
 assert.ok(!broad.some(x=>x.row.id==='wrong'));
});
test('visual search uses new version, server restricts index writes and product save indexes multiple photos',()=>{
 const route=readFileSync('src/app/api/v5/visual-catalog/route.ts','utf8');
 const page=readFileSync('src/app/page.tsx','utf8');
 const finder=readFileSync('src/components/GuVisualFinder.tsx','utf8');
 assert.match(route,/requireAdmin\(me\)/);assert.match(route,/validVisualSignatureV2/);
 assert.match(route,/paths\.includes\(entry\.imagePath\)/);
 assert.match(page,/newItem\.imagePaths\.slice\(0,5\)/);
 assert.match(finder,/rankVisualCandidates/);
 assert.match(finder,/!ranked\.length/);
});
