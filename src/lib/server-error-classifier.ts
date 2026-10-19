/** Map common Firestore transport failures to actionable, non-sensitive diagnostic responses. */
export type ServerFailure={code:string;status:number;message:string};
export function classifyServerFailure(error:unknown):ServerFailure|null{
 if(!error||typeof error!=='object')return null;
 const e=error as {code?:unknown;message?:unknown;details?:unknown};
 // gRPC numeric status codes used by firebase-admin/firestore; strings are supported too.
 const code=typeof e.code==='string'?e.code.toUpperCase():e.code;
 switch(code){
  case 7:case 'PERMISSION_DENIED': return {code:'GU_DB_PERMISSION',status:503,message:'Firestore từ chối truy cập. Kiểm tra quyền tài khoản dịch vụ trên project Firebase.'};
  case 8:case 'RESOURCE_EXHAUSTED':return {code:'GU_DB_LIMIT',status:503,message:'Firestore đã chạm giới hạn tài nguyên. Kiểm tra Usage và quota trong Firebase Console.'};
  case 9:case 'FAILED_PRECONDITION':{
   const detail=String(e.message||'')+' '+String(e.details||'');
   if(/requires an index|create (?:it|the index)|missing (?:a )?(?:composite )?index|no matching index/i.test(detail))
    return {code:'GU_DB_INDEX_REQUIRED',status:503,message:'Truy vấn Firestore đang thiếu chỉ mục. Cần tạo index được chỉ rõ trong Vercel Logs.'};
   if(/transaction|reads? before writes?|read operations after write|too much contention|document.*no longer exists/i.test(detail))
    return {code:'GU_DB_TRANSACTION',status:409,message:'Dữ liệu thay đổi đồng thời hoặc giao dịch Firestore không hợp lệ. Vui lòng thử lại.'};
   return {code:'GU_DB_PRECONDITION',status:503,message:'Firestore không chấp nhận yêu cầu. Cần kiểm tra nguyên nhân chi tiết trong Vercel Logs.'};
  }
  case 14:case 'UNAVAILABLE':return {code:'GU_DB_UNAVAILABLE',status:503,message:'Firestore tạm thời không khả dụng. Hãy thử lại sau.'};
  case 4:case 'DEADLINE_EXCEEDED':return {code:'GU_DB_TIMEOUT',status:503,message:'Kết nối Firestore quá thời gian. Hãy thử lại.'};
  case 16:case 'UNAUTHENTICATED':return {code:'GU_DB_AUTH',status:503,message:'Firebase Admin chưa xác thực được. Kiểm tra cấu hình service account.'};
  default:return null;
 }
}
