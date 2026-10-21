/** Sanitized failure classification for Firebase Storage private uploads/downloads.
 * Never forward the underlying cloud error's message (could contain bucket names or paths).
 */
export type StorageFailure = {code:string;status:number;message:string};
export function classifyStorageFailure(err:unknown,operation:'metadata'|'upload'|'download'|'delete'='upload'):StorageFailure|null{
 if(!err||typeof err!=='object')return null;
 const e=err as {code?:unknown;statusCode?:unknown;message?:unknown;response?:{statusCode?:unknown}};
 const code=String(e.code??'').toUpperCase();
 const status=Number(e.statusCode??e.response?.statusCode??(/^(401|403|404|429|503)$/.test(code)?code:'0'));
 const message=String(e.message||'');
 const bucketNotFound=/the specified bucket does not exist|bucket.*not found|no such bucket|bucket does not exist/i.test(message);
 if(bucketNotFound||(operation==='metadata'&&(status===404||code==='NOT_FOUND')))
  return {code:'GU_STORAGE_BUCKET_NOT_FOUND',status:503,message:'Bucket ảnh bảo mật chưa tồn tại hoặc tên không khớp. Kiểm tra Storage → Files và dự án Firebase đang chạy.'};
 if(status===404||code==='NOT_FOUND'){
  if(operation==='download'||operation==='delete')return {code:'GU_STORAGE_OBJECT_NOT_FOUND',status:404,message:'Ảnh bảo mật không còn tồn tại trong Storage. Cần kiểm tra hồ sơ ảnh của đơn này.'};
  return {code:'GU_STORAGE_UPLOAD_NOT_FOUND',status:503,message:'Storage không tìm thấy đích tải ảnh. Admin cần kiểm tra bucket trực tiếp trong mục Hệ thống của GU.'};
 }
 if(status===403||code==='PERMISSION_DENIED'||/storage\.objects\.create|storage\.objects\.get|storage\.objects\.delete|permission.?denied|insufficient permission|serviceusage\.services\.use|billing.*(required|disabled)/i.test(message))
  return {code:'GU_STORAGE_PERMISSION',status:503,message:'Firebase Storage từ chối thao tác. Kiểm tra gói Blaze (nếu yêu cầu) và quyền Storage Object Admin của FIREBASE_CLIENT_EMAIL trên đúng bucket.'};
 if(status===401||code==='UNAUTHENTICATED'||/invalid.?credential|invalid.?grant|unauthorized/i.test(message))
  return {code:'GU_STORAGE_AUTH',status:503,message:'Firebase Storage chưa xác thực được tài khoản dịch vụ. Kiểm tra biến Firebase Admin trên Vercel.'};
 if(status===429||code==='RESOURCE_EXHAUSTED'||/quota.*exceed|rate limit/i.test(message))
  return {code:'GU_STORAGE_LIMIT',status:503,message:'Firebase Storage đang vượt hạn mức hoặc bị giới hạn tạm thời. Thử lại sau.'};
 if(status===503||code==='UNAVAILABLE'||code==='ETIMEDOUT'||code==='ECONNRESET'||/socket hang up|network timeout/i.test(message))
  return {code:'GU_STORAGE_UNAVAILABLE',status:503,message:'Kết nối Firebase Storage tạm thời lỗi. Vui lòng thử lại sau.'};
 return null;
}
