# GU v5.4.1 Beta 1 – Ảnh cọc, CCCD và chứng từ dùng Cloudinary authenticated

## Mục đích

Giữ Firebase Authentication + Firestore trên gói Spark, không cần kích hoạt Blaze. Ảnh sản phẩm vẫn thuộc Cloudinary `image/upload` công khai như phiên bản trước. Riêng ảnh chụp cọc đồ vật, CCCD và ảnh xác nhận khoản thu khi đặt trước được tải trực tiếp từ GU server lên Cloudinary với `type=authenticated` (cả ảnh gốc và ảnh biến đổi đều yêu cầu xác thực); **không** dùng `private` vì ảnh biến đổi có thể trở thành công khai.

## Vercel – Biến môi trường

- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- Firebase Auth/Firestore vẫn cần `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` và cấu hình client tương ứng.
- `FIREBASE_STORAGE_BUCKET` **không cần cho ảnh mới**. Nếu đã từng có chứng từ lưu ở Firebase Storage, giữ biến này và quyền truy cập bucket cũ khi cần xem lại ảnh cũ.
- Không bao giờ dùng tiền tố `NEXT_PUBLIC_` cho API key/secret Cloudinary. Không dán API secret lên chat hoặc commit vào Git.

Sau khi lưu đúng môi trường Production hoặc Preview, redeploy Vercel.

## Cách hoạt động

- API upload: `POST /api/v5/secure-photo` vẫn chấp nhận `reservation` và `deposit`; kiểm tra nhân viên Firebase, ảnh JPEG/PNG/WebP <=3 MB, `draftId` và bytes magic. Server gửi ảnh lên Cloudinary dưới đường dẫn `gu/secure-evidence/<uid>/<uuid>` với delivery type `authenticated`.
- Firestore `secureEvidenceUploads/<uuid>` chỉ lưu `provider:'cloudinary'`, `publicId`, `format`, mục đích, chủ ảnh, `draftId` và đơn tiêu thụ; không lưu signed URL/public URL của ảnh.
- API xem: `GET /api/v5/secure-photo?id=...` kiểm tra phiên làm việc, đơn và quyền. Chỉ Admin, người tạo đơn hoặc người đã thực hiện bàn giao/nhận trả của đơn được phép xem; GU proxy bytes về browser với `private,no-store`. URL Cloudinary đã ký chỉ được tạo và sử dụng trên máy chủ và hết hạn sau 90 giây.
- Bản ghi cũ có trường `path` nhưng chưa có `provider:'cloudinary'` vẫn được đọc từ Firebase Storage, nếu bucket cũ còn truy cập được; hệ thống không tự di chuyển/ghi đè bằng chứng lịch sử.

## Kiểm tra

Trên GU Admin → Hệ thống → Cloudinary · Ảnh cọc → Kiểm tra kết nối → Thử ghi / xóa. Thử ghi/xóa chỉ sử dụng PNG trắng 1×1 giả lập và dọn sau kiểm tra, không đọc ảnh khách.

Có thể kiểm tra trên Codespaces khi `.env.local` chứa Cloudinary credentials:

```bash
npm run diagnose:storage
npm run diagnose:storage -- --write-test
```

Chạy `npm run typecheck`, `npm run build` và kiểm tra thực tế trên Vercel Preview. Chỉ xóa `FIREBASE_STORAGE_BUCKET` nếu chắc chắn không cần đọc lại ảnh lịch sử. Xem xét chính sách giới hạn giữ dữ liệu và phân quyền theo đơn trước khi lưu giấy tờ cá nhân thật.

## Lưu ý chi phí / giới hạn

Sử dụng cùng Cloudinary account và hạn mức storage/bandwidth/API, do đó có thể đạt quota dù Firebase Spark miễn phí. Bản này không cam kết không phát sinh giới hạn của nhà cung cấp. Cloudinary authenticated khác với mã hóa đầu-cuối: người có tài khoản quyền quản trị Cloudinary vẫn có thể quản lý ảnh; GU cần bảo vệ chính các credentials.
