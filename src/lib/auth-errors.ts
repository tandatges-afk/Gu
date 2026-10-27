/** Convert Firebase auth failures into safe client-facing messages.
 * Never include token contents, service-account material or raw error messages in responses. */
export type TokenFailure = { status: number; message: string; diagnostic: string };

export function classifyTokenFailure(error: unknown): TokenFailure {
  const code = error && typeof error === 'object' && 'code' in error
    && typeof error.code === 'string' ? error.code : '';

  const localMessage = error instanceof Error ? error.message : '';
  if (localMessage === 'Invalid session' || localMessage === 'Session expired') {
    return { status: 401, message: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', diagnostic: 'gu-local-session-expired' };
  }
  if (localMessage === 'User disabled') {
    return { status: 403, message: 'Tài khoản GU đã bị vô hiệu hóa. Hãy liên hệ Admin.', diagnostic: 'gu-local-account-disabled' };
  }
  if (code === 'auth/id-token-expired' || code === 'auth/invalid-id-token' || code === 'auth/argument-error') {
    return { status: 401, message: 'Phiên đăng nhập hết hạn hoặc không hợp lệ. Vui lòng đăng xuất, đăng nhập lại.', diagnostic: code };
  }
  if (code === 'auth/id-token-revoked') {
    return { status: 401, message: 'Phiên đăng nhập đã bị thu hồi. Vui lòng đăng nhập lại.', diagnostic: code };
  }
  if (code === 'auth/user-disabled') {
    return { status: 403, message: 'Tài khoản GU đã bị vô hiệu hóa. Hãy liên hệ Admin.', diagnostic: code };
  }
  if (code === 'auth/user-not-found') {
    return { status: 401, message: 'Tài khoản không còn tồn tại trong hệ thống GU. Hãy đăng nhập lại.', diagnostic: code };
  }
  if (code === 'auth/invalid-credential' || code === 'auth/insufficient-permission') {
    return { status: 503, message: 'Máy chủ không thể xác minh phiên đăng nhập GU trên VPS. Kiểm tra PostgreSQL và tài khoản.', diagnostic: code };
  }
  return {
    status: 503,
    message: 'Máy chủ không thể kiểm tra phiên đăng nhập GU. Vui lòng đăng nhập lại; nếu vẫn lỗi, kiểm tra log trên VPS.',
    diagnostic: code || 'gu-local-session-or-db',
  };
}
