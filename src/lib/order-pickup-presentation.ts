import type {RentalOrder} from './types';

/** The primary displayed pickup time is the physical handover once it exists.
 * Keep scheduledPickupAt/pickupAt unchanged: they preserve the agreed reservation,
 * availability locks, audit trail and billing policy (earlier handover is billable).
 */
export function pickupForDisplay(order:Pick<RentalOrder,'status'|'pickupAt'|'scheduledPickupAt'|'handoverProof'>):string|undefined{
 const actual=order.handoverProof?.at;
 if(order.status!=='RESERVED' && actual && Number.isFinite(Date.parse(actual)))return actual;
 return order.scheduledPickupAt || order.pickupAt;
}
export function wasHandedOverEarly(order:Pick<RentalOrder,'status'|'pickupAt'|'scheduledPickupAt'|'handoverProof'>):boolean{
 const actual=order.handoverProof?.at;
 const planned=order.scheduledPickupAt || order.pickupAt;
 return Boolean(actual && planned && Number.isFinite(Date.parse(actual)) && Number.isFinite(Date.parse(planned)) && Date.parse(actual)<Date.parse(planned));
}
