/** Convert Firebase auth failures into safe client-facing messages.
 * Never include token contents, service-account material or raw error messages in responses. */
export type TokenFailure = { status: number; message: string; diagnostic: string };

export function classifyTokenFailure(error: unknown): TokenFailure {
  const code = error && typeof error === 'object' && 'code' in error
    && typeof error.code === 'string' ? error.code : '';

  if (code === 'auth/id-token-expired' || code === 'auth/invalid-id-token' || code === 'auth/argument-error') {
    return { status: 401, message: 'Phiên đăng nhập hết hạn hoặc không hợp lệ. Vui lòng đăng xuất, đăng nhập lại.', diagnostic: code };
  }
  if (code === 'auth/id-token-revoked') {
    return { status: 401, message: 'Phiên đăng nhập đã bị thu hồi. Vui lòng đăng nhập lại.', diagnostic: code };
  }
  if (code === 'auth/user-disabled') {
    return { status: 403, message: 'Tài khoản Firebase đã bị vô hiệu hóa. Hãy liên hệ Admin.', diagnostic: code };
  }
  if (code === 'auth/user-not-found') {
    return { status: 401, message: 'Tài khoản không còn tồn tại trong Firebase Authentication. Hãy đăng nhập lại.', diagnostic: code };
  }
  if (code === 'auth/invalid-credential' || code === 'auth/insufficient-permission') {
    return { status: 503, message: 'Máy chủ không thể xác minh đăng nhập với Firebase. Kiểm tra Firebase Admin Service Account và quyền truy cập.', diagnostic: code };
  }
  return {
    status: 503,
    message: 'Máy chủ không thể kiểm tra phiên đăng nhập. Kiểm tra FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL và FIREBASE_PRIVATE_KEY trong Codespaces/Vercel.',
    diagnostic: code || 'firebase-admin-init-or-network',
  };
}
