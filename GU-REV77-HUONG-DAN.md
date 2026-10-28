# GU Rev7.7 — Đăng nhập, nhận trả/quyết toán và giờ nhận thực tế

## Phần sửa

- **Đăng nhập:** sửa ô mật khẩu có margin kéo nút Hiện/Ẩn ra khỏi khung; cân đối card trên desktop, laptop và điện thoại; đổi nhãn đăng nhập về tiếng Việt.
- **Nhận trả / Quyết toán:** tách 2 việc cần làm: **(1) thu đủ tiền còn thiếu**, **(2) hoàn tiền cọc hoặc trả CCCD**; hiện rõ đã xong/chưa xong; phụ thu để trong mục tùy chọn. Tránh số `0` thừa khi không có cọc tiền. Tránh nút “Hoàn tất” khi vẫn còn việc cần làm, có thể “Để sau”.
- **Giờ nhận:** sau khi bàn giao, ô thời gian chính trong chi tiết đơn và lịch sử/lịch sản phẩm hiển thị `handoverProof.at` (giờ giao thực tế). Giờ hẹn trước đây nằm ở mục mở rộng để đối soát. **Không sửa** `pickupAt`, `scheduledPickupAt`, `startAt` hay các khóa thuê/giá tiền trong PostgreSQL.

## Cách cập nhật an toàn trên Windows

Bản patch được tạo từ **GU Rev7.6**. Cần áp dụng trên checkout sạch của Rev7.6, không patch nhầm Rev7.5.

```powershell
cd "C:\Users\Admin\Desktop\GU-MAIN-READY"
git fetch origin main
git worktree add -b gu-rev77-ui "C:\Users\Admin\Desktop\GU-REV77-UI" origin/main
cd "C:\Users\Admin\Desktop\GU-REV77-UI"
$patch = "$env:USERPROFILE\Downloads\GU_Rev7_7_UI_Fix.patch"
git apply --check $patch
if ($LASTEXITCODE -ne 0) { throw "Patch khong khop: can kiem tra source main truoc" }
git apply $patch
npm ci
if ($LASTEXITCODE -ne 0) { throw "npm ci FAILED" }
foreach ($step in @("verify:release","typecheck","test","test:vps","build")) {
  npm run $step
  if ($LASTEXITCODE -ne 0) { throw "FAILED: $step" }
}
```

Nếu patch không khớp `main` (có commit mới), **không dùng `--force` hoặc chép đè source**; cần so sánh thay đổi. Có ZIP full source để đối chiếu, nhưng không có `.git` và không nên copy đè cấu hình trên VPS.

Sau khi toàn bộ test/build đạt, kiểm tra các file stage (không chứa `.env`, khóa riêng, dữ liệu khách hàng), commit trên nhánh, và merge vào `main` theo quy trình repository. Nếu Auto Production đang bật, **merge/push main sẽ kích hoạt deploy Production**; cần kiểm tra backup mới, workflow và health check sau phát hành.

## Trạng thái kiểm tra tại đây

- Test unit/source: 341/341 đạt.
- Test VPS: 15/15 đạt.
- Source guard/import/checksum: chạy ở bộ source đóng gói.
- Kiểm tra cú pháp TS/TSX bằng TypeScript transpile: chạy ở môi trường đóng gói.
- **Chưa** chạy Next.js `build` đầy đủ với npm dependencies cài trên Windows hay đo UI qua browser thực tế.

## Kịch bản UAT cần thử trước khi dùng thường xuyên

1. Màn hình login chiều rộng 360 / 390 / 768 / 1440 px; bàn phím TAB, ẩn/hiện mật khẩu.
2. Đơn đặt 05:39, giao thực tế 04:34: chi tiết và ô lịch hiện **04:34**; giờ hẹn cũ trong phần mở rộng.
3. Đơn giao muộn: giờ khách nhận thực tế, giờ bắt đầu tính thuê vẫn theo chính sách tính tiền đã thỏa thuận.
4. Nhận trả có CCCD; cần thu 50.000đ: **thu tiền trước**, nút hoàn CCCD mở khi thu đủ.
5. Nhận trả cọc tiền và không cần thu thêm: hiển thị số cọc cần hoàn, không cộng tiền cọc lần hai.
6. Sau khi hoàn tiền/CCCD: có thể đóng với trạng thái hoàn tất; nếu còn việc thì nút Để sau không báo hoàn tất nhầm.
