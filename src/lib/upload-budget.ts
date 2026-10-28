import 'server-only';
import {db} from './firebase-admin';
import {ApiError} from './http';
import {vnDayKey} from './hourly-pricing';
/** Per-account, per-Vietnam-day quotas shared by product, inspection and secure uploads.
 * Counter is claimed before writing disk: a failed upload may consume budget, but
 * cannot evade a denial by racing another employee browser window.
 */
export async function reserveUploadBudget(uid:string,role:'admin'|'staff',bytes:number){
 const day=vnDayKey(new Date().toISOString());
 const ref=db().collection('uploadBudgets').doc(day+'_'+uid);
 const maxCount=role==='admin'?1500:600;
 const maxBytes=role==='admin'?3*1024*1024*1024:1024*1024*1024;
 await db().runTransaction(async tx=>{
  const previous=await tx.get(ref);
  const count=Number(previous.data()?.count||0),total=Number(previous.data()?.bytes||0);
  if(!Number.isSafeInteger(count)||!Number.isSafeInteger(total)||count<0||total<0)
   throw new ApiError(503,'Thống kê tải ảnh chưa hợp lệ. Liên hệ Admin.');
  if(count>=maxCount||total+bytes>maxBytes)
   throw new ApiError(429,'Tài khoản đã đạt giới hạn tải ảnh hôm nay. Liên hệ Admin nếu cần thao tác thêm.');
  tx.set(ref,{count:count+1,bytes:total+bytes,day,uid,updatedAt:new Date().toISOString()});
 });
}
