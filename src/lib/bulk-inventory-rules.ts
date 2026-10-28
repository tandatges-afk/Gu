import {normalizeProductName} from './product-name.ts';

/** Hard limit for one serialized PostgreSQL transaction; 100 items per save. */
export const MAX_BULK_ITEMS=100;
export type BulkNameIssue={row:number;code:'EMPTY'|'DUPLICATE'|'EXISTING';message:string};
/** Client preview only; PostgreSQL name-index checks inside the save transaction are authoritative. */
export function validateBulkNames(names:readonly string[],existingNames:readonly string[]=[]):BulkNameIssue[]{
 const previous=new Map<string,number>();
 const existing=new Set(existingNames.map(normalizeProductName).filter(Boolean));
 return names.flatMap<BulkNameIssue>((name,i):BulkNameIssue[]=>{
  const key=normalizeProductName(name.trim());
  if(!key)return [{row:i,code:'EMPTY' as const,message:'Nhập tên sản phẩm.'}];
  if(previous.has(key))return [{row:i,code:'DUPLICATE' as const,message:`Trùng tên với dòng ${previous.get(key)!+1}.`}];
  previous.set(key,i);
  return existing.has(key)?[{row:i,code:'EXISTING' as const,message:'Tên sản phẩm đã có trong kho.'}]:[];
 });
}
