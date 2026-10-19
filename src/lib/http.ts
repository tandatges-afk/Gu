import { NextRequest, NextResponse } from 'next/server';
import { db, serverAuth } from './firebase-admin';
import { Role } from './types';
import { classifyTokenFailure } from './auth-errors';
import { randomUUID } from 'node:crypto';
import {classifyServerFailure} from './server-error-classifier';
export class ApiError extends Error {
  constructor(public status: number, message: string, public details?: unknown) { super(message); }
}
export async function staffUser(req: NextRequest) {
  const token = req.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new ApiError(401, 'Vui lòng đăng nhập.');
  let uid: string;
  try { uid = (await serverAuth().verifyIdToken(token, true)).uid; }
  catch (error) {
    const failure = classifyTokenFailure(error);
    // Only diagnostic code is logged; never log token, secrets, or raw exception text.
    console.error('GU Firebase token verification failed:', failure.diagnostic);
    throw new ApiError(failure.status, failure.message);
  }
  const staff = await db().collection('staff').doc(uid).get();
  if (!staff.exists || staff.data()?.disabled === true) throw new ApiError(403, 'Tài khoản chưa được cấp quyền nhân viên.');
  const role = staff.data()?.role;
  if (role !== 'admin' && role !== 'staff' && role !== 'staff_mobile') throw new ApiError(403, 'Quyền truy cập không hợp lệ.');
  if(role==='staff_mobile'){
    const path=req.nextUrl.pathname;
    const allowed=path.startsWith('/api/v5/') || (path==='/api/uploads'&&req.method==='POST');
    if(!allowed)throw new ApiError(403,'Tài khoản Mobile chỉ được tìm ảnh và kiểm nhận bằng ảnh.');
  }
  return { uid, role: role as Role, name: String(staff.data()?.name ?? '') };
}
export function requirePcStaff(me:{role:Role}){if(me.role==='staff_mobile')throw new ApiError(403,'Tài khoản nhân viên mobile chỉ được tìm ảnh và chụp ảnh giao/nhận.');}
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
  try {
    const body: unknown = await req.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
    return body as Record<string, unknown>;
  } catch { throw new ApiError(400, 'Dữ liệu JSON không hợp lệ.'); }
}
