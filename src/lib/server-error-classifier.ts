/** GU VPS: sanitized errors from PostgreSQL without exposing SQL or credentials. */
export type ServerFailure={code:string;status:number;message:string};
export function classifyServerFailure(error:unknown):ServerFailure|null{
 if(!error||typeof error!=='object')return null;
 const e=error as {code?:unknown;message?:unknown};const code=String(e.code||'');
 if(code==='23505'||/Document already exists/.test(String(e.message)))return {code:'GU_DB_DUPLICATE',status:409,message:'Dữ liệu đã tồn tại. Hãy tải lại danh sách trước khi thử lại.'};
 if(code==='23503')return {code:'GU_DB_REFERENCE',status:409,message:'Dữ liệu liên quan không tồn tại hoặc đã bị thay đổi.'};
 if(['40001','40P01','55P03'].includes(code))return {code:'GU_DB_CONFLICT',status:409,message:'Giao dịch đang bị khóa hoặc thay đổi đồng thời. Vui lòng thử lại.'};
 if(code==='53300'||code==='53400')return {code:'GU_DB_CAPACITY',status:503,message:'PostgreSQL đang hết kết nối hoặc tài nguyên. Cần kiểm tra máy chủ.'};
 if(['ECONNREFUSED','ETIMEDOUT','57P01','57P02','57P03'].includes(code))return {code:'GU_DB_UNAVAILABLE',status:503,message:'Không thể kết nối PostgreSQL trên VPS. Hãy thử lại sau.'};
 if(code==='42P01')return {code:'GU_DB_SCHEMA',status:503,message:'Thiếu bảng PostgreSQL. Admin cần chạy npm run db:init.'};
 if(code==='28P01'||code==='42501')return {code:'GU_DB_PERMISSION',status:503,message:'Tài khoản PostgreSQL không đủ quyền hoặc sai mật khẩu.'};
 return null;
}
