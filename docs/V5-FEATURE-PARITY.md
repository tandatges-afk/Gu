# Đối chiếu GU Firebase V5 và GU PostgreSQL 6.1 RC1

Nguồn đối chiếu: `Gu-main(1).zip` mà người dùng cung cấp và source GU PostgreSQL V2 Beta 2 (30 file) đang chạy trên VPS. Đây là bản xây dựng lại, **không phải chuyển đổi 1:1**.

| Tính năng | PostgreSQL 6.1 RC1 |
|---|---|
| Admin/Staff, đăng nhập Argon2id, phiên truy cập | Có trong source V2 |
| Khách hàng, danh mục, tìm kiếm không dấu | Có trong source V2 |
| Sản phẩm, mã móc, ảnh cơ bản | Có trong source V2 |
| Đặt trước, nhận, trả, checklist, giặt, bồi thường cơ bản | Có trong source V2 |
| Kiểm tra trùng lịch thuê đồng thời tại DB | Có trong source V2 |
| Thanh toán, công nợ, báo cáo, ca làm | Có trong source V2 |
| Ảnh giao/nhận, ảnh chứng từ quyền Admin | Có trong source V2; bổ sung bắt buộc gắn đơn |
| Cảnh báo 17h hàng chưa trả, mai có khách | **Mới** ở 6.1 RC1 |
| Đánh dấu sản phẩm đã trùng lịch ngay trong form | **Mới** ở 6.1 RC1; DB tiếp tục là nguồn kiểm tra cuối cùng |
| Hoàn tiền chỉ Admin | **Mới** ở 6.1 RC1 |
| AI tìm kiếm bằng ảnh | **Chưa chuyển** |
| Cơ chế duyệt chứng từ nhiều cấp và tự xóa nâng cao V5 | **Chưa chuyển toàn bộ** |
| Quy tắc giá/bồi thường ngoại lệ tùy sản phẩm | **Chưa chuyển đầy đủ** |
| Mọi thiết lập/tác vụ/biểu đồ riêng trong GU V5 | **Chưa chuyển đầy đủ** |

Không gọi RC1 là production-ready chỉ dựa trên số bài test thuần logic. Trước khi ngừng Vercel/Firebase/Cloudinary của V5, cần chốt danh sách tính năng bắt buộc, kiểm thử thực tế, và bảo toàn dữ liệu lịch sử nếu còn cần.
