# GU v5.4.2 Beta 1 – Tự xóa chứng từ và giữ 7 lượt ảnh kiểm nhận

## Nguyên tắc áp dụng

- **Chỉ sau khi Admin bấm “Đã xem ảnh · Hoàn tất hậu kiểm”** trên đơn đã nhận trả, GU mới bắt đầu xóa ảnh CCCD, ảnh vật cọc, ảnh chứng từ thu tiền và ảnh bổ sung thanh toán của đơn. Nhân viên nhận trả **chưa** được tính là đã duyệt.
- Đơn được Admin duyệt theo **quy trình cũ**, hoặc đơn **Admin hủy/vô hiệu** sau khi đối soát, cũng được xếp hàng dọn ảnh riêng tư.
- Ảnh đã tải lên nhưng **chưa gắn vào đơn** sẽ được xóa nếu quá 24 giờ. Khi hệ thống đã nhận claim xóa, một yêu cầu tạo đơn mới không được dùng lại ảnh đó.
- Riêng ảnh góc chụp lúc **giao + nhận trả**, GU giữ **7 lượt hoàn chỉnh đã được Admin duyệt gần nhất cho mỗi sản phẩm vật lý**; khi có lượt thứ 8, chỉ ảnh của lượt cũ nhất bị xóa. Ảnh sản phẩm dùng trong danh mục Cloudinary không thuộc diện này.
- Lịch thuê, khoản đã thu/đã hoàn, sổ thanh toán, lịch sử duyệt và trạng thái xác nhận trả vật cọc vẫn giữ để cửa hàng đối soát. Ảnh không được dùng thay cho sổ tiền.

## Luồng xóa an toàn

1. Transaction Firestore ghi dấu `sensitiveEvidenceStatus=DELETING` và tạo job `sensitiveEvidenceCleanup/<orderId>`.
2. API mở ảnh trả HTTP 410 ngay từ lúc Admin duyệt, không chờ Cloudinary.
3. Hệ thống yêu cầu **Cloudinary xác nhận xóa resource authenticated** với `invalidate=true` để làm mất hiệu lực CDN cache; ảnh ở Firebase Storage cũ sẽ yêu cầu bucket cũ để xóa thực tế.
4. **Chỉ sau khi nhà cung cấp báo đã xóa**, GU xóa các bản ghi `secureEvidenceUploads` và hai ID ảnh cọc/thanh toán khỏi order. Dấu `PURGED` để Admin biết dọn xong, nếu có lỗi giữ job và thử lại. Không lưu ảnh trong hàng đợi.
5. Các tác vụ được kích hoạt ngay sau khi duyệt và bởi Cron `/api/v5/evidence-cleanup` hàng ngày. Cron còn quét dần các đơn đã được duyệt trước khi nâng cấp và ảnh đã bỏ dở.

> **Quan trọng:** Đây là xóa khỏi *hệ thống vận hành*, không phải chứng nhận loại bỏ mọi bản sao vĩnh viễn ở nhà cung cấp. Browser của người đã xem, bản xuất dữ liệu cũ và backup Cloudinary cũ nằm ngoài khả năng xóa đồng loạt của web. GU thêm `backup=false` vào upload mới. Nếu Cloudinary đã bật Auto Backup trước đây, phải xóa riêng các backup cũ qua Cloudinary Console/Support, chỉ chọn nhóm `gu/secure-evidence/`, tránh xóa ảnh sản phẩm. Cloudinary CDN invalidation có thể mất một khoảng thời gian.

## Cấu hình Vercel

- Giữ `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, credentials Firebase.
- Giữ biến `CRON_SECRET` do Vercel cung cấp hoặc cấu hình secret riêng an toàn. Lịch mặc định chạy mỗi ngày theo `vercel.json` (phụ thuộc gói và giới hạn Cron của Vercel).
- Firebase Storage cũ **không cần cho ảnh mới**; nếu có chứng từ legacy, giữ bucket cũ tới khi đã xóa hết. Nếu bucket cũ không còn thì tác vụ không thể xác nhận xóa, giữ pending và ghi cảnh báo thay vì báo thành công.
- Admin có thể dùng `POST /api/v5/evidence-cleanup` (qua giao diện/tài khoản đã xác thực) để yêu cầu chạy lại. Không gọi endpoint bằng token hoặc thông tin nội bộ công khai.
- Kiểm tra `npm run test`, `npm run verify:release`, `npm run typecheck`, `npm run build` trên Codespaces. Thử nghiệm trên Vercel Preview + Firebase staging trước Production.

## Kiểm thử cần làm

1. Chụp ảnh đặt lịch, ảnh CCCD/vật cọc; chưa trả hàng thì mở được theo quyền.
2. Nhân viên nhận trả: trạng thái `PENDING`, ảnh vẫn còn; Admin duyệt: GU bắt đầu xóa, truy cập ảnh trả lỗi 410.
3. Chạy Cron/endpoint xóa, đối chiếu trong **Cloudinary Media Library** các file `gu/secure-evidence/...` biến mất và Firestore `secureEvidenceUploads` bị xóa, order có `sensitiveEvidenceStatus=PURGED`.
4. Tắt API Cloudinary tạm thời: job phải giữ lại và thử lại khi khôi phục, tuyệt đối không đánh dấu `PURGED` giả.
5. Nếu ảnh vật cọc bị xóa sau Admin duyệt mà nhân viên chưa xác nhận trả vật cọc, GU vẫn hiển thị nút xác nhận dựa trên `hadHandoverDeposit`.
6. Chụp tám lượt giao/nhận cho một món, duyệt từng lượt; chỉ bảy lượt mới nhất giữ ảnh; các sản phẩm khác không bị ảnh hưởng.
7. Kiểm tra các bản backup trước ngày triển khai: web không thể tự xóa các tệp nhân viên đã tải về/đẩy lên nơi khác.

## Giới hạn của môi trường phát triển

Unit test và kiểm tra cú pháp không thay thế được kiểm thử kết nối thực tế tới Cloudinary và transaction Firestore trên Vercel. Không đưa ảnh CCCD thật vào môi trường thử nghiệm.
