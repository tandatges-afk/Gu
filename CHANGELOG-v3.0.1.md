# GU v3.0.1 — Mobile Calendar & Square Images

## Sửa lỗi

- **Lịch thuê trên mobile**: không hiển thị bảng 890px với cột sản phẩm sticky nữa. Thay bằng danh sách thẻ sản phẩm, mỗi thẻ có dãy 7 ô ngày vuông có thể vuốt ngang. Chọn ngày vẫn dùng đúng logic chống trùng và trạng thái thuê, không thay đổi dữ liệu.
- **Ảnh sản phẩm**: khung ảnh tại kho, lịch, đơn thuê và thư viện ảnh được chuẩn hóa thành tỷ lệ **1:1**. `object-fit: contain` giữ nguyên toàn bộ hình ảnh, không cắt mất trang phục.
- **Trang chủ**: bỏ cặp nút Giao ngay/Đặt trước lặp lại bên dưới bảng công việc. Giữ một cặp ở đầu trang và đổi phím tắt Tạo đơn mới thành Quản lý đơn thuê.
- **PWA**: cập nhật tên static cache để bản sửa mới nhận diện sau khi deploy.

## Giữ nguyên

Firebase Project hiện hành, Cloudinary, tài khoản, quyền, đơn đặt lịch trước, giao ngay, ngày thuê, giặt, trả trễ, phụ thu, đền bù, logs.

## Kiểm thử

- `npm run test`: 34/34 đạt.
- Kiểm tra cú pháp độc lập 42 tệp TS/TSX và CSS: đạt.
- Chưa xác minh `npm run typecheck` / `npm run build` hoàn chỉnh vì môi trường đóng gói không tải được npm dependencies. Chạy hai lệnh này trên GitHub Codespaces **trước khi merge production**.

## Cập nhật từ bản GU v3.0 đang chạy

1. Trên Codespaces, lưu thay đổi và tạo nhánh `gu-v3.0.1-mobile-fix`.
2. Upload `GU-v3.0.1-Mobile-Calendar-Patch.zip` vào root repository, giải nén vào `/tmp/gu-mobile-fix`, sau đó `cp -a /tmp/gu-mobile-fix/. .`.
3. `npm install && npm run test && npm run typecheck && npm run build`.
4. `npm run dev`, dùng Port 3000 để kiểm tra trang chủ và lịch trên DevTools mobile hoặc điện thoại. Thử ảnh dọc, ngang, vuông; chọn từng ngày trên lịch.
5. Commit và push nhánh, kiểm tra Vercel Preview rồi mới merge vào `main`.

**Không upload file `.env.local` và Service Account JSON lên GitHub.**
