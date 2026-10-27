import type { RentalLine, ReturnInspection } from './types';
export type ProposedReturnCheck={itemId:string;status:'OK'|'MISSING'};
/** Entire return checklist validated on server; never trust browser-submitted compensation amounts. */
export function calculateInspection(
  lines:Pick<RentalLine,'itemId'|'sku'|'replacementValue'>[],
  submitted:unknown,
  legacyValues:Record<string,number>={}
):ReturnInspection[] {
  if(!Array.isArray(submitted)||submitted.length!==lines.length)
    throw new Error('Checklist phải kiểm tra tất cả sản phẩm.');
  const seen=new Set<string>();
  for(const entry of submitted){
    if(!entry||typeof entry!=='object'||typeof entry.itemId!=='string'||!['OK','MISSING'].includes(entry.status)||seen.has(entry.itemId)||!lines.some(l=>l.itemId===entry.itemId))
      throw new Error('Checklist thiếu, trùng hoặc có sản phẩm không hợp lệ.');
    seen.add(entry.itemId);
  }
  return lines.map(l=>{
    const decision=(submitted as ProposedReturnCheck[]).find(x=>x.itemId===l.itemId)!;
    const value=(l.replacementValue||0)>0?l.replacementValue:(legacyValues[l.itemId]||0);
    if(decision.status==='MISSING'&&(!Number.isSafeInteger(value)||value<=0))
      throw new Error(`Admin chưa định giá đền bù cho ${l.sku}.`);
    return {itemId:l.itemId,sku:l.sku,status:decision.status,compensation:decision.status==='MISSING'?value:0};
  });
}
