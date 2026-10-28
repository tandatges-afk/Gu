# GU v5.4.3 Beta 1 — Lịch sản phẩm rõ tên/mã, tô toàn bộ cột, trạng thái trực quan

- Thay đổi UI lịch thuê, không thay đổi Firestore, giá thuê, quyền truy cập, việc tạo đơn hoặc dữ liệu lịch.
- Cột sản phẩm 284px; tên tối đa 2 dòng, mã `GU-xxxxx` thành dòng độc lập, ảnh gọn; giữ hàng 86px. Hover tên ở PC để xem nguyên văn.
- Nền nhạt được áp dụng cho **toàn bộ cột sản phẩm của từng ngày** (bao gồm mọi hàng) chứ không chỉ header. Tương ứng Việt Nam: hôm nay màu đào, mai màu hồng phấn, mốt màu lam xám. Màu theo ngày hệ thống, không theo vị trí trong chuỗi 7 cột.
- Thứ tự chú giải: cảnh báo (tím) → trả trễ (đỏ hồng) → đã lấy (xanh dương) → đã giữ (vàng nhạt) → còn trống (xanh lá). Tên trạng thái hiển thị trên mỗi ô, không chỉ dựa vào màu. Các trạng thái không khả dụng và đã qua cũng có nhãn riêng.
- Rủi ro từ 20h được đánh dấu trên cột hôm nay, không tô tím tất cả ngày tương lai. Trả trễ ưu tiên cao hơn cảnh báo nếu cùng tồn tại.
- Mobile áp dụng đồng bộ màu theo ngày ở các ô lịch trong từng thẻ sản phẩm; không phải thu nhỏ lưới desktop xuống điện thoại.
- Kiểm tra sau deploy trên PC và điện thoại: tên dài/ảnh thiếu, danh sách 25 sản phẩm, chuyển ngày, đơn đã giữ/đã giao, hôm nay+mai+mốt, ô giặt/bảo trì, ngày đã qua.
- Chạy: `npm run verify:release && npm run test && npm run typecheck && npm run build` (Node 22). Chỉ push khi pass.
