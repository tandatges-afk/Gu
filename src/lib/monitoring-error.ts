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
/** Provider 403 messages often do not include google.rpc.ErrorInfo.reason.
 * Categorize a small allowlist of known errors without relaying free-form API text to the browser. */
export function monitoringFailureCategory(status:number,raw:unknown):string{
  const reason=monitoringErrorReason(raw);
  const err=(raw&&typeof raw==='object'?(raw as GoogleMonitoringError).error:null);
  const msg=typeof err?.message==='string'?err.message.toLowerCase():'';
  if(reason==='BILLING_DISABLED'||reason==='BILLING_NOT_ENABLED'||/requires? billing to be enabled|billing (account|is) (disabled|not enabled)|enable billing|billing check failed/.test(msg))return 'BILLING_REQUIRED';
  if(reason==='SERVICE_DISABLED'||reason==='API_DISABLED'||(/(api|service) (has not been used|is disabled|not enabled)/.test(msg)))return 'SERVICE_DISABLED';
  if(reason==='ACCESS_TOKEN_SCOPE_INSUFFICIENT'||/insufficient authentication scopes|insufficient oauth scope/.test(msg))return 'SCOPE_INSUFFICIENT';
  if(reason==='IAM_PERMISSION_DENIED'||(/permission monitoring\.timeseries\.list denied|does not have monitoring\.timeseries\.list permission/.test(msg)))return 'IAM_DENIED';
  if(reason==='CONSUMER_INVALID'||reason==='SERVICE_NOT_VISIBLE')return 'PROJECT_CONSUMER_INVALID';
  if(status===429)return 'RATE_LIMITED';
  if(status===401)return 'INVALID_TOKEN';
  if(status===400)return 'INVALID_REQUEST';
  if(status===403)return 'PERMISSION_DENIED_UNKNOWN';
  return 'PROVIDER_ERROR';
}
export function safeMonitoringDiagnostics(status:number,raw:unknown){
  return {httpStatus:status,googleStatus:(raw&&typeof raw==='object'&&typeof (raw as GoogleMonitoringError).error?.status==='string')?(raw as GoogleMonitoringError).error!.status:null,
    googleReason:monitoringErrorReason(raw),category:monitoringFailureCategory(status,raw)};
}
export function explainMonitoringError(status:number,raw:unknown):string{
  const diag=safeMonitoringDiagnostics(status,raw);
  const prefix=`Cloud Monitoring HTTP ${status} · ${diag.googleReason||diag.category}`;
  switch(diag.category){
   case 'BILLING_REQUIRED':return `${prefix}: Google yêu cầu bật billing để service account gọi API này. Dự án Spark có thể bị từ chối dù API đã bật và Monitoring Viewer đã được cấp. GU không tự kích hoạt thanh toán. Có thể xem lượt sử dụng trên Firebase Console hoặc cân nhắc Blaze sau khi xem kỹ chi phí.`;
   case 'SERVICE_DISABLED':return `${prefix}: Cloud Monitoring API chưa bật hoặc chưa hoạt động ở project tiêu thụ truy vấn. Kiểm tra monitoring.googleapis.com của đúng project.`;
   case 'IAM_DENIED':return `${prefix}: Google báo tài khoản dịch vụ (principal đang gọi) thiếu monitoring.timeSeries.list. So sánh Service Account key đang dùng với tài khoản đã cấp Monitoring Viewer.`;
   case 'SCOPE_INSUFFICIENT':return `${prefix}: token thiếu OAuth scope cần thiết. Kiểm tra access token Firebase Admin SDK.`;
   case 'PROJECT_CONSUMER_INVALID':return `${prefix}: project tiêu thụ API không hợp lệ hoặc không truy cập được.`;
   case 'INVALID_REQUEST':return `${prefix}: truy vấn không hợp lệ (metric/filter/interval). Không tự kết luận thiếu IAM.`;
   case 'INVALID_TOKEN':return `${prefix}: token xác thực không hợp lệ hoặc đã hết hạn.`;
   case 'RATE_LIMITED':return `${prefix}: quá hạn mức yêu cầu của API, thử lại sau.`;
   case 'PERMISSION_DENIED_UNKNOWN':return `${prefix}: Google trả 403; nguyên nhân thực tế chưa xác minh vì Google không công bố đủ lý do. API và Monitoring Viewer đã được kiểm tra; cần chạy npm run diagnose:monitoring tại Codespaces hoặc xem bản ghi chẩn đoán an toàn trong Vercel Logs. Không cấp thêm Admin chỉ để thử.`;
   default:return `${prefix}: chưa lấy được thống kê. Xem nhật ký máy chủ để chẩn đoán.`;
  }
}
