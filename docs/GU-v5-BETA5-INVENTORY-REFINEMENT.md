# GU v5.0.0 Beta 5 — Danh mục, góc chụp, giặt và lỗi máy chủ

## Những gì đã chỉnh
- Loại danh mục hệ thống mặc định *Áo dài, Váy, Vest, Trang phục, Khác* trong màn hình chọn. Giữ *Phụ kiện*, và *Máy ảnh* là loại nghiệp vụ đặc biệt. Danh mục do Admin tạo vẫn dùng bình thường. Không xóa document/category hoặc đổi loại sản phẩm cũ trong Firestore tự động.
- Không hiển thị ô Size trong quản lý sản phẩm/đơn. API tự giữ trường tương thích `size: "Một size"` cho món mới, không đụng đến size trong lịch sử đã chốt.
- Phụ kiện/Máy ảnh không hiển thị tính năng giặt; máy chủ bắt buộc lưu `requiresLaundry=false`, kể cả yêu cầu gửi trực tiếp bằng API. Trang phục có thể bật giặt.
- Admin tạo từng góc kiểm nhận qua ô nhập tên và nút `Thêm góc chụp`; có thể xóa từng góc hoặc toàn bộ. Tối đa 10 góc/sản phẩm. Không tạo góc mặc định trên máy ảnh/quần áo.
- Cho phép nhập kho trước khi có góc chụp; **không cho tạo đơn V5** với sản phẩm chưa được Admin cấu hình ít nhất một góc. Sản phẩm có đơn cũ vẫn giữ bộ ảnh của đơn cũ.
- Đổi cách báo lỗi máy chủ không xác định: hiển thị `Mã lỗi: XXXXXXXX` có thể đối chiếu trong Vercel Logs `[GU_SERVER_ERROR]`; lỗi validation ảnh/góc chụp thành HTTP 400 có thông báo.

## Lỗi "Có lỗi hệ thống"
Ảnh người dùng cho thấy Cloud Monitoring API đã Enable trên project `gugu-547e3`, nhưng trạng thái API Monitoring **không chứng minh** thao tác tạo sản phẩm đã thành công hay thất bại. Nếu lỗi tiếp tục:
1. Đăng nhập Admin, thử tạo sản phẩm với tên, loại, một ảnh hợp lệ; chụp thông báo trên giao diện.
2. Vào Vercel → Logs, lọc `[GU_SERVER_ERROR]` theo mã lỗi của GUI; gửi **mã và loại lỗi đã che dữ liệu**, tuyệt đối không gửi API Key, private key, token.
3. Xác minh biến `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `CLOUDINARY_*` đang trỏ đúng dự án và máy chủ có quyền vào các collections/counter; không kết luận thiếu quyền từ dòng thông báo chung.
4. Nếu lỗi 409 thiếu góc chụp: Admin mở sửa sản phẩm và thêm ít nhất một góc trước khi tạo lịch.

## Triển khai
Không merge GU Beta 5 vào Production cho đến khi `npm run test`, `npm run verify:release`, `npm run typecheck`, `npm run build` thành công tại Codespaces và hoàn tất kiểm thử đơn thật trên Firebase staging.
