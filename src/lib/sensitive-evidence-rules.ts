/** Fail-closed policy for sensitive evidence. Automatic deletion remains opt-in
 * until an administrator explicitly approves it and confirms retention rules.
 */
export function cleanupAllowed(order:Record<string,unknown>):boolean {
  return order.status==='RETURNED'
    && order.sensitiveEvidenceCleanupApproved===true
    && typeof order.sensitiveEvidenceCleanupApprovedAt==='string'
    && Number.isFinite(Date.parse(order.sensitiveEvidenceCleanupApprovedAt));
}
export function orphanOldEnough(createdAt:unknown,now=Date.now()):boolean {
  if(process.env.GU_ALLOW_ORPHAN_CLEANUP!=='1')return false;
  if(typeof createdAt!=='string')return false;
  const at=Date.parse(createdAt);
  return Number.isFinite(at)&&at<now-30*86400000&&at<=now;
}
