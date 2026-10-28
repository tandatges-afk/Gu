# GU Rev7.6 — Giao diện tinh gọn, hỗ trợ nhập kho nhanh

## Những thay đổi đã thực hiện

- Kho sản phẩm: thay hai nút thêm sản phẩm lặp nhau bằng **hai tab đơn giản**: Danh sách kho / Thêm nhiều sản phẩm. Người dùng có thể lưu một hoặc nhiều sản phẩm trong cùng màn hình.
- Nhập kho: thông tin bắt buộc hiển thị ngay theo từng thẻ món, không nằm trong dropdown bị ẩn; không còn bảng ngang phải cuộn khi màn hình nhỏ.
- Nhập kho: hiển thị số món đủ thông tin; có nút chọn góc chụp nhanh; nút **Nhân bản thiết lập** sao chép danh mục, màu, phí đền bù và góc chụp sang một món mới (không sao chép tên, ảnh, mã/serial) để giảm nhập lại.
- Tên trùng: vẫn kiểm tra trong phiên nhập, danh sách hiện có và qua API toàn kho; server vẫn chịu trách nhiệm kiểm tra lại và lưu giao dịch đồng bộ.
- Form: không hiện lỗi thiếu tên ngay khi vừa mở; hiển thị lỗi cần thiết sau khi bấm lưu, với lỗi trùng tên hiển thị tức thời.
- Toàn bộ trang: lớp stylesheet `src/app/gu-redesign.css` thống nhất thiết kế ở sidebar, topbar, dashboard, bảng danh sách, nút bấm, tìm kiếm, lọc, dialog, giao diện mobile; dùng nhãn tiếng Việt tại các đầu trang vận hành.
- Không thay đổi API, database, PostgreSQL, tiền thuê, trạng thái đơn hàng, quy trình trả đồ và GitHub Actions.

## Cấu trúc thay đổi

- `src/components/GuBulkInventory.tsx` — giao diện và cách nhập liệu.
- `src/components/GuBulkInventory.module.css` — thiết kế riêng nhập kho hàng loạt, responsive.
- `src/app/page.tsx` — tab kho gọn lại, thống nhất một số nhãn.
- `src/app/layout.tsx` — nạp lớp CSS tổng thể.
- `src/app/gu-redesign.css` — bộ visual design thống nhất.
- `tests/fix20-bulk-inventory.test.ts` — regression test cho thiết kế mới.
- Hai SHA-256 manifest được đồng bộ với toàn bộ nguồn sửa.

## Quy trình an toàn

Đây là bản **UI-only** được xây trên Rev7.5. Không cài đè `/var/www/.../current`, không thay `.env`, không chạy migration database. Trước khi push main cần chạy `npm ci`, `npm run verify:release`, `npm run typecheck`, `npm test`, `npm run test:vps`, `npm run build` trên máy Windows. GitHub Actions chỉ deploy khi CI đạt và backup Production đạt.

Điểm cần nghiệm thu thủ công sau deploy: desktop và mobile; nhập nhiều sản phẩm và chống trùng tên, upload ảnh, tạo đơn/nhận/trả, lịch thuê, thanh toán, phân quyền nhân viên và thông báo trạng thái.
