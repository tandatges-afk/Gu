import {normalizeProductName} from './product-name.ts';
/** Accent-insensitive, case-insensitive, anywhere within the product name. */
export function productSearchText(value:string):string{return normalizeProductName(value);}
/** Firestore array-contains on first pair, followed by full in-memory normalized match.
 * Index update is required for existing stock (data:apply-names). No composite index needed. */
export function productSearchBigrams(value:string):string[]{
 const normalized=productSearchText(value);const grams=new Set<string>();
 for(const ch of normalized)grams.add(ch);
 for(let i=0;i<normalized.length-1;i++)grams.add(normalized.slice(i,i+2));
 return [...grams].slice(0,140);
}
export function matchesProductSearch(value:string,query:string):boolean{
 return productSearchText(value).includes(productSearchText(query));
}
