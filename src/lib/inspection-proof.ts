export const DEFAULT_ANGLES=['Toàn thân trước','Toàn thân sau','Cổ áo','Tay áo'];
export type Capture={url:string;at:string;by:string;byName:string};
export type PhotoProof={itemId:string;shots:Record<string,Capture>;condition?:'OK'|'ISSUE'|'MISSING';note?:string};
export type ProofSet={status:'PENDING'|'SUBMITTED'|'APPROVED';by?:string;byName?:string;at?:string;reviewedBy?:string;reviewedAt?:string;items:PhotoProof[]};
export function normalizedAngles(angles:unknown):string[]{
  if(!Array.isArray(angles)||angles.length<1||angles.length>10||angles.some(x=>typeof x!=='string'||!x.trim()||x.length>70))throw new Error('Chọn từ 1 đến 10 góc chụp cho sản phẩm.');
  const result=angles.map(x=>(x as string).trim());
  if(new Set(result).size!==result.length)throw new Error('Không được trùng góc chụp.');
  return result;
}
export function completeProof(itemIds:string[],templates:Record<string,string[]>,proofs:PhotoProof[]):boolean{
  if(proofs.length!==itemIds.length||new Set(proofs.map(p=>p.itemId)).size!==proofs.length)return false;
  return itemIds.every(id=>{const p=proofs.find(x=>x.itemId===id);return !!p&&templates[id].every(a=>!!p.shots[a]?.url);});
}
