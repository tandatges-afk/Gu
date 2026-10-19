/** Translate Google Cloud Monitoring HTTP failures without exposing credentials or raw response bodies. */
export type GoogleMonitoringError={error?:{
  status?:string;message?:string;code?:number;
  details?:Array<{reason?:string;domain?:string;metadata?:Record<string,string>}>;
}};
export function monitoringErrorReason(raw:unknown):string|null{
  if(!raw||typeof raw!=='object')return null;
  const err=(raw as GoogleMonitoringError).error;
  if(!err||!Array.isArray(err.details))return null;
  for(const item of err.details){
    if(typeof item?.reason==='string'&&/^[A-Z][A-Z0-9_]{2,79}$/.test(item.reason))return item.reason;
  }
  return null;
}
export function explainMonitoringError(status:number,raw:unknown):string{
  const reason=monitoringErrorReason(raw);
  const prefix=`Cloud Monitoring HTTP ${status}${reason?' · '+reason:''}`;
  if(reason==='SERVICE_DISABLED')return `${prefix}: Cloud Monitoring API chưa bật hoặc chưa hoạt động trong project Firebase của GU. Bật monitoring.googleapis.com trong đúng project, đợi áp dụng rồi nhấn Cập nhật.`;
  if(reason==='IAM_PERMISSION_DENIED'||reason==='PERMISSION_DENIED')return `${prefix}: tài khoản dịch vụ dùng bởi Vercel chưa có quyền truy vấn Monitoring tại project đang gọi. Kiểm tra FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL và vai trò Monitoring Viewer trên cùng project.`;
  if(reason==='ACCESS_TOKEN_SCOPE_INSUFFICIENT')return `${prefix}: access token thiếu OAuth scope monitoring.read/cloud-platform. Kiểm tra cách tạo token từ Firebase Admin SDK.`;
  if(reason==='BILLING_DISABLED')return `${prefix}: Google báo billing chưa sẵn sàng cho yêu cầu này. Kiểm tra thông báo cụ thể trong Google Cloud Console trước khi thay đổi gói.`;
  if(reason==='CONSUMER_INVALID'||reason==='SERVICE_NOT_VISIBLE')return `${prefix}: project tiêu thụ API chưa hợp lệ hoặc không truy cập được. Kiểm tra mã project và Cloud Monitoring API.`;
  if(status===403)return `${prefix}: Google từ chối truy vấn. Vai trò Monitoring Viewer trên ảnh đã được cấp; nguyên nhân thực tế chưa xác minh. Kiểm tra Cloud Monitoring API đã bật và project Vercel đang gọi.`;
  if(status===400)return `${prefix}: yêu cầu Monitoring API không hợp lệ. Kiểm tra bộ lọc metric, view=FULL và interval; không phải do thiếu quyền IAM.`;
  if(status===401)return `${prefix}: token xác thực Google không hợp lệ hoặc đã hết hạn.`;
  if(status===429)return `${prefix}: API giới hạn số yêu cầu; thử lại sau.`;
  return `${prefix}: không lấy được thống kê; thử lại hoặc kiểm tra Cloud Monitoring API.`;
}
