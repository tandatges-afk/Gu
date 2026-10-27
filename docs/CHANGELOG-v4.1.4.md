# GU v4.1.4 — Nhân viên tạo lịch · Mã sản phẩm · Bỏ gợi ý

## Thay đổi
1. Đơn mới ghi nhận UID và họ tên nhân viên từ phiên đăng nhập đã xác thực. Không thể truyền tên tùy ý từ client. Tên snapshot ổn định khi nhân viên đổi tên.
2. Lịch thuê (desktop, mobile) ghi người tạo ngay dưới tên khách. Tooltip và chi tiết đơn có tên đầy đủ. Admin có lọc nhân viên tạo. Trang đơn thuê và CSV cho biết người tạo.
3. Đơn cũ không bị viết lại: GUI tra từ `staff` nếu còn hồ sơ; nếu thiếu thì nói rõ chưa xác định. Admin mở đơn công nợ lịch sử vẫn có lookup tương ứng.
4. Mã GU-xxxxx được gọi là **Mã sản phẩm** ở tất cả nơi sử dụng. `hangerCode` vẫn giữ trong DB vì tương thích dữ liệu cũ; không nhập mã bằng tay, không cấp lại.
5. Gỡ đoạn gợi ý ở Lịch, form tạo đơn, phần nhận trả, form ảnh, khung `gu-smart-hint`, sidebar quảng bá; giữ các cảnh báo kiểm tra/thu tiền thiết yếu.
6. Cache PWA đã tăng version.

## Giới hạn
- Lịch trên dashboard hiện dựa vào tối đa 300 đơn gần nhất, theo thiết kế API hiện có.
- Tên người tạo cho đơn rất cũ có thể không còn truy xuất được nếu hồ sơ nhân viên bị xóa; không nên tự động gán tên khác.
- Để chạy `next build` cần có dependencies hợp lệ trong Codespaces.

## Cài đặt
Áp dụng **bản vá** nếu nhánh hiện hành chứa đầy đủ GU v4.1.3. Hoặc dùng **full** trong nhánh mới. Không chạy thay thế dữ liệu Firebase.

Kiểm tra: `npm run verify:release`, `npm run test`, `npm run typecheck`, `npm run build`.
