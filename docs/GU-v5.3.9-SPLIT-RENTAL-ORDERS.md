# GU v5.3.9 Beta 1 — Tách đơn máy ảnh và trang phục/phụ kiện

## Quy tắc từ bản này

- **Đơn thuê đồ:** chỉ trang phục và phụ kiện (kể cả "phụ kiện máy ảnh"); khoảng nhận → trả mặc định 24 giờ, có thể chỉnh lịch thuê bình thường. Không có danh sách chọn gói máy ảnh.
- **Đơn máy ảnh:** chỉ máy ảnh; nhân viên chọn 3, 6, 24 hoặc 48 giờ; giờ trả được tự động đặt theo gói từ giờ nhận. Một đơn chỉ sử dụng một gói nếu có nhiều thân máy; nhu cầu hai gói khác nhau phải tách hai đơn.
- Menu bên trái có **Đơn thuê đồ** và **Đơn máy ảnh**; hai trang có nút đặt trước / giao ngay và danh sách theo nhóm riêng.
- API POST `/api/v5/orders` yêu cầu `rentalGroup = "CAMERA" | "CLOTHING"`, kiểm tra phân nhóm từ category của từng sản phẩm **bên trong Firestore transaction** trước khi tạo khóa giờ, đơn và sổ tiền.
- API PATCH `ADD_ITEMS` không cho thêm chéo nhóm. Đơn cũ đã có máy ảnh và trang phục trong cùng đơn được giữ lịch sử, hiện ở mục Đơn thuê đồ với nhãn **Đơn cũ hỗn hợp** và không cho thêm đồ; không tự chia đôi khoản đã thu.
- Danh sách `/api/catalog?kind=orders&rentalGroup=CAMERA|CLOTHING` quét phân trang trên server, nên không lọc thiếu đơn chỉ vì đơn nằm ở trang sau. Tương tự việc chọn sản phẩm trong modal dùng `catalog?kind=items&rentalGroup=...`.
- Không thay đổi ảnh cọc, logic ca làm việc, thanh toán, hay dữ liệu cũ. Không cần migration.

## Kiểm tra trước khi deploy

1. Đặt trước **máy ảnh** 3 giờ: nhận 09:00, trả 12:00. Máy ảnh 6/24/48h được tính đúng bảng giá máy.
2. Đặt trước **áo dài**: nhận 09:00, trả 09:00 hôm sau, không bị ảnh hưởng bởi gói máy ảnh.
3. Cố gửi `itemIds` máy ảnh + áo dài vào cùng POST: HTTP 409, không tạo đơn/khóa lịch.
4. Tạo đơn máy ảnh, gọi PATCH `ADD_ITEMS` với ID trang phục: HTTP 409, không thay đổi đơn hoặc sổ quỹ (và ngược lại).
5. Dùng điện thoại: mở Menu → Đơn máy ảnh → Tạo đơn, kiểm tra góc ảnh/đặt cọc và danh sách.
6. Đơn cũ hỗn hợp vẫn xem, nhận/trả, hoàn tiền được theo quy trình cũ; chỉ chặn **thêm sản phẩm mới**.
7. `npm run verify:release`, `npm run test`, `npm run typecheck`, `npm run build` trong Codespaces trước khi push.

### Lưu ý về khả năng thay đổi

Thao tác gia hạn hiện vẫn kéo dài cả đơn theo nghiệp vụ cũ. Không nhập nhiều gói thuê khác nhau vào một đơn máy ảnh. Khi cần trả các máy tại thời điểm khác nhau, tạo các đơn máy ảnh riêng, vì mỗi đơn có một mốc nhận và trả riêng.
