# GU v5.3.2 Beta 1 — Lịch thuê & tìm bằng ảnh

Dựa trên GU v5.3.1 Beta 2. Đây là full source giải nén vào thư mục gốc Codespaces.

## Thay đổi

1. Bỏ khối riêng **Tìm đồ còn trống** khỏi Lịch cho thuê (không xóa API `/api/smart-calendar` vì vẫn cần **Ngày trống gần nhất**). Giữ `gu-search-wrap`, tìm tên/mã/số điện thoại/tên khách trên trang lịch.
2. Thiết kế bộ lọc lịch mới: danh mục, tình trạng, nhân viên; điều hướng ngày nhóm riêng; mobile dùng lưới không đè lên các ô.
3. Màu tím cho cảnh báo **từ 20h chưa trả, mai có lịch**; màu vàng vẫn dành cho **Đã giữ**. Cảnh báo có nút đóng, sẽ xuất hiện lại khi ngày hoặc tập món cần cảnh báo thay đổi.
4. Tìm bằng ảnh: mỗi lượt chỉ kiểm tra trạng thái và lịch đặt 7 ngày của **12 kết quả khớp đầu tiên**. Xanh: AVAILABLE; đỏ: RENTED; cam: giặt/bảo trì/thất lạc; xám: chưa xác minh. Lịch bắt đầu trong 7 ngày tính cả hôm nay được hiển thị ngày nhận / ngày trả và giờ nếu đơn có dữ liệu giờ. Không trả tên, điện thoại hoặc chứng từ khách từ endpoint này.
5. `Ngày trống gần nhất` giữ lại và tra dựa trên ngày bắt đầu đang xem, mặc định một chu kỳ 09:00–09:00, vì các ô chọn thời gian của bảng tìm cũ đã bị bỏ.

## API mới

`POST /api/v5/visual-availability` (Bearer Firebase ID token)

Body: `{ "itemIds": ["firestore-item-id-1", "firestore-item-id-2"] }` (tối đa 12 ID hợp lệ).

Response: `states` chứa `status`, `upcoming` (`pickupDate`, `returnDate`, `pickupAt`, `returnAt`). Với đơn cũ thiếu giờ, giao diện chỉ hiện ngày, không tự tạo giờ.

API dựa trên hai index `v5DayIntervals` và `rentalSlots`, xác minh các đơn `RESERVED`/`PICKED_UP`. Không tạo index Firestore mới và không tự thay đổi dữ liệu.

## Kiểm thử & triển khai

```bash
npm install
npm run verify:imports
npm run verify:release
npm test
npm run typecheck
npm run build
```

Chỉ push khi các lệnh đều thành công trên Codespaces; thử trước trên Vercel Preview. Bản này không thay đổi migration hoặc biến môi trường.
