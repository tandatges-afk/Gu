import { NextRequest, NextResponse } from 'next/server';
import { db, serverAuth } from './firebase-admin';
import { Role } from './types';
import { classifyTokenFailure } from './auth-errors';
import { randomUUID } from 'node:crypto';
import {isTrustedMutationOrigin} from './request-origin';
import {classifyServerFailure} from './server-error-classifier';
import { currentStaffAccess, isoWeekMonday, vnDate, type ShiftWeekRecord } from './shift-schedule';
export class ApiError extends Error {
  constructor(public status: number, message: string, public details?: unknown) { super(message); }
}
export async function staffUser(req: NextRequest, options?:{allowSchedule?:boolean}) {
  const token = req.cookies.get('gu_session')?.value;
  if(!['GET','HEAD','OPTIONS'].includes(req.method) && !isTrustedMutationOrigin(req.headers))
    throw new ApiError(403,'Nguồn yêu cầu không hợp lệ.');
  if(!['GET','HEAD','OPTIONS'].includes(req.method)){
    const origin=req.headers.get('origin');const host=req.headers.get('host');
    if(origin&&host){let parsed:URL;try{parsed=new URL(origin);}catch{throw new ApiError(403,'Nguồn yêu cầu không hợp lệ.');}
      if(parsed.host!==host||!['https:','http:'].includes(parsed.protocol))throw new ApiError(403,'Nguồn yêu cầu không hợp lệ.');
    }
  }
  if (!token) throw new ApiError(401, 'Vui lòng đăng nhập.');
  let uid: string;
  let authAtMs: number;
  try { const verified=await serverAuth().verifyIdToken(token, true);uid=verified.uid;authAtMs=Number(verified.auth_time||0)*1000; }
  catch (error) {
    const failure = classifyTokenFailure(error);
    // Only diagnostic code is logged; never log token, secrets, or raw exception text.
    console.error('GU session verification failed:', failure.diagnostic);
    throw new ApiError(failure.status, failure.message);
  }
  const staff = await db().collection('staff').doc(uid).get();
  if (!staff.exists || staff.data()?.disabled === true) throw new ApiError(403, 'Tài khoản chưa được cấp quyền nhân viên.');
  const role = staff.data()?.role;
  // Historic staff_mobile documents are read as staff until an Admin migrates them.
  // Responsive layout depends on screen width, never on Firebase role.
  if(role!=='admin'&&role!=='staff'&&role!=='staff_mobile')throw new ApiError(403,'Quyền truy cập không hợp lệ.');
  const normalizedRole=(role==='admin'?'admin':'staff') as Role;
  let shift:ReturnType<typeof currentStaffAccess>|undefined;
  if(normalizedRole==='staff'){
    const monday=isoWeekMonday(vnDate(new Date()));
    const record=await db().collection('shiftWeeks').doc(monday).get();
    shift=currentStaffAccess(new Date(),uid,(record.exists?record.data():null) as ShiftWeekRecord|null);
    // Grace exists only for an ALREADY-authenticated worker finishing the shift.
    // A new Firebase login after shift end cannot enter the 15-minute grace.
    if(shift.grace&&(!shift.shiftEndedAt||!authAtMs||authAtMs>=Date.parse(shift.shiftEndedAt)))
      shift={...shift,canWork:false};
    // Optional migration cutover: do not lock out all existing employees mid-week.
    // Set GU_SHIFT_ENFORCE_FROM to the Monday AFTER first registration Sunday.
    const enforceFrom=process.env.GU_SHIFT_ENFORCE_FROM||'';
    if(/^\d{4}-\d{2}-\d{2}$/.test(enforceFrom) && enforceFrom>vnDate(new Date())){
      try{if(isoWeekMonday(enforceFrom)===enforceFrom)shift={...shift,canWork:true,grace:false,allowedUntil:null};}
      catch{/* Ignore malformed rollout date; enforce the normal shift policy. */}
    }
    if(!options?.allowSchedule&&!shift.canWork)throw new ApiError(403,'Ngoài ca làm việc đã đăng ký. Chỉ được truy cập quản lý trong ca và 15 phút sau khi kết thúc.',{code:'SHIFT_REQUIRED'});
  }
  return {uid,role:normalizedRole,name:String(staff.data()?.name??''),shift};
}
export function requirePcStaff(_me:{role:Role}){/* All staff now use the same PC/mobile-responsive workspace. */}
export function requireAdmin(me:{role:Role}){if(me.role!=='admin')throw new ApiError(403,'Chỉ Admin được duyệt và xóa đơn.');}
export function handleError(err: unknown, endpoint?: string) {
  if (err instanceof ApiError) return NextResponse.json({ error: err.message, details: err.details }, {status: err.status});
  if (err instanceof Error && /không hợp lệ|phải |tối đa|định dạng|Ngày |Thời gian thuê|Ngày đệm|VND hợp lệ|chưa cấu hình phí trễ|chưa xác định mẫu|Mẫu máy|serial|góc chụp|Góc chụp|Không được trùng góc|Chọn từ 1 đến 10 góc/.test(err.message))
    return NextResponse.json({ error: err.message }, {status:400});
  const incidentId=randomUUID().slice(0,8);
  const known=classifyServerFailure(err);
  console.error('[GU_SERVER_ERROR]',incidentId, endpoint ? {endpoint}: {}, err instanceof Error?{name:err.name,code:(err as Error&{code?:unknown}).code,message:err.message,stack:err.stack}:{type:typeof err});
  if(known)return NextResponse.json({error:known.message+' Mã đối chiếu: '+incidentId,code:known.code,incidentId,...(endpoint?{endpoint}:{})}, {status:known.status});
  return NextResponse.json({error:'Máy chủ không xử lý được yêu cầu. Mã lỗi: '+incidentId,code:'GU_SERVER_ERROR',incidentId}, {status:500});
}
export async function jsonBody(req: NextRequest): Promise<Record<string, unknown>> {
  const size = Number(req.headers.get('content-length') || '0');
  if (size > 32_000) throw new ApiError(413, 'Dữ liệu gửi lên quá lớn.');
  // Enforce the limit while reading, not just Content-Length (often absent).
  if (!req.body) throw new ApiError(400,'Thiếu dữ liệu JSON.');
  const reader=req.body.getReader();
  const chunks:Uint8Array[]=[];let total=0;
  try {
    while(true){
      const {done,value}=await reader.read();if(done)break;
      total+=value.byteLength;
      if(total>32_000)throw new ApiError(413,'Dữ liệu gửi lên quá lớn.');
      chunks.push(value);
    }
    const body:unknown=JSON.parse(new TextDecoder().decode(Buffer.concat(chunks)));
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Invalid JSON object');
    return body as Record<string,unknown>;
  }catch(e){
    if(e instanceof ApiError)throw e;
    throw new ApiError(400,'Dữ liệu JSON không hợp lệ.');
  }finally{reader.releaseLock();}
}
/** Hard-stop binary upload streams, including chunked requests with no Content-Length. */
export async function boundedUploadBytes(req:NextRequest,max=3*1024*1024):Promise<Buffer>{
 const size=Number(req.headers.get('content-length')||0);
 if(size>max)throw new ApiError(413,'Ảnh tối đa 3 MB.');
 if(!req.body)throw new ApiError(400,'Ảnh trống.');
 const reader=req.body.getReader();const chunks:Uint8Array[]=[];let total=0;
 try{
  while(true){
   const {done,value}=await reader.read();if(done)break;
   total+=value.byteLength;
   if(total>max){await reader.cancel().catch(()=>{});throw new ApiError(413,'Ảnh tối đa 3 MB.');}
   chunks.push(value);
  }
  return Buffer.concat(chunks);
 }finally{reader.releaseLock();}
}
