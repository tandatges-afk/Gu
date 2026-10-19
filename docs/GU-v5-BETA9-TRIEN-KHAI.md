# Cài GU v5 Beta 9 trên Codespaces

1. Tải ZIP bản đầy đủ, giải nén ra `/tmp/gu-v5-beta9`, chép `src`, `public`, `tests`, `scripts`, `docs` vào repo và chép cấu hình nguồn. Không ghi đè `.env.local`.
2. Trên nhánh `test/gu-v5-beta9`: `nvm use 22 && npm install && npm run verify:release && npm test && npm run typecheck && npm run build`.
3. Kiểm tra từng vai trò Admin/nhân viên PC/Mobile trên Firebase staging, một đơn đầy đủ giao→nhận→Admin duyệt; thử hai lần đồng thời tạo `Áo dài xanh` và `Ao dai xanh`.
4. Rà tên dữ liệu cũ: `npm run data:index-names` (không viết dữ liệu). Nên sao lưu Firestore trước khi chuyển chỉ mục.
5. Để áp dụng chỉ mục ở đúng project Firebase trên Codespaces, tạm dừng thêm/sửa sản phẩm rồi chạy `node --experimental-strip-types --env-file=.env.local scripts/migrate-product-names.mjs --execute --confirm=INDEX-gugu-547e3`. Đổi ID cho đúng `FIREBASE_PROJECT_ID` nếu khác. Sau thành công có `INDEX_OK`.
6. Chương trình **không tự đổi tên cũ trùng**: đọc `DUPLICATE` từ `--plan` và đổi lần lượt qua Admin → Kho.
7. Commit **chỉ source** (không ZIP/.env/backup), merge vào `main`, xác nhận `npm run build` lại rồi `git push origin main` khi mọi luồng đã ổn định.

Lỗi `0ff171b8` không tự suy ra nguyên nhân. Vào Vercel → GU → Logs, tìm `[GU_SERVER_ERROR] 0ff171b8` (nếu log còn) và lấy thông báo gRPC gốc, đã che dữ liệu nhạy cảm. Lỗi gRPC 9 hiện được phân loại rõ hơn, nhưng không tuyên bố đã giải quyết nguyên nhân cũ khi chưa có log.
