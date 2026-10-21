/** Data-retention decisions are pure and testable without any provider connection. */
export const ORPHAN_EVIDENCE_AGE_MS=24*60*60*1000;
export function cleanupAllowed(order:Record<string,unknown>):boolean {
 if(order.status==='CANCELLED'||order.status==='VOIDED')return true;
 if(order.status!=='RETURNED'||order.photoReviewStatus==='PENDING')return false;
 return order.photoReviewStatus==='REVIEWED'||Boolean(order.reviewedAt&&order.returnStage==='APPROVED');
}
export function orphanOldEnough(createdAt:unknown,now=Date.now()):boolean {
 if(typeof createdAt!=='string')return false;
 const time=Date.parse(createdAt);
 return Number.isFinite(time)&&time<=now-ORPHAN_EVIDENCE_AGE_MS;
}
