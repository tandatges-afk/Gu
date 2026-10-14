# GU - Thuê đồ xinh v2.2.0

**Stack:** Next.js 16 + TypeScript, Firebase Authentication / Firestore (`gugu-547e3`), Cloudinary Free (ảnh sản phẩm), GitHub Codespaces, Vercel. **Không yêu cầu Firebase Storage/Blaze chỉ để lưu ảnh.**

## Cập nhật trong v2.2

- Thuê **1 ngày** = ngày nhận **trùng** ngày trả. Mặc định tạo đơn mới trong ngày, không tự cộng thêm ngày mai. Khoảng ngày khách thuê hiển thị riêng; `bufferDays` chỉ là ngày khóa lịch kỹ thuật (nếu đã chọn).
- **Đặt lịch trước:** tạo đơn `RESERVED`, giữ kho bằng Firestore Transaction; bất kỳ nhân viên hợp lệ nào cũng xác nhận `PICKUP` khi khách đến.
- **Tạo đơn giao ngay:** tạo đơn ở trạng thái `PICKED_UP`, cập nhật món thành `RENTED` ngay; bắt buộc ngày nhận là hôm nay (giờ Việt Nam).
- Form thuê: tra SĐT/tên khách, tìm SĐT bằng server kể cả khi khách không nằm trong 500 hồ sơ tải sẵn; thêm khách nhanh, tự chọn khách; sản phẩm tìm theo SKU, tên, màu, size, danh mục và lọc danh mục.
- Bỏ ngưỡng cố định **5 món/đơn**. Do giới hạn Firestore Transaction, một lượt ghi hiện có tối đa **400 ô lịch** (mỗi món × số ngày + ngày đệm). Khi vượt, giao diện hiện thông báo rõ ràng; không được tự ý bỏ kiểm tra nguyên tử để cho phép trùng lịch.
- Trong chi tiết đơn `RESERVED`/`PICKED_UP`: **Thêm sản phẩm**, khóa lịch nguyên tử. Với đơn đã nhận, món thêm tính từ ngày thêm đến ngày trả, không thu ngược các ngày trước đó.
- Tạo **danh mục kho**; theo dõi yêu cầu giặt cho từng SKU khi tạo sản phẩm.
- Trả hàng có checklist đầy đủ: nếu sản phẩm được đánh dấu cần giặt, trả đủ chuyển sang `LAUNDRY`; đồ không yêu cầu giặt chuyển `AVAILABLE`. Khi đang `LAUNDRY`, chỉ thao tác **Đã giặt** mới đưa về `AVAILABLE`; cả Admin và nhân viên được xác nhận, tất cả được ghi nhật ký. Danh sách đồ cần giặt nằm trong tab **Đơn thuê** và chi tiết đơn sau trả, nút **Đã giặt** cũng có trong Kho.
- Giữ Firebase token verification, Cloudinary upload, kiểm tra trùng ngày, phí đền bù, thanh toán, cảnh báo trả trễ và lịch sử audit.

## Lưu ý dữ liệu đang hoạt động (QUAN TRỌNG)

1. **Không xóa / tạo lại Firestore, Authentication, khách hàng hay đơn thuê.** Bản v2.2 dùng tiếp cấu trúc cũ; hai collection mới `categories`, `phoneIndex` được tạo khi có dữ liệu tương ứng.
2. Các **đơn cũ không bị tính lại lịch hoặc giá thuê**. Nếu trước đây đơn được tạo với ngày trả là ngày hôm sau thì ngày trả cũ được giữ nguyên, vì không thể tự đoán ý định nhân viên. Hãy đối chiếu và xử lý từng đơn trước khi sử dụng. Bản mới mặc định 1 ngày là cùng ngày.
3. Các **SKU cũ** không có `requiresLaundry`: hệ thống mặc định cần giặt khi `bufferDays > 0`, nhằm tránh giao đồ chưa giặt. Admin có thể đổi ngày đệm cho đơn **mới** bằng nút Đổi ngày đệm trong Kho. Lịch đã khóa từ đơn cũ dùng `bufferDays` đã lưu trong đơn; không xóa khóa lịch cũ.
4. Sản phẩm mới mặc định `bufferDays = 0`, `requiresLaundry = true`: trả hàng vào `LAUNDRY`, sau khi giặt xong nhấn **Đã giặt**. Ngày đệm 0 không có nghĩa là bỏ giặt.
5. Không sửa trực tiếp `status` hoặc `rentalSlots` trong Firestore để “mở khóa” nhanh vì có thể gây trùng lịch. Kiểm tra tất cả nghiệp vụ trên dữ liệu thử trước khi dùng thật.
6. `phoneIndex` áp dụng cho khách được tạo từ bản này; khách cũ vẫn tìm được bằng truy vấn số điện thoại trùng chuẩn hóa, còn các số cũ lưu dấu cách/định dạng khác có thể cần chuẩn hóa sau.

## Cập nhật GitHub Codespaces hiện tại `/workspaces/Gu`

**Không cần tạo Firebase/Cloudinary mới hoặc nhập lại API key.** Giữ nguyên `.env.local`, không đưa khóa bí mật lên GitHub.

1. Tải ZIP `GU-Thue-Do-Xinh-v2.2.0.zip`, upload vào thư mục `/workspaces/Gu` bằng Explorer của Codespaces.
2. Sao lưu nhánh hiện tại (và đảm bảo working tree sạch):

   ```bash
   cd /workspaces/Gu
   git status
   git switch -c backup-before-gu-v22
   git switch main
   ```

3. Giải nén vào `/tmp` và sao chép mã nguồn. **Các file trùng tên sẽ bị ghi đè**, không thực hiện nếu đang có sửa đổi chưa commit:

   ```bash
   unzip -q GU-Thue-Do-Xinh-v2.2.0.zip -d /tmp/gu-v22
   cp -a /tmp/gu-v22/Gu-Thue-Do-Xinh-v2.2/. .
   rm GU-Thue-Do-Xinh-v2.2.0.zip
   ```

4. Cài và kiểm tra trong Codespaces:

   ```bash
   npm install
   npm run test
   npm run typecheck
   npm run build
   npm run dev
   ```

5. Port 3000 → Open in Browser, đăng nhập Admin/nhân viên, kiểm tra tất cả nghiệp vụ bên dưới bằng dữ liệu giả. Khi lỗi build hãy dừng, đừng push.
6. Khi đã đạt, commit và push:

   ```bash
   git status
   git add src tests tsconfig.json package.json README.md firebase.json firestore.rules .env.example .gitignore next.config.ts public scripts
   git add package-lock.json  # chỉ khi tệp tồn tại sau npm install
   git commit -m "GU v2.2 rental flow, fast customers, laundry"
   git push origin main
   ```

7. Vercel → Deployments: kiểm tra bản mới **Ready**; dùng production URL. Nếu cần cập nhật biến môi trường thì Redeploy.

## Kịch bản kiểm thử bắt buộc

- Tạo một SKU cần giặt `bufferDays=0`; đặt ngày nhận/trả cùng hôm nay => đúng 1 ngày và 1 ngày tiền thuê.
- Đặt lịch trước cho ngày sau, nhân viên A tạo `RESERVED`; nhân viên B xem đơn, xác nhận `PICKUP` đúng ngày đã đặt. Tạo lịch đè cùng SKU/ngày phải trả **409**.
- Tạo đơn **giao ngay** hôm nay => `PICKED_UP`, SKU chuyển `RENTED`. Thử 2 nhân viên giao cùng SKU cùng lúc => chỉ một đơn thành công.
- Trong đơn đặt trước và trong đơn đã giao, bấm **Thêm sản phẩm** để xác nhận lịch được khóa thêm. Với đơn đã giao nhiều ngày, kiểm tra món mới chỉ tính tiền từ ngày thêm.
- Tra khách qua số điện thoại; tạo khách mới ngay form, xác nhận khách mới tự được chọn. Trùng SĐT chuẩn hóa không tạo thêm hồ sơ mới.
- Tạo danh mục mới, thêm sản phẩm đúng danh mục, tìm/lọc được. Thử tạo đơn trên 5 SKU.
- Trả một SKU `requiresLaundry=true` với checklist đủ => SKU `LAUNDRY`, không được giao đơn khác. Bấm **Đã giặt** => `AVAILABLE`, nhật ký có `ITEM_CLEANED`.
- Trả một SKU không cần giặt => `AVAILABLE`; đánh dấu thiếu => `MISSING` và phí đền bù đúng giá Admin duyệt.
- Đặt `bufferDays=1` để kiểm tra ngày đệm vẫn khóa lịch nhưng **không** hiển thị là ngày khách thuê và **không** tính phí ngày đệm.

## Bảo mật và hạn chế

- Chỉ API có xác minh Firebase token và `staff/{uid}` mới được sửa dữ liệu. File `firestore.rules` vẫn từ chối client truy cập thẳng.
- Không bao giờ commit `.env.local`, service-account JSON hoặc Cloudinary API Secret.
- Chưa kiểm thử integration trực tiếp với Firestore/Vercel từ môi trường đóng gói. Bản này đã vượt qua **22 unit tests** và kiểm tra cú pháp TypeScript; cần `npm run typecheck` và `npm run build` trong Codespaces trước khi lên production.
- Đơn thuê lớn phải chịu giới hạn 400 ô lịch/transaction; việc chia đơn nếu vượt giới hạn không làm mất tính chống trùng của từng đơn.
- Vercel dùng cho cửa hàng thương mại cần chọn gói phù hợp; Codespaces dùng để phát triển, không phải server phục vụ khách lâu dài.
