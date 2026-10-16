# GU v4.1.0 — Smart Rental Calendar

Cập nhật trực tiếp từ GU v4.0.1; không thay đổi cấu trúc dữ liệu Firebase hoặc cấu hình Cloudinary.

## Chức năng mới

- **Tìm đồ còn trống theo khoảng ngày:** API `POST /api/smart-calendar` dùng khóa ngày `rentalSlots` từ Firestore và trạng thái thực của sản phẩm. Ngày thuê tính cả ngày nhận lẫn ngày trả. Khi nhân viên tạo đơn, máy chủ tiếp tục chặn trùng trong Firestore transaction. Giới hạn 30 ngày và 12 tháng tới.
- **Ngày trống gần nhất:** tìm khoảng trống liên tục đúng số ngày thuê (kể cả ngày trả), kiểm tra chính xác tối đa 90 ngày bắt đầu từ ngày nhận đã chọn. Không hứa hẹn ngày sẵn sàng cho đồ chưa giặt, bị mất, bảo trì hoặc chưa phê duyệt giá.
- **Liên hệ khách:** bấm gọi từ công việc hôm nay, danh sách đơn và chi tiết đơn bằng `tel:` (số đã lưu), phù hợp điện thoại.
- **Việc hôm nay:** ba nhóm Chờ giao, Đến hạn trả, Quá hạn, có số lượng, mở đơn, gọi điện và lọc đơn chính xác khi bấm tiêu đề nhóm.
- **Lọc lịch:** tất cả, còn trống, đã giữ, đã giao, trả trễ, đang giặt, bảo trì, thất lạc, chưa duyệt giá; kết hợp danh mục.
- **Sửa bố cục:** desktop dùng ô ngang cao 62px chiếm gần hết cột; mobile tiếp tục dùng ô vuông 80px (74px cho máy rất nhỏ), ảnh sản phẩm vuông 1:1.
- **Bộ nhớ đệm PWA:** đổi phiên bản cache sang `gu-static-v4-1-0`, không lưu API/dữ liệu khách hàng vào cache.

## Lưu ý nghiệp vụ và giới hạn

1. Kết quả tìm kiếm là tình trạng *tại thời điểm kiểm tra*. Không khóa giữ khi tra cứu; kết quả cuối cùng được xác minh khi tạo đơn.
2. Lọc trạng thái của bảng lịch chỉ dựa trên tập dữ liệu bảng điều khiển đang tải (giới hạn 300 đơn gần nhất), còn **Tìm đồ trống** dùng khóa thuê từ Firestore.
3. Nếu Firestore có trên 4000 khóa lịch trong khoảng tra cứu, hệ thống từ chối trả kết quả thay vì báo nhầm là trống. Hãy thu hẹp khoảng ngày.
4. Lịch sử chỉnh sửa, tiền thuê, trạng thái giặt, chống trùng và phân quyền Admin/Nhân viên không bị thay đổi bởi bản này.
5. Cần `npm run test`, `npm run typecheck`, `npm run build` trên GitHub Codespaces và kiểm thử bằng dữ liệu thử trước khi merge vào main.
