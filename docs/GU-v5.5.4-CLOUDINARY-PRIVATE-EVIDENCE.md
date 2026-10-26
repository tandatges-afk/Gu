# GU v5.5.4 — Bằng chứng cọc / CCCD trên Cloudinary authenticated

## Phạm vi

- Áp dụng trên nền GU **v5.5.3**. Không thay đổi giao nhận, tiền cọc, hoàn vật cọc hoặc định giá. Không tích hợp ngân hàng.
- **Mới:** `POST /api/v5/secure-photo` nhận ảnh JPEG/PNG/WebP tối đa 3 MB, kiểm tra Firebase Auth và vai trò/ca làm việc, kiểm tra chữ ký định dạng, upload trực tiếp từ **máy chủ** đến Cloudinary `type=authenticated`, sau đó ghi `secureEvidenceUploads/{uuid}` vào Firestore. Phản hồi chỉ là UUID, không URL hoặc khóa.
- **Xem:** `GET /api/v5/secure-photo?id=...` bắt buộc nhân viên hợp lệ trong ca. Ảnh chỉ được xem sau khi bằng chứng đã gắn vào đơn có thật (`consumedOrderId`). Máy chủ yêu cầu ảnh từ Cloudinary bằng URL API ký có thời hạn 60 giây và truyền lại byte qua `/api/v5/secure-photo` với `private,no-store`, không chuyển URL nhà cung cấp về trình duyệt.
- **Tương thích cũ:** Bằng chứng từ v5.5.3 có `path` trong Firebase Storage chỉ có thể xem nếu bucket cũ thực sự tồn tại và `FIREBASE_STORAGE_BUCKET` còn cấu hình; đây chỉ là đường đọc dữ liệu cũ. Không có tự động chuyển ảnh cũ.
- Ảnh sản phẩm và ảnh kiểm nhận giao/nhận đã dùng Cloudinary `/image/upload` trước đây giữ nguyên. KHÔNG tái sử dụng URL public để lưu CCCD.

## Cấu hình VS Code Local, Vercel

Trong `.env.local` và Vercel → Settings → Environment Variables thiết lập:

```env
CLOUDINARY_CLOUD_NAME=<ten-cloud>
CLOUDINARY_API_KEY=<api-key>
CLOUDINARY_API_SECRET=<api-secret>
```

Firebase Spark tiếp tục cho Firestore/Auth theo hạn mức của nó; **không cần bật Firebase Storage cho ảnh mới**. Không dùng `NEXT_PUBLIC_` cho khóa bí mật. Không sử dụng Cloudinary unsigned upload preset cho ảnh CCCD. Không lưu `.env.local` lên Git.

Chạy từ VS Code (PowerShell):

```powershell
npm.cmd install
npm.cmd run diagnose:storage
npm.cmd run diagnose:storage -- --check-remote
npm.cmd run verify:release
npm.cmd run test
npm.cmd run typecheck
npm.cmd run build
```

`diagnose:storage` hiện kiểm tra **Cloudinary**, không còn yêu cầu bucket Firebase. `--check-remote` kiểm tra quyền API từ máy local mà không tải ảnh khách. Không log ảnh hoặc secret.

## Thử nghiệm nghiệp vụ trước khi triển khai

1. Nhân viên đã vào ca: tạo đơn đặt trước, chụp ảnh chứng từ cọc, xác nhận đơn, Admin mở ảnh.
2. Nhân viên nhận hàng: chụp CCCD/chứng từ, bấm giao đồ, mở ảnh từ màn chi tiết.
3. Kiểm tra API GET khi chưa đăng nhập và khi ảnh chưa thuộc đơn: phải trả 401/404; thử URL `image/authenticated` thông thường ngoài GU phải **không xem được**.
4. Kiểm tra upload lỗi (Cloudinary thiếu API key/hết quota): GU báo lỗi rõ, không báo đã lưu cọc ảnh.
5. Xem ảnh cũ từ Firebase (nếu đã có). Không tự xóa bucket cũ trước khi kiểm tra dữ liệu.
6. Kiểm tra Firestore Reads trong Firebase Console sau khi vận hành. Chuyển storage KHÔNG thay đổi hạn mức Reads của Spark.

## An toàn, bảo mật và giới hạn

- Chỉ giữ tham chiếu `publicId`, `format`, provider/`authenticated` trong Firestore. Không lưu ảnh base64/URL public trong document; API không trả link Cloudinary.
- Cloudinary `authenticated` yêu cầu chữ ký ngay cả với bản gốc/ảnh biến đổi. URL tải tạm chỉ dùng nội bộ máy chủ.
- Quyền đọc hiện tương đương GU v5.5.3: mọi nhân viên **được phép sử dụng GU trong ca** có thể xem chứng từ của đơn; chưa có phân quyền hẹp theo từng đơn. Hãy cân nhắc giới hạn thêm nếu yêu cầu nội bộ.
- Cloudinary có hạn mức dung lượng/băng thông/quyền API riêng. Không giả định miễn phí vô hạn. Ảnh nhạy cảm phải có chính sách lưu giữ, xóa theo hạn và nhật ký truy cập phù hợp. **v5.5.4 chưa tự động xóa chứng từ cọc sau N ngày**; chưa nên coi đây là vòng đời dữ liệu hoàn chỉnh.
- Nếu API đã tải Cloudinary thành công nhưng Firestore ghi thất bại, GU cố gắng xóa ảnh vừa tải lên; lỗi xóa được ghi log để Admin kiểm tra. Ảnh upload từ bản cũ không tự chuyển.
- Kiểm tra Cloudinary account có hỗ trợ `authenticated` và tải ảnh bằng API ký thời hạn ngắn trên chính môi trường thật. Bộ test giả lập không thay thế kiểm thử tích hợp.
- Khi triển khai trên Vercel Preview, xác nhận các yêu cầu ảnh được xử lý bởi Node.js runtime, không Edge.
