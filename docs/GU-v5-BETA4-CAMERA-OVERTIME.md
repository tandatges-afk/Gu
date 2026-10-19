# GU v5.0.0 Beta 4 — Phí trễ máy ảnh tự động 10.000đ/giờ

## 1. Quy tắc

Mỗi máy ảnh được thuê theo **gói chốt lúc tạo đơn**. Thời hạn gói bắt đầu khi nhân viên Mobile **thực sự giao máy** (ảnh giao đã xác nhận).
Tất cả các mức phí dưới đây là **giá thuê tích lũy**, đã bao gồm phí trễ; không cộng lại phí trễ một lần nữa.

| Gói | Canon EOS R50 | Canon M50 |
|---|---:|---:|
| 3 giờ | 110.000đ | 90.000đ |
| 6 giờ | 130.000đ | 110.000đ |
| 24 giờ | 190.000đ | 180.000đ |
| 48 giờ | 350.000đ | 340.000đ |

`Tổng tiền = Giá gói đã chốt + 10.000đ × ceil(max(0, số phút thực tế – số phút gói) / 60)`

Cụ thể:

| Ví dụ | R50 tổng | M50 tổng |
|---|---:|---:|
| Thuê gói 3h, trả sau 180 phút | 110.000đ | 90.000đ |
| Thuê gói 3h, trả sau 181 phút | 120.000đ | 100.000đ |
| Thuê gói 3h, trả sau 240 phút | 120.000đ | 100.000đ |
| Thuê gói 3h, trả sau 241 phút | 130.000đ | 110.000đ |
| Thuê gói 6h, trả sau 361 phút | 140.000đ | 120.000đ |
| Thuê gói 24h, trả sau 24h01 | 200.000đ | 190.000đ |
| Thuê gói 48h, trả sau 48h01 | 360.000đ | 350.000đ |

**Không tự chuyển sang biểu phí gói cao hơn khi khách trả trễ.** Gói R50 3h nếu trả sau 6h, tổng vẫn là 140.000đ (110.000đ + 3 giờ trễ × 10.000đ), thay vì tự chọn gói 6h giá 130.000đ. Nếu khách muốn chọn gói 6h ngay từ đầu, cần đặt 6h tại bước tạo đơn.

## 2. Các chỗ đã cập nhật

- Tạo đơn trên PC: chọn giờ dự kiến, máy ảnh được gắn `cameraPackageHours` và `cameraPackageBasePrice` cho từng dòng.
- Chụp giao Mobile: bắt đầu tính giờ từ lúc giao thực tế.
- Gia hạn và giao thêm đồ: giữ gói đã chốt của dòng máy cũ; đồ thêm mới được chốt gói riêng.
- Chụp nhận Mobile: dùng thời gian nhận thực tế; không bắt nhân viên Mobile tính tiền.
- Duyệt Admin: máy chủ tính tổng tiền thuê từ giờ giao/nhận thực tế, hiển thị số giờ trễ và phụ thu.
- Công nợ: tiền trễ đã nằm trong tổng tiền thuê, **không cộng vào `lateFeeTotal` lần nữa**.
- Đơn beta3 đã trả nhưng đang chờ tính phí: Admin có nút *Tính tự động phí trễ máy ảnh* để xử lý, không cần nhập phí.
- Các chức năng quản lý ảnh 7 lượt, 3 client và kho vẫn giữ nguyên.

## 3. Đơn cũ

Các đơn có giá gói mới đều lưu giá lúc chốt. Các đơn máy ảnh beta3 không lưu gói được suy ra từ `lineTotal` khi khớp với một trong 4 giá niêm yết. **Nếu đơn cũ từng thay đổi thời hạn hoặc giá ngoài bảng, hãy đối chiếu số tiền trên giao diện trước khi quyết toán vì không phải tất cả hợp đồng beta3 có thể suy ra chính xác gói lịch sử.**

## 4. Kiểm thử trong Codespaces (Node 22)

```bash
nvm use 22
npm install
npm run verify:release
npm run test
npm run typecheck
npm run build
```

Sau đó sử dụng Firebase staging, kiểm tra vòng khép kín: PC tạo gói R50 3h → Mobile giao → Mobile nhận sau 3h01 → Admin duyệt thấy 120.000đ → thu tiền → công nợ đúng. Lặp lại với gói M50, 24h/48h và khi >48h.

**Không push trực tiếp bản Beta lên Production** cho đến khi kiểm thử thực địa và sao lưu Firestore. Đây là bản Beta, chưa được xác minh bằng build Next.js hoặc môi trường Firebase/Cloudinary thực tế trong phiên đóng gói.
