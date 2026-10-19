/** Only complete, Admin-approved handover+return pairs count as one round. */
export const KEEP_INSPECTION_ROUNDS=7;
export type InspectionRound={orderId:string;completedAt:string};
export function addCompletedRound(rounds:InspectionRound[],round:InspectionRound){
 const ordered=[...rounds.filter(r=>r.orderId!==round.orderId),round].sort((a,b)=>a.completedAt.localeCompare(b.completedAt)||a.orderId.localeCompare(b.orderId));
 return {keep:ordered.slice(-KEEP_INSPECTION_ROUNDS),expired:ordered.slice(0,-KEEP_INSPECTION_ROUNDS)};
}
export function inspectionPublicId(url:string,orderId:string,cloud:string):string{
 const prefix=`https://res.cloudinary.com/${cloud}/image/upload/`;
 if(!url.startsWith(prefix))throw new Error('Ảnh không thuộc Cloudinary GU.');
 const matched=url.slice(prefix.length).match(/^(?:v\d+\/)?(gu\/inspections\/[A-Za-z0-9_-]+\/([A-Za-z0-9]+)\/(?:handover|return)\/[a-f0-9-]{36})\.(?:jpg|jpeg|png|webp)$/);
 if(!matched||matched[2]!==orderId)throw new Error('Từ chối xóa ảnh ngoài phạm vi đơn.');
 return matched[1];
}
