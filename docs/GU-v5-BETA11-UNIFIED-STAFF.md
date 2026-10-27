# GU v5.0.0 Beta 11 — Một nhân viên, hai kích thước màn hình

## Quy trình

1. Nhân viên đăng nhập **https://gu-nu.vercel.app/** bằng cùng tài khoản trên PC/điện thoại. Không còn URL `/mobile` hoặc vai trò phân chia theo thiết bị. Legacy `staff_mobile` sẽ tạm tương thích như `staff`; muốn chuyển hẳn dữ liệu, chạy `npm run staff:unify-plan`, sao lưu và mới chạy `npm run staff:unify-apply`.
2. Mở Lịch → bấm ô ngày cần thuê. **Ngày nhận mặc định lấy đúng ngày vừa bấm**; giờ nhận có thể chỉnh trong form.
3. Tìm khách bằng SĐT từ 3 số trở lên, chọn kết quả gợi ý ngay bên dưới. Có thể thêm khách mới nếu chưa có.
4. Tìm tên sản phẩm không dấu/chữ hoa hoặc theo chữ bất kỳ bên trong tên (`ao`, `áo`, `xanh` đều tìm được `Áo dài xanh lá`). Gõ ít nhất 2 ký tự, không cần nhập đúng đầu tên.
5. Tạo đơn. Form chụp ảnh mở ngay trong website: nếu **đang bàn giao thực tế**, chụp đầy đủ từng góc do Admin thiết lập, xác nhận giao; nếu khách đặt cho ngày tương lai, bấm **Để sau**, chụp khi khách đến lấy để không làm lệch giờ tính tiền thuê.
6. Khách trả đồ: Mở đơn → **Chụp ảnh nhận trả** → chụp ảnh từng góc, chọn tình trạng và gửi Admin duyệt. Ảnh giao/nhận vẫn được phân quyền và kiểm tra URL trên server. Admin duyệt tình trạng vật lý, quyết toán, công nợ như trước.
7. **17:00 giờ Việt Nam** trở đi, các đơn chưa trả có sản phẩm đã được đặt cho ngày mai được đánh dấu màu cam tại danh sách đơn/lịch và hiện cảnh báo. Kiểm tra, liên hệ khách và chuẩn bị đồ thay thế. Cảnh báo là phát hiện rủi ro, không tự hủy đơn hay tính phí.

## Dữ liệu cũ và triển khai

- Trước khi cập nhật: sao lưu mã nguồn/git và Firestore; thử bản mới trên nhánh `test/gu-v5-beta11`, chạy `npm run test`, `npm run typecheck`, `npm run build`, dùng Firebase staging nếu có.
- **Tìm sản phẩm cũ:** `npm run data:index-names` là xem trước; sau khi backup và tạm dừng thao tác kho, `npm run data:apply-names` ghi `nameSearchBigrams` và tái đồng bộ khóa tên. Script không tự sửa/xóa tên sản phẩm.
- **Tài khoản cũ:** `npm run staff:unify-plan` chỉ liệt kê số tài khoản `staff_mobile`. `npm run staff:unify-apply` chuyển chúng thành `staff` trên Firestore (không chạm Auth hay tài khoản Admin). Không cần chạy ngay để đăng nhập.
- **Không xóa database** và không cần bật Firebase Blaze cho cập nhật này.
- Số đơn tải trên trang chính được phân trang; API cảnh báo chỉ truy vấn tối đa 300 đơn chưa trả và 300 đơn nhận ngày mai. Nếu API báo `truncated`, cần nâng cấp phân trang để tránh bỏ sót khi quy mô cửa hàng tăng nhiều hơn 300.
- Tìm kiếm n-gram với chuỗi 2 ký tự nhiều kết quả giới hạn 400 ứng viên. Khi nhu cầu vượt 2.000 sản phẩm, cần giải pháp tìm kiếm tập trung để đảm bảo độ phủ tuyệt đối và tối ưu đọc Firestore.

## Lưu ý kiểm thử

- Chưa kiểm chứng thực tế Cloudinary, Firebase live hoặc Chrome/iOS/Android trên môi trường của cửa hàng; unit tests không thay thế smoke test.
- Ảnh kiểm nhận có URL Cloudinary: quyền riêng tư/retention cần kiểm tra theo cấu hình Cloudinary của GU.
- Không đưa vào Production cho tới khi `typecheck`/`build` trên Codespaces thành công và luồng tạo → giao → nhận → Admin duyệt hoạt động ổn định.
