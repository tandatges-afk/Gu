/** Names are unique regardless of Vietnamese accents, casing, punctuation or repeated spaces. */
export function normalizeProductName(value:string):string {
  return value.normalize('NFKD').replace(/[đĐ]/g,'d')
    .replace(/\p{M}/gu,'')
    .toLocaleLowerCase('vi-VN')
    .replace(/[\p{P}\p{S}]+/gu,' ')
    .replace(/\s+/g,' ').trim();
}
/** Safe, reversible document ID; maximum product name length is 120 chars. */
export function productNameIndexId(name:string):string {
  const key=normalizeProductName(name);
  if(!key)throw new Error('Tên sản phẩm không hợp lệ.');
  return encodeURIComponent(key);
}
export const PRODUCT_NAME_INDEX_MIGRATION='product-name-index-v1';
