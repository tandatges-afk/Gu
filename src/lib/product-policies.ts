/** GU category rules. Historical size fields remain in Firestore for old orders. */
export const LEGACY_DEFAULT_CATEGORIES = ['Áo dài','Váy','Vest','Trang phục','Khác'] as const;
export const BUILTIN_CATEGORIES = ['Phụ kiện','Máy ảnh'] as const;
export const DEFAULT_PRODUCT_SIZE = 'Một size';
export function isNonLaundryCategory(category:string):boolean{
  return category.trim().toLocaleLowerCase('vi-VN') === 'máy ảnh' || /^phụ\s*kiện$/i.test(category.trim());
}
export function launderingForCategory(category:string, selected:boolean):boolean{
  return isNonLaundryCategory(category) ? false : selected;
}
export function categorySelectOptions(custom:string[],selected?:string):string[]{
  const hidden = new Set<string>(LEGACY_DEFAULT_CATEGORIES);
  const opts=[...BUILTIN_CATEGORIES,...custom.filter(c=>!hidden.has(c))];
  if(selected && !opts.includes(selected))opts.push(selected); // edit legacy inventory safely
  return [...new Set(opts)];
}
