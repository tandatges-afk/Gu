# GU v5.4.0 Beta 1 — Tinh gọn giao diện, kiểm tra Storage trên Vercel

- Đã ẩn các đoạn giới thiệu/hint trùng lặp tại form thuê đồ/máy ảnh, lịch, trang đơn, màn hình tìm ảnh và vài khu vực phụ. **Giữ nguyên** tên chức năng, giá, hướng dẫn xác nhận tiền, cảnh báo, lỗi nhập liệu, tên gói máy ảnh, lịch và thông tin cần thiết cho vận hành.
- Xóa câu “Tìm máy ảnh theo tên, mã hoặc serial” nhưng ô tìm sản phẩm vẫn hoạt động và có nhãn truy cập `aria-label`.
- Sửa phân loại HTTP 404: thiếu file chứng từ khác với thiếu bucket. Lỗi upload 404 không có thông tin bucket trả thông báo kiểm tra đích lưu trữ, không khẳng định bucket chưa tạo.
- Thêm trang **Hệ thống (Admin) → Firebase Storage · Ảnh cọc**: `Kiểm tra bucket` (chỉ đọc metadata) và `Thử ghi / xóa` (tạo tệp thử nhỏ và xóa ngay sau). API sử dụng thông tin Firebase Admin thực tế của **deployment đang chạy**; không lộ khóa riêng, ảnh hay object ID.

## Nếu Vercel đã có FIREBASE_STORAGE_BUCKET nhưng vẫn lỗi

1. Firebase Console → **gugu-547e3 → Storage → Files**: chỉ đọc **tên bucket thực tế** sau khi đã tạo bucket. Nhập tên, không phải một đường dẫn `gs://`.
2. Firebase Storage yêu cầu dự án gói **Blaze**, có thể dùng trong hạn mức miễn phí. Cài cảnh báo ngân sách.
3. Vercel Settings → Environment Variables: xác nhận đủ `FIREBASE_STORAGE_BUCKET`, `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` trên **Production/Preview** đang dùng, và deploy lại sau khi sửa. Project ID cần đúng Firebase dự án; service account phải có quyền thao tác trên bucket này.
4. Đăng nhập Admin của website đã deploy → **Hệ thống → Kiểm tra bucket**. Nếu metadata 403, quyền `storage.buckets.get` có thể thiếu dù quyền ghi object đủ; dùng **Thử ghi / xóa** để kiểm tra quyền ghi thực tế.
5. `Thử ghi / xóa` cần quyền `storage.objects.create`, `storage.objects.delete`. Mục tiêu là tài khoản dịch vụ chỉ được cấp đúng quyền cần thiết trên bucket, không đặt bucket hoặc Rules thành public. Nếu lưu ảnh vẫn lỗi, xem Vercel Runtime Logs của lần POST `/api/v5/secure-photo` tương ứng.

## QA

```bash
npm run verify:release
npm test
npm run typecheck
npm run build
```

Chưa có bằng chứng môi trường Vercel đã có bucket hay đã bật Blaze chỉ từ giá trị biến. Không thực hiện thay đổi nào trên Firebase hoặc Vercel khi giải nén ZIP này.
