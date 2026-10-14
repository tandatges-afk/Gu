import { NextRequest, NextResponse } from 'next/server';
import { db, serverAuth } from './firebase-admin';
import { Role } from './types';
import { classifyTokenFailure } from './auth-errors';
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
  if (role !== 'admin' && role !== 'staff') throw new ApiError(403, 'Quyền truy cập không hợp lệ.');
  return { uid, role: role as Role, name: String(staff.data()?.name ?? '') };
}
export function handleError(err: unknown) {
  if (err instanceof ApiError) return NextResponse.json({ error: err.message, details: err.details }, {status: err.status});
  if (err instanceof Error && /không hợp lệ|phải |tối đa|định dạng|Ngày |Thời gian thuê|Ngày đệm|VND hợp lệ/.test(err.message))
    return NextResponse.json({ error: err.message }, {status:400});
  console.error('API failure', err);
  return NextResponse.json({error:'Có lỗi hệ thống. Vui lòng thử lại hoặc kiểm tra cấu hình Firebase.'}, {status:500});
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
