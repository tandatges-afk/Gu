/** Data-retention decisions are pure and testable without any provider connection. */
export const ORPHAN_EVIDENCE_AGE_MS=24*60*60*1000;
export const SENSITIVE_RETENTION_MS=5*24*60*60*1000;
/** Physically delete sensitive evidence >= 5 days after the order is closed.
 * Never delete an unreturned CCCD/collateral even when the clock expires.
 */
export function cleanupAllowed(order:Record<string,unknown>,now=Date.now()):boolean {
 const finished=order.status==='RETURNED'||order.status==='CANCELLED'||order.status==='VOIDED';
 if(!finished)return false;
 if(order.status==='RETURNED'&&(order.handoverDepositProofId||order.hadHandoverDeposit)&&!order.collateralReturnedAt)return false;
 const endedAt=order.status==='RETURNED'?order.returnedAt:order.updatedAt;
 if(typeof endedAt!=='string')return false; // Fail closed on legacy records without a verified completion timestamp.
 const ended=Date.parse(endedAt);
 return Number.isFinite(ended)&&ended<=now-SENSITIVE_RETENTION_MS;
}
export function orphanOldEnough(createdAt:unknown,now=Date.now()):boolean {
 if(typeof createdAt!=='string')return false;
 const time=Date.parse(createdAt);
 return Number.isFinite(time)&&time<=now-ORPHAN_EVIDENCE_AGE_MS;
}
