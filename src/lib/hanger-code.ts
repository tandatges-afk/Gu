/** Human-friendly hanger label; inventory identity remains the immutable Firestore item ID. */
export const HANGER_COUNTER_DOC = 'hanger';
export const HANGER_LIMIT = 99999;
export function nextHangerSequence(value: unknown): number {
  if (value === undefined || value === null) return 1;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value >= HANGER_LIMIT)
    throw new Error('Bộ đếm mã móc bị lỗi hoặc đã hết khoảng mã. Liên hệ Admin.');
  return value + 1;
}
export function formatHangerCode(sequence: number): string {
  if (!Number.isSafeInteger(sequence) || sequence < 1 || sequence > HANGER_LIMIT)
    throw new Error('Dãy số mã móc không hợp lệ.');
  return `GU-${String(sequence).padStart(5, '0')}`;
}
export function getHangerCode(item: {hangerCode?: string | null}): string | null {
  return typeof item.hangerCode === 'string' && /^GU-\d{5}$/.test(item.hangerCode) ? item.hangerCode : null;
}
