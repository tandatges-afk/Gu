# GU v4.1.2 — Nhận đồ trước, tính tiền sau

## Thay đổi

- Khi mở đơn đang `PICKED_UP`, nhân viên **kiểm nhận từng bộ đồ trước** (Đã nhận đủ / Thiếu đồ). Không thể sang bước tiền nếu chưa kiểm hết.
- Bước tiền chỉ xuất hiện sau checklist: giá thuê của đơn, tiền trễ tự động theo ngày thực tế tại Việt Nam, đền bù theo giá Admin duyệt, tiền đã thu và còn phải thu.
- **Không nhập phí trễ bằng tay**; API máy chủ tính lại theo thời điểm xác nhận và đơn giá đã chốt của từng món. Yêu cầu gửi `lateFeeTotal` từ client bị từ chối.
- Chỉ khi bấm **Thêm phụ phí khác** mới cần nhập số tiền và lý do.
- Thay ô nhập tiền thu bằng **một checkbox xác nhận cửa hàng đã nhận đủ số tiền còn lại**. Nếu không chọn, công nợ tiếp tục để Admin theo dõi. Số tiền thu được tính trong Firestore Transaction.
- Ghi lịch sử thao tác thu tiền/nhận trả, bảo toàn checklist và quy trình `Đang giặt` / `Thất lạc`.
- Tối ưu giao diện các bước trên màn hình điện thoại.

## Giới hạn

- Giao diện mới hỗ trợ ghi nhận **thu đủ phần còn lại** ngay khi trả. Thu **một phần** vẫn có thể thực hiện theo tính năng thanh toán của đơn lúc đặt trước hoặc bởi Admin sau khi trả; không nhập số tiền lẻ tại màn hình kiểm nhận.
- Đây không phải tích hợp cổng thanh toán ngân hàng. Checkbox chỉ ghi nhận việc nhân viên xác nhận đã nhận tiền thực tế.
- Preview trên trình duyệt dùng ngày hiện tại ở Việt Nam; máy chủ **luôn tính lại lúc bấm lưu**, nhất là khi thao tác qua nửa đêm.
- Không cần migration Firestore, Firebase Storage hay sửa Cloudinary.
- Chưa xác nhận `next build` trong môi trường đóng gói; cần chạy đầy đủ ở Codespaces trước khi merge.
