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
