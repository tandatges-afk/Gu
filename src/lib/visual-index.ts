/** Compact approximate-visual descriptor. This is not a learned AI embedding.
 * Colour quadrants + brightness histogram + gradient dHash improve tolerance to
 * background and scale, but large viewpoint changes may still need manual review.
 */
export type VisualSignature={version:1;features:number[];hash:string};
export function validVisualSignature(v:unknown):v is VisualSignature{
 if(!v||typeof v!=='object')return false;
 const s=v as Partial<VisualSignature>;
 return s.version===1&&Array.isArray(s.features)&&s.features.length===24&&
  s.features.every(x=>typeof x==='number'&&Number.isFinite(x)&&x>=0&&x<=1.001)&&
  typeof s.hash==='string'&&/^[0-9a-f]{16}$/.test(s.hash);
}
const bitTable=Array.from({length:16},(_,i)=>((i&1)+((i>>1)&1)+((i>>2)&1)+((i>>3)&1)));
export function visualDistance(a:VisualSignature,b:VisualSignature){
 if(!validVisualSignature(a)||!validVisualSignature(b))throw Error('Dấu vân tay ảnh không hợp lệ');
 const color=a.features.reduce((sum,x,i)=>sum+Math.abs(x-b.features[i]),0)/24;
 let diff=0;
 for(let i=0;i<16;i++){
  const xor=parseInt(a.hash[i],16)^parseInt(b.hash[i],16);
  diff+=bitTable[xor];
 }
 return 0.72*color+0.28*diff/64;
}
export function rankVisualItems<T extends {id:string;signature:VisualSignature}>(source:readonly T[],needle:VisualSignature,take=12):T[]{
 return [...source].sort((a,b)=>visualDistance(a.signature,needle)-visualDistance(b.signature,needle)).slice(0,take);
}

/** v2: foreground-aware descriptor. Separate from v1 so stale indexes are never
 * silently compared against an incompatible image feature layout. */
export type VisualSignatureV2={version:2;features:number[];hash:string};
export type VisualIndexEntry={imagePath:string;signature:VisualSignatureV2};
export const VISUAL_V2_FEATURES=58;
export function validVisualSignatureV2(v:unknown):v is VisualSignatureV2{
 if(!v||typeof v!=='object')return false;
 const s=v as Partial<VisualSignatureV2>;
 return s.version===2&&Array.isArray(s.features)&&s.features.length===VISUAL_V2_FEATURES&&
  s.features.every(x=>typeof x==='number'&&Number.isFinite(x)&&x>=0&&x<=1.0001)&&
  typeof s.hash==='string'&&/^[0-9a-f]{16}$/.test(s.hash);
}
export function validVisualIndexEntries(v:unknown):v is VisualIndexEntry[]{
 return Array.isArray(v)&&v.length<=5&&v.every(x=>x&&typeof x.imagePath==='string'&&x.imagePath.length<600&&validVisualSignatureV2(x.signature))&&
  new Set(v.map(x=>x.imagePath)).size===v.length;
}
function part(a:number[],b:number[],from:number,to:number):number{
 let sum=0;
 for(let i=from;i<to;i++)sum+=Math.abs(a[i]-b[i]);
 return sum/2; // histogram L1 in the 0..1 range
}
export function visualDistanceV2(a:VisualSignatureV2,b:VisualSignatureV2):number{
 if(!validVisualSignatureV2(a)||!validVisualSignatureV2(b))throw Error('Chỉ mục ảnh V2 không hợp lệ.');
 // features: hue[0..11], saturation[12..16], lightness[17..21],
 // subject shape[22..37], edge orientation[38..45], grayscale[46..53],
 // subject mean RGB[54..56], foreground fraction[57].
 const x=a.features,y=b.features;
 const hue=part(x,y,0,12);
 const sat=part(x,y,12,17);
 const light=part(x,y,17,22);
 const shape=part(x,y,22,38);
 const edges=part(x,y,38,46);
 const gray=part(x,y,46,54);
 const mean=(Math.abs(x[54]-y[54])+Math.abs(x[55]-y[55])+Math.abs(x[56]-y[56]))/3;
 let hashDiff=0;
 for(let i=0;i<16;i++)hashDiff+=bitTable[parseInt(a.hash[i],16)^parseInt(b.hash[i],16)];
 return .33*hue+.11*sat+.12*light+.14*shape+.1*edges+.065*gray+.075*mean+.06*(hashDiff/64);
}
export type RankedVisualHit<T>={row:T;distance:number;referenceCount:number};
/** Return *only* candidates which cross an absolute cutoff AND remain reasonably
 * close to the leading match. Never force a fixed top-12 list of irrelevant stock. */
export function rankVisualCandidates<T extends {id:string;category?:string;signatures:VisualSignatureV2[]}>(
 source:readonly T[],needle:VisualSignatureV2,{category='ALL',relaxed=false,take=6}:{category?:string;relaxed?:boolean;take?:number}={}
):RankedVisualHit<T>[]{
 if(!validVisualSignatureV2(needle))throw Error('Ảnh mẫu chưa phân tích được.');
 const scored=source.filter(row=>(category==='ALL'||row.category===category)&&row.signatures.some(validVisualSignatureV2))
  .map(row=>({row,distance:Math.min(...row.signatures.filter(validVisualSignatureV2).map(sig=>visualDistanceV2(sig,needle))),referenceCount:row.signatures.length}))
  .sort((a,b)=>a.distance-b.distance||a.row.id.localeCompare(b.row.id));
 if(!scored.length)return [];
 const maxDistance=relaxed?.36:.245;
 const relativeGap=relaxed?.125:.085;
 const cutoff=Math.min(maxDistance,scored[0].distance+relativeGap);
 return scored.filter(hit=>hit.distance<=cutoff).slice(0,Math.min(12,Math.max(1,take)));
}
