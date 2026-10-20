# GU v5.3.3 Beta 1 — Tab Cache, 24h time, settlement validation

## Thay đổi

- Tối ưu chuyển tab: cache **bộ nhớ trong một phiên** cho danh sách kho / khách / đơn / lịch / giặt / báo cáo / công nợ / việc hôm nay, TTL ~60 giây. Khi quay lại tab, dữ liệu cũ hiện lập tức và tự cập nhật nền khi hết TTL. Nút Làm mới và các thao tác ghi dữ liệu xóa cache. Các tab tiện ích (lịch ca, hậu kiểm, tìm ảnh, nhật ký, hệ thống) giữ trạng thái giao diện giữa các lần chuyển tab.
- Bảo vệ phân quyền và ca làm việc **vẫn được kiểm tra phía server mỗi 20 giây**. Không cache API xác thực ở trình duyệt, không lưu thông tin khách vào localStorage/IndexedDB/CacheStorage. Tự xóa cache khi phiên không còn quyền hoặc đăng xuất.
- Thống kê kho: `Đang giặt` là nhãn thuần, không còn là nút.
- Hậu kiểm: chỉ hiển thị `Đã thu` khi chưa có phí; phí đã ghi nhận mới hiện rõ. Nếu tiền đã thu vượt số phải thu mà chưa có khoản phí phù hợp, thông báo chênh lệch cần đối soát — **không tự tạo phụ thu**.
- Tạo đơn: nút submit không khóa im lặng nữa; phản hồi chính xác các điều kiện còn thiếu (khách, ảnh chứng từ, giá sản phẩm, ngày giờ). Máy chủ vẫn bắt buộc thu đủ tiền/ảnh khi đặt trước.
- Chuẩn thời gian khi hiển thị `HH:MM DD/MM/YYYY`, múi giờ `Asia/Ho_Chi_Minh`, 24h (nửa đêm `00:00`, không phải `24:00`). Các ô nhập ngày giờ trong luồng tạo đơn/gia hạn dùng input chữ có chỉ dẫn theo chuẩn này và nút lịch phụ.

## Giới hạn cần kiểm thử tại Codespaces

1. `npm install && npm run verify:release && npm test && npm run typecheck && npm run build`.
2. Xác nhận tạo đơn đặt trước có chứng từ, gọi API thật; kiểm tra màn hình nhập ngày và giờ trên iOS Safari, Chrome PC.
3. Đổi tab nhanh (dưới 60 giây) để xác minh không tải lại danh sách, đợi ~60 giây để xem dữ liệu tự cập nhật.
4. Thử nhân viên hết ca để xác nhận ứng dụng đăng xuất và xóa cache theo quy tắc đã áp dụng.
5. Tạo dữ liệu thử: tổng thuê 50k/đã thu 60k; không có khoản phụ thu thì Admin thấy chênh 10k để đối soát. Có phụ thu 10k đã ghi nhận thì hiển thị đúng 50k/10k/60k.

Mã nguồn giữ nguyên Firebase schema và các biến môi trường; không yêu cầu migration. ZIP không chứa `.env.local`, `.git` hay `node_modules`.
