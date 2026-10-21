# GU v5.4.6 Beta 1 — Giao diện đặt trước / tạo đơn

## Mục tiêu
- Hai form **Đặt lịch trước** và **Tạo đơn** dùng chung cấu trúc gọn, đồng nhất cho camera và trang phục/phụ kiện.
- Bỏ khung tiêu đề lặp lại bên trong popup; tiêu đề chính chỉ còn hành động, dòng phụ ghi nhóm thuê.
- Khách hàng: chọn từ danh sách hoặc tìm theo SĐT; nút thêm khách mới nằm trên hàng tiêu đề; gợi ý SĐT là menu nổi không đẩy form xuống.
- Thời gian: hai vùng nhận/trả cân đối, ngày `DD/MM/YYYY` và giờ `HH:MM` 24h; nút lịch có icon chuẩn.
- Sản phẩm: ô tìm kiếm nổi bật, hàng lựa chọn nhỏ gọn có ảnh/tên/mã, đánh dấu món đã chọn, có vùng cuộn riêng.
- Ghi chú, tổng tiền, ảnh xác nhận đặt trước và nút lưu được giữ nguyên nghiệp vụ.
- Styles chỉ ở `src/components/GuV5Booking.module.css`, không thêm CSS ghi đè vào `globals.css`.

## File sửa
- `src/components/GuV5Booking.tsx` — bố cục và nhãn, giữ nguyên API và logic đơn.
- `src/components/GuV5Booking.module.css` — responsive theo màn hình.
- `src/components/GuVNDateTimeInput.tsx` — thay ký tự lịch bằng icon CalendarDays.
- `src/app/page.tsx` — tên popup ngắn gọn, dùng style riêng cho modal booking.
- `tests/booking-dialog-v546-ui.test.ts` — test chống tái phát, kiểm tra cấu trúc và bảo toàn tính năng.

## Cách kiểm tra trên Codespaces
```bash
npm install
npm run verify:release
npm run test
npm run typecheck
npm run build
```
Sau đó dùng Vercel Preview thử **Tạo đơn** và **Đặt lịch trước**, cả Camera/Trang phục; thử chọn khách, tìm khách bằng SĐT, tạo khách mới, chọn sản phẩm và kiểm tra tiền thuê / ảnh chứng từ. Kiểm tra trên điện thoại 320/375/390px và PC 768/1024px. Không cập nhật production nếu build hoặc kiểm thử giao dịch thất bại.

## Lưu ý
Thay đổi này chỉ là giao diện. Không sửa quy tắc tính tiền, Firebase, ca làm hoặc khóa lịch. Kiểm thử mã nguồn không thay thế kiểm thử trình duyệt thật và Firebase staging.
