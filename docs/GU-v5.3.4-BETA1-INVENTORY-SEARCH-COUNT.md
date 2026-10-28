# GU v5.3.4 beta.1 — Sửa tìm mã và thống kê kho

## Vấn đề

1. Nhập `00` vào bộ lọc sản phẩm làm phát sinh lỗi do mã nguồn cũ dùng `Number('00') === 0`, sau đó gọi `formatHangerCode(0)`. Mã tìm kiếm không phải mã cấp phát, không được chuyển thành số.
2. Thống kê kho `AVAILABLE` dùng Firestore count tính cả mặt hàng đã `archivedAt`; bảng danh sách lại ẩn chúng, tạo số liệu không khớp.
3. Lỗi toàn trang không xóa khi nhập truy vấn mới đã hợp lệ.

## Cách sửa

- Bộ lọc mã so khớp ký tự trong mã dạng `GU-00002`; hỗ trợ `0`, `00`, `00002`, `234`, `GU-00002`. API đọc từng trang `hangerCode` có cursor, không sửa mã hàng và không ghi Firebase.
- Dashboard trừ mặt hàng `archivedAt` khỏi tổng và từng trạng thái. API catalog cũng không tính các mặt hàng đã lưu trữ vào kết quả của trang.
- Khi sửa từ khóa tìm kiếm, xóa lỗi trước đó; khi API đáp ứng thành công cũng xóa lỗi cũ.
- Con số thống kê là số sản phẩm *chưa lưu trữ trong toàn kho*, còn “kết quả đang hiển thị” là số khớp trên trang lọc hiện tại.

## Xác minh

1. Đăng nhập Admin → Kho sản phẩm → xóa tìm kiếm. So sánh số “Sẵn sàng” và số món đang hiển thị khi lọc `Sẵn sàng` (chú ý có thể có phân trang).
2. Tìm lần lượt `00`, `00002`, `2`, `234`, `GU-00002` và tên sản phẩm không dấu.
3. Tìm `00` sau đó nhập `GU-00002`: lỗi cũ không được phép còn hiện.
4. Kiểm tra món đã **Lưu trữ** không xuất hiện trong danh sách mặc định và không được tính trong số món sẵn sàng.
5. Kiểm thử lại tìm mã trong trang Đặt lịch và Tạo đơn để chắc chắn không lẫn tên/SĐT khách.

Không cần migration Firebase hay thay đổi biến môi trường. Lưu ý tìm mã theo đoạn bất kỳ có thể phải quét nhiều trang khi kho quá lớn; muốn tối ưu hàng chục nghìn mã cần bổ sung search index và migration có kiểm soát.

## Trước khi triển khai

```bash
npm install
npm run verify:imports
npm run verify:release
npm test
npm run typecheck
npm run build
```

Test logic/structure và typecheck/build là các mức xác minh khác nhau; chỉ đưa lên production khi typecheck/build và kiểm thử Firebase staging đều thành công.
