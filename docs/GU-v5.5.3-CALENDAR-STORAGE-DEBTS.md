# GU v5.5.3 — Lịch / Công nợ / Chứng từ riêng tư

## Nội dung bản vá
- Lịch cho thuê gọi `GET /api/calendar/view` và lọc toàn kho **trên máy chủ, trước khi phân trang 25 món**. Kết quả phụ thuộc các tài liệu lịch / đơn thực có trong Firestore. Có giới hạn an toàn 3.000 sản phẩm / 5.000 đơn cho các bộ lọc phức tạp; quá giới hạn thì báo lỗi thay vì hiển thị trống giả.
- Với truy vấn thông thường không lọc, hoặc chỉ lọc danh mục, API chỉ đọc trang sản phẩm cần thiết. Với tìm kiếm tên khách, SĐT, trạng thái và nhân viên, API đọc bộ dữ liệu phù hợp để áp dụng đúng toàn kho. Cache server-side tồn tại tối đa 45–60 giây và **không chia sẻ giữa các Vercel instances**. Theo dõi Firestore Reads thực tế.
- Lịch ngày cũ: đơn đã trả có `returnedAt` sẽ hiển thị "Đã giao" ở các ngày giữ đồ và "Đã trả" vào ngày khách trả. Đơn vẫn ở trạng thái PICKED_UP quá ngày trả được tô quá hạn. Trạng thái giặt/bảo trì của **hiện tại** không bị gán lùi về lịch sử.
- Sau 17h chưa nhận hàng: chỉ đổi màu ô giữ hàng trong **ngày hẹn**, không hiện thêm dòng chữ, không hủy đơn hoặc thay đổi cọc. Ngày hôm sau quay về trạng thái giữ nếu chưa giao.
- `/api/debts`: khi index SUM chưa deploy, tạm dùng 2 truy vấn đơn trường `kind`, tối đa 3.000 mục mỗi nhóm, 30 giây cache. **Vẫn cần triển khai index** để tối ưu chi phí.
- `/api/v5/secure-photo`: chẩn đoán bucket 404, quyền IAM 403 và cấu hình tên bucket. Không tự chuyển ảnh CCCD sang Cloudinary public.

## Cài đặt trên VS Code Local / Windows

**Nên tạo branch từ commit nguồn trước khi giải nén bản vá; sao lưu `src` và `package.json` nếu đã tự thay đổi.**

```powershell
cd 'C:\Users\Admin\Desktop\Gu\Gu'
git switch -c feature/gu-v5.5.3
# Giải nén PATCH zip vào thư mục hiện tại rồi chạy:
npm.cmd install
npm.cmd run verify:release
npm.cmd run test
npm.cmd run typecheck
npm.cmd run build
```

Chỉ push nếu `typecheck` và `build` đều thành công:

```powershell
git add -A
git commit -m 'GU v5.5.3 - Fix global calendar filters and Firebase services'
git push -u origin feature/gu-v5.5.3
```

## Firebase Firestore index (phải làm thật trên project)

Vào https://console.firebase.google.com/project/gugu-547e3/firestore/indexes và tạo index:

- Collection: `debtLedger`, scope Collection
- Field 1: `kind`, Ascending
- Field 2: `outstanding`, Ascending

Hoặc cài Firebase CLI, đăng nhập và trong root repo:

```powershell
npx.cmd firebase-tools login
npx.cmd firebase-tools deploy --only firestore:indexes --project gugu-547e3
```

Đảm bảo đã chuyển trạng thái `Enabled`. Bản vá fallback là giải pháp tạm thời, không thay thế việc tạo index.

## Bucket chứng từ riêng tư (phải làm thật trên project)

1. Mở https://console.firebase.google.com/project/gugu-547e3/storage → Get Started / Files. Nếu chưa có bucket, tạo trên gói Blaze và giữ quy tắc truy cập riêng tư.
2. Sao chép **tên bucket thực**, thường `gugu-547e3.firebasestorage.app` cho bucket tạo mới (không đoán tên cũ `gugu-547e3.appspot.com`).
3. Vercel Project → Settings → Environment Variables: đặt `FIREBASE_STORAGE_BUCKET` đúng tên (không https://). Áp dụng Production và Preview tùy môi trường và deploy lại.
4. Tài khoản dịch vụ đang được cấu hình qua `FIREBASE_CLIENT_EMAIL` cần IAM phù hợp để đọc/ghi ảnh trên bucket (ví dụ `Storage Object User` ở phạm vi bucket).
5. Với `.env.local` trên máy, chạy `npm.cmd run diagnose:storage`. Chỉ kiểm tra tồn tại, chưa xác minh quyền ghi.
6. Kiểm thử ảnh chứng từ với đơn thử nghiệm. **Không dùng ảnh CCCD của khách để thử công khai.**

## Kiểm tra logic 7 ngày

- Lọc `Đã giữ` hiển thị đơn ở bất kỳ trang sản phẩm nào và bất kỳ ngày nào của tuần đang xem, rồi mới phân trang.
- Lọc `Đã giao` với đơn đã trả ngày hôm nay: xem lại tuần trước vẫn thấy các ngày đang giữ đồ.
- `Đã trả` hiển thị ở ngày hoàn trả, `Trả trễ` cho đơn đang giữ qua hạn.
- Trước 17:00 → không tô cảnh báo chưa nhận; đúng 17:00 → tô cảnh báo; sang ngày kế tiếp → không tô màu cảnh báo nữa.
- Lọc tên khách, SĐT, mã/ tên sản phẩm, danh mục và nhân viên được thực hiện ở backend.
- Chuyển Trang sau / Trang trước / Trang đầu và thay bộ lọc không lẫn dữ liệu cũ.

### Giới hạn cần biết

Không có dữ liệu lịch sử trạng thái giặt/bảo trì theo ngày thì không thể khôi phục chính xác các trạng thái đó từ trước khi có ghi log. Nếu `returnedAt` không tồn tại trong bản ghi trả hàng cũ, hệ thống tạm lấy ngày trả dự kiến. Muốn audit thời điểm thực, cần bổ sung lịch sử trạng thái bất biến trong lần nâng cấp kế tiếp. Các trạng thái khớp theo ngày, chưa tái dựng chính xác từng phút đối với camera thuê theo giờ.
