/** Inventory-code search is text based. Never convert a partial code like "00" to number 0. */
export function isInventoryCodeQuery(value: string): boolean {
  return /^(?:GU[-\s]?)?\d{1,5}$/i.test(value.trim());
}
export function inventoryCodeNeedle(value: string): string {
  const term = value.trim().toUpperCase();
  return term.replace(/^GU[-\s]?/, '');
}
export function matchesInventoryCode(hangerCode: string | null | undefined, query: string): boolean {
  if (!isInventoryCodeQuery(query) || !hangerCode) return false;
  const codeDigits = hangerCode.toUpperCase().replace(/^GU-/, '');
  return codeDigits.includes(inventoryCodeNeedle(query));
}
