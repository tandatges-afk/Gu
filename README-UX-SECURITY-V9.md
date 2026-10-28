# GU V5 — Premium UX/UI & Privacy Hardening V9

Nền mã nguồn: **GU V5.4.6 Fix 8**. Đây là một bản cập nhật giao diện và bảo vệ dữ liệu, **không phải một hệ thống mới**. Các quy tắc đặt lịch, thu phí, cọc tiền/CCCD, máy ảnh và thời hạn xóa chứng từ của Fix 8 được giữ nguyên.

## Những phần đã thực hiện

- Một lớp giao diện đồng bộ `src/app/gu-premium.css` được tải **sau** CSS legacy, phủ toàn bộ shell, menu, dashboard, bảng, lọc, lịch, biểu mẫu, nhập kho, modal giao–nhận, trang quản trị hệ thống và đăng nhập.
- Màu nền sáng dễ đọc, chữ xanh đen rõ nét, nhấn xanh dầu/trầm và đồng ấm; **giữ màu cảnh báo riêng** cho quá hạn, đã lấy, giữ chỗ, đang giặt, sẵn sàng.
- Giao diện linh hoạt theo điện thoại/tablet/desktop; vùng bấm rộng, focus rõ nét, hỗ trợ giảm chuyển động, trang chính có link bỏ qua menu; nhấn Escape đóng menu/modal khi không đang xử lý dữ liệu.
- Nhãn email/mật khẩu gắn với input, nút hiện/ẩn mật khẩu và thông báo lỗi truy cập được.
- Bỏ tải font Google ở trang GU nội bộ nhằm giảm kết nối ra bên thứ ba.
- Bảo vệ thêm thao tác thay đổi dữ liệu: kiểm tra `Origin`/`Sec-Fetch-Site` trên API nhân viên và đăng nhập/đăng xuất; vẫn kiểm tra session, quyền và ca làm hiện có.
- Chỉ Admin thấy nút xuất CSV đơn hàng; ký tự có thể tạo công thức độc hại khi mở Excel/Sheets được xử lý an toàn.
- Đánh dấu ứng dụng quản trị không được lập chỉ mục; thêm một số HTTP security headers, cache-control `no-store` cho HTML trang chính và API.

## Không thay đổi

- **Không** động vào PostgreSQL, migration dữ liệu, tài khoản, mật khẩu, giá/cọc hoặc ảnh người dùng.
- **Không** tắt kiểm tra quyền xem ảnh CCCD/chứng từ.
- **Không** xóa Cloudinary URL fallback cho **ảnh sản phẩm cũ** khi chưa chuyển hết ảnh lịch sử về VPS; bảo mật nhạy cảm vẫn phụ thuộc xác thực API riêng. Cần kiểm tra các URL ảnh lịch sử nếu muốn dỡ toàn bộ phụ thuộc bên thứ ba.
- Không thêm CSP `script-src` nghiêm ngặt một cách mù quáng: Next.js dùng hydration scripts; thiết lập CSP nonce và kiểm thử browser là công việc riêng trước khi bật chế độ chặn toàn diện.

## Áp dụng trên Windows

1. Giải nén `GU_V5_546_PREMIUM_UX_SECURITY_V9_FULL.zip` vào `%USERPROFILE%\Downloads`.
2. Chạy PowerShell:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
& "$env:USERPROFILE\Downloads\GU_V5_546_PREMIUM_UX_SECURITY_V9_FULL\update\apply-v9.ps1" -Target "$env:USERPROFILE\Desktop\GU-V5-MAIN-READY"
```

Script bắt buộc repo **sạch**, nhánh `main`, đúng repo `tandatges-afk/Gu`, và file gốc khớp **Fix 8**. Script tạo nhánh backup, chỉ cập nhật file trong manifest và không tự commit/push. Nếu dừng do mismatch, **không force copy toàn bộ source**: kiểm tra chính xác commit repo và gửi log.

3. Tại repo:

```powershell
npm ci
npm run typecheck
npm test
npm run build
git status -sb
git add -A
git diff --cached --check
git diff --cached --name-only
```

Chỉ commit sau khi mọi lệnh đạt, danh sách staged không có `.env`, mật khẩu, ảnh khách hoặc file DB. Nếu lần cài mới chưa có `package-lock.json`, chạy `npm install --package-lock-only` trước `npm ci`; **không ghi đè lockfile đang hoạt động chỉ để đổi giao diện**.

## Triển khai VPS an toàn

1. Kiểm tra GitHub Actions **Validate** và triển khai `stage` (cổng 3301) trên `v5.guthuedo.io.vn` trước.
2. Test ít nhất: đăng nhập Admin/nhân viên, đăng ký ca, lịch trang phục và lịch máy ảnh, tạo/nhận/trả đơn, hoàn cọc/CCCD, hình ảnh, công nợ, tìm khách/sản phẩm, mobile Chrome và Safari.
3. Sao lưu `gu_v546_prod` và thư mục upload trước khi triển khai `prod` (cổng 3302).
4. Xác nhận commit đang chạy bằng `curl -fsS https://guthuedo.io.vn/api/version`. Không cần chỉnh lại Nginx nếu production đã trỏ cổng 3302.
5. Kiểm tra chính sách xóa ảnh CCCD sau 5 ngày **thực sự** chạy theo timer; các bản sao lưu cũng cần lịch lưu/xóa phù hợp.

## Bảo mật cần kiểm tra trên VPS thực tế

- HTTPS, cookie `Secure/HttpOnly/SameSite`, SSH key, tường lửa, chỉ các cổng 80/443 công khai; PostgreSQL và Next production phải chỉ nghe địa chỉ cục bộ.
- `GU_SESSION_SECRET` và `CRON_SECRET` đủ mạnh, không có trong git; file `/etc/gu-v546/prod.env` quyền root/guapp `640`.
- Admin quản lý quyền, dữ liệu ảnh chứng từ nhạy cảm, backup và lịch xóa; thử `npm audit --omit=dev` từ lockfile hiện hành.
- Đăng nhập/đăng xuất, CSRF, upload file, đối soát tài chính, quyền xem chứng từ và thời gian lưu trữ cần kiểm thử **thực tế**. Test mã nguồn không thay thế được rà soát an ninh/kiểm thử xâm nhập.

## Kiểm tra đã thực hiện khi đóng gói

- 261/261 Node tests, gồm 6 test mới về UX và bảo vệ dữ liệu.
- Kiểm tra đường dẫn import, `use client`, cú pháp TypeScript và parse CSS thành công.
- **Chưa xác nhận** `npm ci`, `npm run typecheck`, `npm run build` hoàn chỉnh trong môi trường đóng gói vì thiếu `node_modules`/npm registry; phải chạy ở máy Windows và Actions.
