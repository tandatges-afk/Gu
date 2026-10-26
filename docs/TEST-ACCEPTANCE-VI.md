# GU 6.1 – Kiểm thử trước khi dùng với dữ liệu thật

Thực hiện trên bản staging hoặc cơ sở dữ liệu thử riêng; **đừng dùng dữ liệu khách hàng thật trong lúc thử nghiệm**.

## Đăng nhập và phân quyền

- [ ] Admin đăng nhập/đăng xuất được; đăng nhập sai quá 8 lần bị giới hạn.
- [ ] Staff không thể vào API nhật ký, quản lý nhân viên hay ảnh loại `EVIDENCE`.
- [ ] Staff không thể tạo giao dịch hoàn tiền (`OUT`); Admin hoàn tiền được và không vượt số đã thu.
- [ ] Session bị thu hồi khi đăng xuất; tài khoản bị khóa không thể sử dụng phiên cũ.

## Đơn hàng, lịch và kho

- [ ] Click ngày 15 trong lịch: form đơn hiện đúng ngày 15, không phải ngày hiện tại.
- [ ] Tìm sản phẩm với `ao`, `xanh`, `lá`, mã móc và mã GU; tìm khách bằng số điện thoại.
- [ ] Khi chọn ngày trùng lịch đang đặt, sản phẩm có chữ `ĐÃ CÓ LỊCH` và không cho chọn.
- [ ] Cố tạo hai đơn trùng bằng hai trình duyệt: database từ chối một đơn (HTTP 409).
- [ ] Hai đơn tiếp giáp nhau vẫn tạo được khi không chồng khoảng thời gian.
- [ ] Tạo đơn đặt trước, giao hàng, kiểm tra trả đủ/thiếu và chuyển trạng thái giặt.
- [ ] Sau **17h Việt Nam**: hàng còn ở trạng thái `PICKED_UP`, mai có lịch nhận sản phẩm đó → cảnh báo màu vàng ở Tổng quan và Đơn thuê.
- [ ] Sau khi trả đồ hoặc hủy đơn ngày mai → cảnh báo biến mất sau khi làm mới.

## Hình ảnh, tiền và vận hành

- [ ] Tạo sản phẩm có ảnh; upload ảnh giao/nhận gắn với một đơn hàng.
- [ ] Ảnh chứng từ chỉ Admin được xem; file không thể truy cập như đường dẫn tĩnh không cần đăng nhập.
- [ ] Tiền thu, hoàn, phí bồi thường và công nợ khớp hóa đơn.
- [ ] Báo cáo doanh thu theo ngày, ca làm tối đa hai người.
- [ ] Sao lưu PostgreSQL và `/var/lib/gu/uploads`, **thử khôi phục** vào nơi khác.
- [ ] `npm audit --omit=dev` không còn High/Critical; firewall chỉ mở SSH/HTTP/HTTPS; SSL tự gia hạn.
- [ ] Điện thoại Android và iPhone: kiểm thử form, ảnh camera, bàn phím và lịch tháng.

Build thành công và `curl` trả HTTP 200 không thay thế cho kiểm thử nghiệp vụ ở trên.
