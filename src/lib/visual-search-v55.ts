/** Pure visual-search helpers. Product catalog contains no private customer evidence. */
export const VISUAL_CACHE_MS = 5*60_000;
export const VISUAL_MODEL_ID = 'Xenova/clip-vit-base-patch32';
export const VISUAL_FAST_LIMIT = 60;
export const VISUAL_MAX_RESULTS = 12;
export type CropMode = 'full'|'center'|'lower'|'left'|'right';

export function visualCategoryAllowed(category:string, allowed:string[]):boolean {
  return category==='ALL'||allowed.includes(category);
}
export function visualCategoryQuery(category:string):string {
  if(category!=='ALL'&&(!category.trim()||category.length>90||/[\u0000-\u001f]/.test(category)))throw Error('Danh mục tìm ảnh không hợp lệ.');
  return category;
}
export function visualCacheKey(uid:string,category:string):string {
  return `gu-visual-v55:${uid}:${encodeURIComponent(category)}`;
}
export function normalizedVector(values:ArrayLike<number>):number[] {
  let norm=0;for(let i=0;i<values.length;i++){const value=Number(values[i]);if(!Number.isFinite(value))throw Error('Embedding AI không hợp lệ.');norm+=value*value;}
  if(!norm)throw Error('Embedding AI rỗng.');const scale=Math.sqrt(norm);
  return Array.from(values,v=>Number(v)/scale);
}
export function vectorSimilarity(a:number[],b:number[]):number {
  if(!a.length||a.length!==b.length)throw Error('Hai embedding không đồng nhất.');
  let sum=0;for(let i=0;i<a.length;i++)sum+=a[i]*b[i];return sum;
}
export function cropBounds(mode:CropMode):[number,number,number,number] {
  switch(mode){
    case 'center': return [.18,.15,.64,.72];
    case 'lower': return [.14,.34,.72,.64];
    case 'left': return [0,0,.5,1];
    case 'right': return [.5,0,.5,1];
    default:return [0,0,1,1];
  }
}

/** Auto-region choice: no manual crop selector. Full image is kept as a reference. */
export function automaticVisualCrops(category:string):CropMode[]{
 const normalized=category.normalize('NFC').toLocaleLowerCase('vi');
 if(/chân\s*váy|quần|skirt|pants|short/.test(normalized))return ['lower','full'];
 if(/\báo\b|áo|shirt|blouse|top/.test(normalized))return ['center','full'];
 return ['full'];
}
