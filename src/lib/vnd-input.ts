/**
 * VND input: formatting is presentation-only. State/API values remain whole VND.
 * No decimals or negative values are permitted for monetary form fields.
 */
export function vndDigits(value: string | number): string {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits.replace(/^0+(?=\d)/, '');
}
export function formatVndInput(value: string | number): string {
  const digits = vndDigits(value);
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
/** Map caret from the raw user text to the formatted text by digit position. */
export function vndCaretPosition(formatted: string, digitsBeforeCaret: number): number {
  if(digitsBeforeCaret <= 0) return 0;
  let seen = 0;
  for(let i=0;i<formatted.length;i++){
    if(/\d/.test(formatted[i]))seen++;
    if(seen===digitsBeforeCaret)return i+1;
  }
  return formatted.length;
}
