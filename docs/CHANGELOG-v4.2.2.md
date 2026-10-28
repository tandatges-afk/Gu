# GU v4.2.2 — Chẩn đoán Firestore Monitoring

- Vercel Admin → Hệ thống: phân biệt lỗi Cloud Monitoring theo mã trả về từ Google (`SERVICE_DISABLED`, `IAM_PERMISSION_DENIED`, `ACCESS_TOKEN_SCOPE_INSUFFICIENT`...). Không khẳng định lỗi 403 luôn do thiếu Monitoring Viewer.
- Bổ sung `view=FULL` theo yêu cầu API `projects.timeSeries.list`.
- Nút **Cập nhật** gửi `?refresh=1` để bỏ qua bộ đệm 5 phút; endpoint vẫn yêu cầu đăng nhập vai trò Admin.
- Chỉ trả thông báo lỗi đã kiểm soát, không đưa access token, private key hoặc raw Google response lên trình duyệt.
- Không thay đổi Firestore schema, đơn hàng hay ảnh Cloudinary.

## Kiểm tra trước triển khai

`npm run verify:release && npm run test && npm run typecheck && npm run build`

## Xử lý tiếp nếu còn lỗi 403

1. Google Cloud Console → APIs & Services → Enabled APIs: xác nhận Cloud Monitoring API ở project `gugu-547e3`.
2. IAM đã cấp Monitoring Viewer cho cùng `FIREBASE_CLIENT_EMAIL` mà Vercel Production sử dụng.
3. Vào GU Admin → Hệ thống → Cập nhật; đọc mã lỗi mới xuất hiện.
4. Đừng đưa biến môi trường bí mật hoặc HTTP Authorization header vào ảnh/log chia sẻ.
