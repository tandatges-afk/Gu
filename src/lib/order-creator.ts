import type {RentalOrder} from './types';
/** A historic order only stored an immutable creator UID; newer orders also snapshot a name. */
export function orderCreatorName(order:Pick<RentalOrder,'createdBy'|'createdByName'>,staffNames?:Record<string,string>):string {
  const snapshot=typeof order.createdByName==='string'?order.createdByName.trim():'';
  if(snapshot)return snapshot;
  const legacyName=order.createdBy ? staffNames?.[order.createdBy]?.trim() : '';
  return legacyName||'Chưa rõ nhân viên';
}
