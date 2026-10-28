# GU v5.4.4 Beta 1 – Lịch cho thuê: gọn, thẳng cột, nhóm trạng thái động

## Mô tả

- Ẩn những dòng chữ "Hôm nay", "Ngày mai", "Ngày mốt" trong **tiêu đề cột**. Ngày và thứ vẫn giữ; màu nền dịu cho ba ngày theo múi giờ Việt Nam vẫn chạy qua toàn cột.
- Tiêu đề ngày và các ô lịch dùng cùng kích thước lưới, viền một nét giống nhau; bỏ các đường viền giả bằng `box-shadow` gây lệch 2–4px.
- Ô ngày còn trống chỉ còn dấu **+**. Khi hover hoặc dùng trình đọc màn hình vẫn có mô tả và thao tác đặt thuê, không bỏ kiểm tra khóa lịch máy chủ.
- Toàn bộ sản phẩm đang hiển thị được **phân nhóm trạng thái theo ngày đầu của khoảng 7 ngày**. Bấm tiến/lùi ngày sẽ tự nhóm lại; không dùng trạng thái ngày cũ hoặc trạng thái tổng tuần.
- Thứ tự nhóm: **Trả trễ → Cảnh báo 20h → Đã lấy → Đã giữ → Chưa sẵn sàng → Còn trống → Ngày quá khứ**. Trong cùng một nhóm, sắp tên tiếng Việt rồi mã sản phẩm để thứ tự ổn định.
- Nếu một món có nhiều lượt thuê máy ảnh trong cùng ngày, ưu tiên biểu diễn lượt đang giao trước lượt đặt trước; click vẫn cho phép chọn lượt thuê.
- Desktop và mobile dùng chung `calendarSlotState` và `sortCalendarProductsForDay`; không thay đổi thời gian thuê, khóa lịch, Firebase, giá hoặc chứng từ.

## Lưu ý giới hạn của phân trang

Danh sách lịch vẫn dùng phân trang 25 sản phẩm: việc nhóm được áp dụng cho toàn bộ **trang đang xem**, không thay đổi thứ tự giữa các trang chưa tải. Không chủ động tải hết kho chỉ để sắp xếp vì làm chậm lịch và tiêu tốn truy vấn Firestore. Muốn sắp xếp toàn kho xuyên phân trang sẽ cần chỉ mục ngày/trạng thái phía server ở một bản nâng cấp riêng.

## Kiểm tra trên Codespaces

```
npm install
npm run verify:release
npm test
npm run typecheck
npm run build
```

Kiểm tra bằng tay: mở Lịch sản phẩm, chọn hôm nay, có 2 món Đã lấy trong ngày và trạng thái khác nhau ở ngày mai. Đảm bảo hai món Đã lấy nằm sát nhau hôm nay, sau khi bấm chuyển sang ngày mai sẽ được nhóm theo ngày mai. Thử nhiều lượt thuê cùng ngày, trạng thái Trả trễ/Cảnh báo, lịch trên iPhone và laptop; xem các đường viền ngày trùng thẳng với ô lịch.
