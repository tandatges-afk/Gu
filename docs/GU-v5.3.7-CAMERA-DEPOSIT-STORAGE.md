# GU v5.3.7 Beta 1 — Gói máy ảnh, ảnh cọc và Firebase Storage

## Lựa chọn gói máy ảnh
- Ở cả **Đặt lịch thuê** và **Tạo đơn giao ngay**, khi chọn sản phẩm loại máy ảnh, phải chọn **3h, 6h, 24h hoặc 48h**.
- Khi chọn gói hoặc thay đổi giờ nhận, GU gợi ý giờ trả = giờ nhận + số giờ gói. Có thể sửa giờ trả sớm hơn, nhưng không thể đặt giờ trả vượt gói đã chọn (vui lòng chọn gói dài hơn).
- Giá thuê máy ảnh được chốt theo gói đã chọn, **không tự suy từ độ dài timeline**. Máy Canon EOS R50 và Canon M50 có giá khác nhau theo bảng giá hiện tại.
- Gói dùng chung cho tất cả máy ảnh trong cùng đơn vì GU dùng chung giờ nhận/trả; nếu hai máy cần hai gói khác nhau hãy tách đơn. Đồ thường trong cùng đơn dùng chung giờ nhận/trả đó.
- Trả trễ thực tế vẫn có phí ngoài gói theo quy tắc 10.000đ/giờ bắt đầu.

## Đặt lịch trước: chỉ chụp ảnh xác nhận cọc
- Không cần chọn tiền mặt hay chuyển khoản, không cần nhập mã giao dịch và không có checkbox xác nhận riêng.
- Ảnh được chụp qua máy ảnh/điện thoại, lưu **Firebase Storage riêng tư**, gắn với tài khoản và bản nháp đơn; máy chủ xác thực ảnh trong cùng Firestore transaction với việc tạo đơn.
- QUAN TRỌNG: Quy tắc cũ **đặt trước ghi nhận đã thu đủ 100% tiền thuê** vẫn được giữ. Vì vậy việc nhân viên tạo đơn từ ảnh có nghĩa là nhân viên xác nhận đã nhận đủ tổng số tiền. Ảnh tự nó không chứng minh ngân hàng đã chuyển khoản thành công; hãy đối chiếu tiền trước khi tạo đơn.
- Ledger lưu `method: PHOTO_PROOF` (không tự đoán tiền mặt/chuyển khoản), không gán mã giao dịch ngân hàng giả. Có thể tiếp tục dùng phương thức/codes trong thu bổ sung, hoàn tiền, thu sau trả.
- **Ảnh tiền thuê/cọc thanh toán** tại lúc đặt là ảnh `purpose=reservation`; **ảnh vật cọc/giấy tờ** khi bàn giao là `purpose=deposit` — khác nhau, không tự quy đổi thành tiền thuê.

## Lỗi GU_SERVER_ERROR e17532e0 khi chụp ảnh
Mã lỗi chỉ là **incidentId** do server tạo. Không thể xác định chính xác lỗi thật từ mã đó nếu không có **Vercel Runtime Logs** tại lần xảy ra; tìm chuỗi `e17532e0` để xem endpoint, tên lỗi và message gốc. **Không công khai private key hoặc ảnh CCCD khi chia sẻ log**.

GUI bản này phân loại lỗi cụ thể ngay trong `/api/v5/secure-photo`: `GU_STORAGE_BUCKET_NOT_FOUND`, `GU_STORAGE_PERMISSION`, `GU_STORAGE_AUTH`, `GU_STORAGE_LIMIT`, `GU_STORAGE_UNAVAILABLE`.

1. Firebase Console → dự án `gugu-547e3` → Storage → Files: sao chép đúng tên bucket tồn tại. Firebase Cloud Storage có thể yêu cầu nâng cấp Blaze để hoạt động.
2. Vercel → Project → Settings → Environment Variables: `FIREBASE_STORAGE_BUCKET` = **tên bucket không có `gs://`**, ví dụ `gugu-547e3.firebasestorage.app` **chỉ nếu Console xác nhận đúng**. Đặt ở Production và Preview nếu test cả hai, sau đó redeploy.
3. `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` phải cùng dự án có bucket. Cấp service account tương ứng quyền `storage.objects.create`, `storage.objects.get`, `storage.objects.delete` trên bucket private, ví dụ Storage Object Admin giới hạn scope đúng bucket.
4. Codespaces (môi trường có `.env.local` đầy đủ) chạy:

```bash
npm run diagnose:storage
npm run diagnose:storage -- --write-test
```

- Lệnh đầu **chỉ đọc metadata** (cần `storage.buckets.get`).
- Lệnh thứ hai tạo **một file text giả không chứa thông tin khách**, kiểm tra quyền ghi, rồi xóa (cần quyền ghi/xóa object). Không upload ảnh thật.
- `.env.local` của Codespaces và biến môi trường Vercel **không tự đồng bộ với nhau**. Script chạy thành công ở Codespaces không có nghĩa Vercel dùng đúng cấu hình: hãy xem Vercel Environment Variables & Redeploy.

## Kiểm thử trước khi push

```bash
npm run verify:release
npm run verify:imports
npm run test
npm run typecheck
npm run build
```

Test các đường: máy ảnh 3h/6h/24h/48h ở đặt trước và giao ngay, giờ trả sau nửa đêm, áo + máy cùng đơn, chụp ảnh cọc khi tạo đơn, chụp ảnh vật cọc ở bàn giao, xem ảnh khi nhận trả, retry sau lỗi Storage.

**Còn hạn chế:** chưa có quyền xem chứng từ theo từng người được phân công đơn, chỉ chặn theo tài khoản hợp lệ và ca làm. Trước khi dùng CCCD thật, cần thêm phân quyền chứng từ theo đơn như đã nêu ở báo cáo kiểm toán trước. Không bật bucket public để "fix" lỗi.
