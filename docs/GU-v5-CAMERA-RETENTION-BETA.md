# GU v5.0.0-beta.2 — Máy ảnh và vòng ảnh 7 lượt

## Máy ảnh là 5 sản phẩm vật lý khác nhau

Admin vào Kho → Thêm sản phẩm → Danh mục `Máy ảnh`. Tạo **bốn** sản phẩm `Canon EOS R50` và **một** sản phẩm `Canon M50`, mỗi chiếc có serial riêng (đọc trực tiếp trên thân máy), mã sản phẩm GU cấp tự động. Không nhập 5 lần bằng cùng một serial. Nhãn mã GU nên dán trên miếng dán tháo được hoặc túi bảo vệ, không dán che thông tin máy; dùng serial để đối chiếu lần cuối. Hãy ghi riêng bộ kit/ống kính/thẻ nhớ/pin nếu có.

## Bảng giá tính từ giờ giao thật

| Thời gian tối đa | EOS R50 | Canon M50 |
|---|---:|---:|
| 3 giờ | 110.000đ | 90.000đ |
| 6 giờ | 130.000đ | 110.000đ |
| 24 giờ | 190.000đ | 180.000đ |
| 48 giờ | 350.000đ | 340.000đ |

Ví dụ 3h01 sẽ thuộc mức 6h. Quá 48h **chưa có bảng phí trễ**: GU không tự tính phí khác và không duyệt hoàn tất để tránh sai tiền; xử lý chờ Admin chốt chính sách. Sản phẩm áo/váy/phụ kiện vẫn dùng giá theo các chu kỳ 24h trước đó. Đơn cũ không thay đổi bảng giá.

## 7 vòng ảnh giao/nhận gần nhất cho từng mã sản phẩm

Một vòng = đủ bộ ảnh bàn giao + đủ ảnh nhận, chỉ được tính khi Admin duyệt nhận trả. Mỗi sản phẩm (dù chung đơn hay cùng model) có bộ đếm riêng. Khi hoàn tất vòng số 8, vòng số 1 vào hàng chờ xóa; những vòng số 2-8 còn lại. Tác vụ xóa Cloudinary theo *public ID*, bật `invalidate=true`, chỉ xóa ảnh thuộc đúng đơn, sau đó xóa liên kết ảnh của riêng món cũ khỏi hồ sơ đơn (giữ nhân viên, thời gian, ghi chú và số tiền).

GU cố gắng xử lý ngay khi Admin duyệt. Nếu Cloudinary lỗi, tác vụ xóa **không được tính là đã xóa**, và sẽ chạy lại bởi Vercel Cron mỗi ngày 03:00 UTC, hoặc Admin gọi `POST /api/v5/evidence-cleanup` qua Firebase token. Để Cron hoạt động, phải cấu hình biến `CRON_SECRET` bí mật trong Vercel Production; không commit giá trị. Xem danh sách 7 vòng và số tác vụ tồn qua Admin GET `/api/v5/evidence-history/{itemId}`.

**Giới hạn về xóa vĩnh viễn:** Cloudinary có thể giữ bản sao lưu hoặc cache CDN tạm thời; ngoài ra trình duyệt, thiết bị hoặc backup bên ngoài có thể còn ảnh. Không thể cam kết xóa mọi bản sao đã phân phối. Nếu Cloudinary backup được bật, cần xử lý chính sách backup với nhà cung cấp. Ảnh bằng chứng v5-beta vẫn là URL công khai nếu biết liên kết — KHÔNG nên sử dụng cho hồ sơ nhạy cảm trên Production cho đến khi tích hợp ảnh riêng tư.

## Triển khai

Nhánh beta trên Firebase staging, sao lưu dữ liệu trước. `npm run test`, `npm run typecheck`, `npm run build` trong Codespaces. Thêm `vercel.json` (lịch Cron hằng ngày) ở root khi đồng bộ ZIP đầy đủ. Test 4 R50 khác serial, 1 M50, giá mốc 3/6/24/48h, ảnh 8 lần riêng một sản phẩm, task cleanup và retry. Không push thẳng Production nếu chưa thử end-to-end.
