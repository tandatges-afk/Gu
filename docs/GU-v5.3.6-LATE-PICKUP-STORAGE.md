# GU v5.3.6 — Cảnh báo khách quá giờ đến lấy và cấu hình Firebase Storage

## Cảnh báo đơn đã giữ mà chưa nhận

- Bắt đầu cảnh báo khi **giờ hẹn nhận thực tế đã trôi qua** và đơn vẫn `RESERVED` (Chờ bàn giao), không tự chuyển trạng thái, tính tiền hoặc hủy lịch.
- So sánh thời điểm ISO `scheduledPickupAt` (ưu tiên) / `pickupAt` với thời gian hiện tại; giao diện hiển thị `HH:MM DD/MM/YYYY`, theo giờ Việt Nam.
- Đơn cũ chỉ lưu ngày không có giờ: chỉ cảnh báo khi **ngày hẹn đã qua**, tuyệt đối không tự mặc định 00:00.
- Kiểm tra bằng API đã xác thực `GET /api/v5/return-risk` cho toàn bộ các đơn `RESERVED` (không chỉ 80 đơn gần nhất), refresh khoảng 60 giây khi trang mở; thông báo xanh dương phân biệt cảnh báo trả trễ màu đỏ và rủi ro 20h màu tím.
- Nhấn mã đơn trong banner để lọc đơn trong trang **Đơn thuê**; có nút X để tạm ẩn danh sách cảnh báo hiện tại. Khi danh sách thay đổi, banner hiện lại. Admin/nhân viên có thể liên hệ khách và làm thủ tục giao hàng qua nghiệp vụ có sẵn.
- Nếu quá 5.000 đơn đang đặt trước, API trả lỗi 503, không âm thầm báo thiếu; quy mô lớn cần backend job/counter chuyên dụng.
- Đây là cảnh báo **trong giao diện đang mở**, không phải SMS/Zalo/push tự động đến thiết bị đã đóng website.

## Cấu hình `FIREBASE_STORAGE_BUCKET` từng bước

> Từ 03/02/2026, Cloud Storage for Firebase **bắt buộc gói Blaze** kể cả bucket mặc định. Blaze tính tiền theo mức sử dụng và vẫn có một số định mức miễn phí. Không tự bật billing hay tạo bucket nếu chưa được cửa hàng chấp thuận.

1. Đăng nhập [Firebase Console](https://console.firebase.google.com/project/gugu-547e3/storage) ở dự án **gugu-547e3**. Vào **Databases & Storage → Storage**.
2. Nếu Storage chưa được kích hoạt: nâng cấp **Spark → Blaze** (liên kết Cloud Billing và đặt cảnh báo ngân sách), nhấn **Get started**, chọn khu vực bucket, sau đó **Done**. Chọn khu vực cân đối độ trễ Việt Nam và phí; vùng US-CENTRAL1 / US-EAST1 / US-WEST1 có thể dùng tier Always Free theo chính sách Google. Không tạo bucket tên đoán mò nếu Console đã có bucket.
3. Trong **Storage → Files**, sao chép chính xác tên bucket sau `gs://`. Bucket mới thường có tên `gugu-547e3.firebasestorage.app`; bucket cũ có thể là `gugu-547e3.appspot.com`. **Chỉ dùng tên thực tế đang hiển thị.** Không nhập `gs://`, không nhập đường dẫn `gu/secure-evidence`, không dùng URL Firebase Console.
4. Cấu hình `.env.local` **trong Codespaces** (không commit) và **Vercel → Project GU → Settings → Environment Variables**, đặt biến server-side:

   ```dotenv
   FIREBASE_STORAGE_BUCKET=<TEN_BUCKET_CHINH_XAC_TRONG_FIREBASE_CONSOLE>
   ```

   Đảm bảo `FIREBASE_PROJECT_ID=gugu-547e3`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` cùng thuộc project đó. **Không** dùng `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` và không công khai khóa service account.
5. Trong **Google Cloud Console → IAM** của dự án, kiểm tra tài khoản có email bằng `FIREBASE_CLIENT_EMAIL` có quyền ghi/đọc/xóa object cho bucket riêng tư. Có thể cấp **Storage Object Admin** trên **đúng bucket** thay vì toàn bộ dự án. Để chạy công cụ đọc metadata cũng cần quyền `storage.buckets.get` (ví dụ `Storage Legacy Bucket Reader` cho bucket hoặc quyền tùy chỉnh). Nguyên tắc ít quyền nhất, không tạo quyền truy cập công khai.
6. Trong Firebase Storage Rules, **không cho client trực tiếp đọc/ghi** prefix `gu/secure-evidence/`. Hệ thống GU lưu và trả chứng từ qua **Admin SDK / API đã xác thực**, API phải kiểm tra vai trò và quyền của nhân viên trên từng đơn; Admin SDK không phụ thuộc Storage Rules. Không bật public download token.
7. Restart dev server sau khi cập nhật `.env.local`; **Redeploy** Vercel sau khi thêm biến môi trường, kể cả môi trường **Preview** nếu cần test tại đó.
8. Kiểm tra read-only:

   ```bash
   npm run diagnose:storage
   ```

   Nếu thành công, test thêm ảnh chứng từ *giả lập* trên **Vercel Preview** (không dùng CCCD thật khi test). Đồng thời kiểm tra `POST /api/v5/secure-photo` ghi ảnh, rồi xác nhận đơn hợp lệ đọc được và người không có quyền không đọc được.

### Nếu bạn không muốn nâng cấp Firebase lên Blaze

Không có biến môi trường nào có thể thay thế một bucket thực sự tồn tại. GU đang thiết kế ảnh giấy tờ/chứng từ nhạy cảm ở Firebase Storage private; không chuyển ảnh này sang URL Cloudinary public. Có thể thiết kế lại để dùng private Cloudflare R2 hoặc dịch vụ storage riêng có signed-access và phân quyền theo đơn, nhưng đó là **một thay đổi kiến trúc khác**, không phải điền một giá trị vào `FIREBASE_STORAGE_BUCKET`.

### Bảo mật cần tiếp tục cải thiện

Endpoint `GET /api/v5/secure-photo` ở bản hiện tại mới kiểm tra tài khoản nhân viên và sự tồn tại của đơn; chưa phân quyền theo đơn/vai trò đủ chặt. **Không sử dụng với CCCD thật trước khi kiểm tra và bổ sung quyền truy cập theo vai trò/công việc và audit log.** Việc cấu hình bucket không tự giải quyết hạn chế đó.

Nguồn tham khảo: https://firebase.google.com/docs/storage/web/start và https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024
