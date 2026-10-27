# GU v4.2.1 – Tài nguyên hệ thống và nhập tiền

- Sửa Firestore Monitoring 403: thay "chưa có dữ liệu" bằng trạng thái không thể đọc số liệu và hướng dẫn Admin bật Cloud Monitoring API / cấp Monitoring Viewer đúng service account. Việc cấp IAM phải do chủ dự án làm thủ công, GU không tự nâng quyền.
- Sửa số credits Cloudinary bị làm tròn sai về 0 khi phần trăm vẫn khác 0. Hiện tối đa hai chữ số sau dấu phẩy. Dữ liệu chính thức vẫn lấy từ Cloudinary Admin API; không giả lập nếu thiếu.
- Tất cả ô **giá thuê**, **giá trị đền bù**, **tiền cọc**, **tiền thu thêm**, **phụ phí khác** tự thêm dấu chấm phân cách hàng nghìn ngay khi nhập: 1000 → 1.000. Dữ liệu gửi server vẫn là số nguyên VND, không có dấu chấm.
- Giữ nguyên chống đặt trùng, thu tiền, đơn thuê, chỉ mục công nợ và Firestore. Áp dụng trên bản v4.2.0 đã sửa `stock-state` TS2339.

## Kiểm tra thủ công
1. Đăng nhập Admin → Hệ thống: trước khi cấp Monitoring Viewer, GU ghi rõ lý do 403; sau khi cấp và chờ số liệu Google cập nhật, bấm Cập nhật.
2. Cloudinary có 0,17 GB và ~1% credits: không còn hiển thị 0 nếu credits API có số thập phân >0.
3. Trong Kho, nhập giá 1000, 10000, 100000 và 1000000; xác minh màn hình 1.000 / 10.000 / 100.000 / 1.000.000 và giá lưu thật không bị tăng 1000 lần.
4. Lặp lại trên tạo đơn (tiền cọc), chi tiết đơn (thu thêm), kiểm nhận trả (phụ phí khác).
5. Kiểm tra `npm run test`, `npm run typecheck`, `npm run build` trong Codespaces Node 22 trước khi merge production.
