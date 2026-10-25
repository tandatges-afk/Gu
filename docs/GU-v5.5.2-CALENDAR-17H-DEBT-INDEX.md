# GU v5.5.2 — Calendar cleanup + cảnh báo chưa nhận sau 17h + chỉ mục công nợ

## Nguồn và giới hạn xác minh
Được tạo từ GU v5.5.1 FULL SOURCE đã bàn giao (không được đồng bộ trực tiếp với GitHub hiện tại). Không thay đổi các hành động ngân hàng, cọc, nhận-trả, ảnh kiểm nhận hay khóa giao dịch. Kiểm thử logic đi kèm chạy trên Node 22; cần chạy npm install/typecheck/build trên VS Code Local vì bộ source trong môi trường tạo bản vá chưa cài npm dependencies.

## Thay đổi
1. Xóa thành phần giao diện `<section className="panel gu-smart-calendar">` ("Tìm đồ còn trống") và các state của nó. API smart-calendar vẫn giữ cho nút **Ngày trống gần nhất** trong lịch. Nút đó tra cứu từ ngày đang xem, hoặc hôm nay nếu người dùng đang xem quá khứ, dự kiến một ngày thuê 09:00 → 09:00 hôm sau.
2. Lịch sản phẩm có nút Trang đầu, Trang trước, Trang sau, trang hiện tại; danh sách sản phẩm tải từng trang 25 món. Việc lọc theo trạng thái/danh mục là lọc **trong trang hiện tại**, nên trang có thể ít hơn 25 món sau khi lọc.
3. Lịch phân biệt dữ liệu đang tải; không coi thiếu phản hồi API là ngày trống và không dùng đơn cũ của trang/ngày khác. Chỉ xét đơn `RESERVED`/`PICKED_UP`, ưu tiên đã giao nếu có các đơn chồng khớp. Đơn trả quá hạn hiện màu cảnh báo ngày hôm nay và trong tương lai nếu vẫn chưa trả thực tế.
4. Một đơn `RESERVED` có ngày hẹn nhận là **hôm nay theo Asia/Ho_Chi_Minh**, chưa được giao lúc từ 17:00 đến 23:59, sẽ đổi màu tím. Nếu hẹn nhận sau 17h, chỉ báo sau giờ hẹn. Sau 00:00 hôm sau màu cảnh báo biến mất, **đơn vẫn ở trạng thái RESERVED và vẫn giữ khóa lịch**. Không tự hủy, tự giải phóng hàng, tự hoàn tiền hay trừ cọc.
5. API `/api/debts` trả lỗi dễ hiểu hơn nếu Firestore chưa tạo chỉ mục. Không thay đổi cấu trúc hoặc dữ liệu sổ nợ.

## BẮT BUỘC: Tạo/chờ Firestore index trên máy chủ
`firestore.indexes.json` đã khai báo chỉ mục `debtLedger`:

- `kind` ASCENDING
- `outstanding` ASCENDING

**Khai báo trong code không có nghĩa index đã tồn tại trên Firebase.** Bạn phải deploy index lên chính project `gugu-547e3` hoặc mở liên kết Firebase trả về trong log để tạo nó.

Liên kết lỗi nguyên gốc để tạo trực tiếp:
https://console.firebase.google.com/v1/r/project/gugu-547e3/firestore/indexes?create_composite=Ck1wcm9qZWN0cy9ndWd1LTU0N2UzL2RhdGFiYXNlcy8oZGVmYXVsdCkvY29sbGVjdGlvbkdyb3Vwcy9kZWJ0TGVkZ2VyL2luZGV4ZXMvXxABGggKBGtpbmQQARoPCgtvdXRzdGFuZGluZxABGgwKCF9fbmFtZV9fEAE

Hoặc trong PowerShell VS Code Local (sau đăng nhập đúng tài khoản và kiểm tra project):

```powershell
npx.cmd firebase-tools login
npx.cmd firebase-tools deploy --only firestore:indexes --project gugu-547e3
```

Đợi index có trạng thái `Enabled`/hoàn tất trước khi kiểm tra lại `/api/debts`. Không chạy `firebase deploy` không kèm `--only firestore:indexes` để tránh đụng rules/hosting không liên quan.

## Cài đặt bản vá trong VS Code Windows
1. Backup/commit trạng thái hiện tại; ưu tiên tạo nhánh `feature/gu-v5.5.2`.
2. Giải nén PATCH ZIP vào gốc repo và ghi đè các file tương ứng. Bản PATCH chỉ chứa file có thay đổi; bản FULL SOURCE là lựa chọn thay thế nếu đang có source v5.5.1 sạch.
3. Chạy:

```powershell
npm.cmd install
npm.cmd run verify:release
npm.cmd run test
npm.cmd run typecheck
npm.cmd run build
```

4. Kiểm tra thủ công ở `/calendar`: cảnh báo 17h, chuyển ngày, đổi trang, tra cứu ngày trống gần nhất, thanh lọc, và dữ liệu khách hàng. Trước khi merge hãy so sánh source đang trên GitHub xem có tính năng ngoài v5.5.1 ZIP cần giữ lại không.
5. Sau khi kiểm thử đạt mới commit, push nhánh và thử Vercel Preview; sau đó merge lên Production nếu đạt.

## Các giới hạn hiện tại
- Chưa tích hợp tự động thu và hoàn cọc ngân hàng, đúng theo yêu cầu trước đây.
- Ô "Ngày trống gần nhất" vẫn xác nhận qua endpoint `smart-calendar`, không thay thế kiểm tra khóa lịch trong transaction khi tạo đơn.
- Tìm sản phẩm theo tên/mã vẫn theo API catalog, còn tìm theo khách hàng/SĐT dựa vào những đơn đã tải về cho các sản phẩm trên trang; **chưa triển khai truy vấn tìm khách toàn lịch theo server**. Cần nâng cấp riêng nếu muốn kết quả đầy đủ toàn kho và không tăng Reads không kiểm soát.
- Chưa đo và xác minh thực tế trên Firestore/Vercel Production.
