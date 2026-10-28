# GU 5.4.6 VPS Fast — bộ mã nguồn đầy đủ, đã ghép Fix 1–5

Đây là **bản mã nguồn đầy đủ**, KHÔNG phải ZIP chỉ chứa patch. Bao gồm giao diện, API, PostgreSQL adapter, xác thực nội bộ, upload VPS, tests, workflow GitHub Actions và các công cụ deploy. Mã nguồn được tổng hợp từ bản GU V5.4.6 RC1 và các bản vá trong cuộc trò chuyện; **không phải bản dump trực tiếp của VPS / GitHub ở thời điểm tải**.

## Đã tích hợp

- Fix 1: upload qua API VPS, gộp danh sách đơn thuê, chia riêng lịch máy ảnh / lịch trang phục phụ kiện, gỡ nút lập/làm mới chỉ mục ảnh và độ rộng tìm kiếm.
- Fix 2: API `src/app/api/uploads/route.ts` có mặt, `.gitignore` không còn vô tình bỏ qua route này.
- Fix 3: công cụ `scripts/repair-product-name-index.mjs`; dọn thông báo Firebase/Vercel cũ; ảnh kiểm nhận trên VPS.
- Hotfix 4: công nợ, tìm khách theo chuỗi con tên/SĐT, tìm sản phẩm theo tên/mã, ảnh bìa local, nạp danh mục tìm ảnh, giao diện chọn ngày.
- Fix 5: bàn giao/nhận đồ kiểm tra ảnh VPS theo đúng tài khoản, đơn thuê, giai đoạn và bản ghi `proofUploads`, không còn bắt buộc host Cloudinary trong `readProof`.

## Cách cập nhật từ Windows

1. Sao lưu repo và bảo đảm đã `git commit` hoặc stash những thay đổi đang làm; **không chép đè lên một working tree đang sửa dở**.
2. Giải nén ZIP vào `Downloads`. Mở PowerShell và chạy:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
& "$env:USERPROFILE\Downloads\GU_V5_546_FULL_LATEST_FIX5\windows\apply-full-source.ps1"
```

Script mặc định cập nhật `C:\Users\Admin\Desktop\GU-V5-MAIN-READY`. Script sẽ dừng nếu Git còn thay đổi chưa commit và tạo nhánh backup trỏ vào commit trước khi sao chép. Nó KHÔNG tự push hoặc deploy.

3. Chạy trong repo:

```powershell
npm install --package-lock-only --no-audit --no-fund
npm ci
npm run verify:imports
npm run typecheck
npm test
npm run build
```

4. Chỉ khi tất cả đều đạt, xem `git diff`, `git status`, `git diff --cached --name-only`, rồi commit và push `main` theo quy trình của bạn. Nếu Actions tự deploy production từ `main`, bảo đảm đã chuẩn bị rollback và thử staging trước.

## Ghi chú quan trọng

- **Chưa kèm `package-lock.json`:** môi trường đóng gói không thể truy cập npm registry để tạo lockfile đúng với dependencies V5. Cần tạo lockfile bằng lệnh ở trên (hoặc sử dụng lockfile hiện đang hoạt động của repo rồi chạy `npm install --package-lock-only`) trước khi push; workflow CI yêu cầu file này.
- Không kèm `.env.local`, `/etc/gu-v546/{stage,prod}.env`, dữ liệu PostgreSQL, uploads của khách, private keys, hoặc `node_modules`.
- Bản đóng gói đã đạt **235/235** bài test, **15/15** test VPS, kiểm tra import và `use client`. Chưa chạy được TypeScript full và Next.js build ở môi trường đóng gói vì chưa cài dependencies.
- Trước khi thay production: sao lưu PostgreSQL và ảnh, kiểm tra `https://guthuedo.io.vn/api/version` sau deploy, thử upload/handover thực tế.
- V5 production có thể đã có dữ liệu phát sinh sau khi bạn chuyển domain: **không xóa database** `gu_v546_prod`, không dùng ZIP để thay dữ liệu thật, và đừng ghi đè file cấu hình bí mật.
