# GU v5.0.0 Beta 10 — lỗi index Firestore và bố cục nút

## Nguyên nhân sự cố `GU_DB_INDEX_REQUIRED` (mã `06000513`)

Phản hồi người dùng cho thấy Firestore báo cần chỉ mục, nhưng **không chứa tên API hoặc tổ hợp trường truy vấn bị lỗi**. Mã sự cố chỉ là mã ngẫu nhiên để tìm chính xác log tại Vercel; không thể dùng mã này để đoán index. Đọc 1 document bằng ID `/api/v5/orders/[id]` không cần composite index. Các request danh sách được gọi đồng thời khi vào trang Đơn thuê có thể là nguồn lỗi.

Bản mới chuyển hai truy vấn danh sách về chỉ mục đơn trường (`/api/catalog`: chỉ `orderBy(field)`; `/api/stock-state`: `where(status).orderBy(status)`) và vẫn phân trang ổn định theo snapshot. Các API quan trọng trả thêm `endpoint` trong lỗi Firestore; Vercel Logs ghi `GU_SERVER_ERROR` cùng `incidentId`, `endpoint`, thông báo chi tiết từ Firebase. Việc này xử lý rủi ro index truy vấn danh sách nhưng **không đảm bảo lỗi gốc đã hết cho đến khi thử trên đúng project Firebase**.

### Cách chẩn đoán nếu 403/503 còn xảy ra

1. Mở DevTools → Network → chọn request màu đỏ → Response. Lưu `endpoint`, `code` và `incidentId`.
2. Mở Vercel → dự án GU → Logs và tìm `incidentId` (ví dụ `06000513` nếu còn log).
3. Nếu log Firestore có URL `https://console.firebase.google.com/.../firestore/indexes?...`, mở **đường dẫn chính xác từ Google**, xem collection, trường và chiều sắp xếp; mới tạo index đó. Chờ trạng thái `Enabled`.
4. Nếu Google không yêu cầu index cho endpoint này, gửi lại thông báo lỗi gốc và API để sửa đúng truy vấn. Không tự tạo hàng loạt composite index hoặc reset Firestore.

> Nếu mã `06000513` được sinh ở deployment cũ, sau khi update cần tái hiện và lấy mã mới. Chỉ log server có đủ thông tin xác định root cause.

## UX/UI

- Admin PC và nhân viên PC: toolbar tự xuống hàng, nút tối thiểu 44px, chia khoảng cách đồng nhất; khu vực thu tiền/gia hạn trong chi tiết đơn không che nhau.
- Mobile web: nhóm nút thành một cột ở màn hình rất hẹp; các phím giao/nhận, chụp lại và tình trạng sản phẩm đủ diện tích thao tác.
- Không thêm hint rườm rà; thiết kế chỉ thay layout và spacing, không đổi quyền hay tính năng.
- Không thay đổi dữ liệu Firebase, Cloudinary; không chạy migration hoặc reset.

## Trước khi push

```bash
npm install
npm run verify:release
npm run test
npm run typecheck
npm run build
```

Xác nhận click từng đơn thuê ở trang Đơn hàng, mở đơn cũ và đơn v5, phân trang danh sách, thêm món vào đơn, Admin duyệt, nhập tiền và màn hình mobile thực tế. Chỉ push `main` khi kiểm thử được trong môi trường của cửa hàng.

## Cập nhật toàn bộ mã nguồn trên Codespaces

Kéo tệp ZIP Beta 10 vào `/workspaces/Gu`, tạo nhánh kiểm thử từ `main` sạch, giải nén vào `/tmp/gu-v5-beta10`. Dùng `rsync -a --delete` cho `src/public/tests/scripts/docs` và chép các tệp cấu hình tương ứng. Không đưa ZIP, `.env.local`, private key hoặc backup vào Git.

Chạy `npm run test && npm run typecheck && npm run build`, xem UI thật ba client; sau đó mới commit, merge `main` và push. Việc tạo index bằng link Firestore chỉ thực hiện nếu Google yêu cầu index khác ở Vercel Logs.
