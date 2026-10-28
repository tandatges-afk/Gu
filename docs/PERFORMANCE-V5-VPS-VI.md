# GU 5.4.6 VPS Fast · kết hợp V5.0 Beta 10 + V5.4.6

**Phiên bản:** `5.4.6-vps.1-beta.2` (bản staging, chưa nghiệm thu production).

## Nguồn và thay đổi

- Nền UI/đặt đơn/chụp ảnh/công nợ/ca làm từ GU 5.4.6 Beta 1 do chủ cửa hàng cung cấp. Không quay lại UI đơn giản của GU 6.1.
- GU 5.0 Beta 10 có danh sách phân trang theo cursor, giới hạn số lượng trả về và lựa chọn truy vấn chỉ mục đơn trường nhằm giảm đọc Firestore. GU 5.4.6 vốn đã kế thừa nhiều nguyên tắc này. Tối ưu mới được thực hiện **trong lớp PostgreSQL** thay vì sao chép code Firebase trở lại.
- `src/lib/pg-query-compiler.ts`: trường JSONB biểu diễn bằng SQL cố định, các giá trị vẫn dùng bind parameters (`$1`, `$2`), cho phép PostgreSQL dùng chỉ mục btree theo biểu thức; phân trang theo `(giá trị, id)` để không bỏ bản ghi trùng tên.
- `src/lib/pg-firestore.ts`: `getAll` gom ID theo collection thành 1 truy vấn cho mỗi collection, giảm hàng trăm round-trip của lịch 7 ngày/30 sản phẩm. `count()` chạy `COUNT(*)` tại PostgreSQL, không tải JSON của từng đơn và sản phẩm.
- `src/lib/pg-dashboard-counts.ts`: các thống kê trạng thái và tồn kho chỉ đếm sản phẩm chưa lưu trữ (`archivedAt` rỗng/thiếu). Các bộ đếm chạy ở SQL thay vì đọc kho về Node.js.
- `scripts/optimize-postgresql.mjs`: bộ chỉ mục cho trạng thái, ngày nhận/trả, mã móc, tên, số điện thoại, đơn gần đây, mã đơn, trường tìm kiếm và GIN `nameSearchBigrams`. Có `CREATE INDEX CONCURRENTLY` để giảm chặn ghi khi nâng cấp DB (vẫn cần cân nhắc tài nguyên và backup).
- `scripts/benchmark-postgresql.mjs`: đo p50/p95 25 lần trên DB staging, **không giả định trước thời gian phản hồi**. Không in tên khách hoặc dữ liệu đơn.
- `scripts/check-staging-env.mjs`: kiểm tra staging dùng tên miền, thư mục ảnh và database riêng. `db:init`/`db:admin` ngăn vô ý dùng database khác nếu không có override có chủ đích.

## Kiểm thử đã thực hiện khi tạo ZIP

- Bộ test nghiệp vụ còn phù hợp với bản chuyển khỏi Firebase: 221/221 trước kiểm tra staging mới; chạy lại `npm test` sau bản cuối.
- Test VPS/query/cursor/auth/magic bytes/staging DB bảo vệ: `npm run test:vps`.
- Imports và client directives: `npm run verify:release`.
- Kiểm tra cú pháp TypeScript của module thay đổi qua `typescript.transpileModule`.
- **Chưa** đo benchmark trên VPS thật, chưa chạy PostgreSQL integration, chưa chạy `npm run typecheck` và `npm run build` Next.js với dependencies thực tế. ZIP gốc không chứa `package-lock.json` và môi trường đóng gói không có npm registry; `npm install` trên VPS sẽ tạo lockfile.
- **Chưa** xuất/nhập dữ liệu Firestore và Cloudinary cũ. Tài khoản Firebase không thể chuyển mật khẩu thô; cần tạo tài khoản và xác minh quyền trên bản mới.

## Staging là bắt buộc

1. Giữ `https://guthuedo.io.vn` (GU 6.1) và GitHub `main` hiện tại nguyên trạng. Đừng chạy script deploy main với ZIP thử nghiệm.
2. Sử dụng database PostgreSQL **khác**: `gu_v546_stage`, không phải `gu_db`; thư mục ảnh `/var/lib/gu-v546/uploads`, site thử nghiệm `https://v5.guthuedo.io.vn`, cổng nội bộ `3301`.
3. Cài deps và tạo `package-lock.json` trên VPS. Chạy `npm run stage:check`, `npm run db:init`, `npm run db:optimize`, `npm run db:check`, `npm run db:bench`, `npm run test:vps`, `npm test`, `npm run typecheck`, `npm run build`.
4. Test hai nhân viên đặt cùng sản phẩm đồng thời; các trạng thái đặt trước, thuê ngay, lấy, trả, giặt; camera 3h/6h; phụ thu, công nợ, hình ảnh và quyền nhân viên.
5. Đo p50/p95 của màn hình danh sách kho, mở lịch, tìm số điện thoại trên dữ liệu mô phỏng ~2.000 đồ và lượng đơn dự kiến nhiều năm. So sánh trực tiếp với GU 5.0 chỉ có ý nghĩa khi môi trường/dữ liệu/kết nối được kiểm soát.
6. Sau nghiệm thu, mới lên kế hoạch đưa code V5 lên GitHub `main`, backup DB, kiểm thử migration và chuyển proxy production. Có phương án rollback rõ ràng.

## Lệnh nhanh trên VPS staging

```bash
# Sử dụng user guapp, sau khi đã cấu hình .env.local và tạo gu_v546_stage:
cd /var/www/gu-v546
runuser -u guapp -- npm install
runuser -u guapp -- npm run stage:check
runuser -u guapp -- npm run db:init
runuser -u guapp -- npm run db:optimize
runuser -u guapp -- npm run db:check
runuser -u guapp -- npm run db:bench
runuser -u guapp -- npm run verify:release
runuser -u guapp -- npm run test:vps
runuser -u guapp -- npm test
runuser -u guapp -- npm run typecheck
runuser -u guapp -- npm run build
```

## Điều kiện dừng triển khai

Nếu build lỗi, test truy vấn/đồng thời sai, số tiền sai, rò dữ liệu ảnh riêng tư, backup chưa khôi phục được hoặc chưa đủ dữ liệu từ Firebase: **không đổi proxy Nginx của guthuedo.io.vn**. Giữ GU 6.1 cũ đang chạy để tiếp tục cửa hàng.
