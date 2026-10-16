# GU v4.1.1 — Mã móc tự động

- Mỗi món đồ vật lý vẫn là một Firestore item riêng; **không gộp các bộ giống nhau**.
- Mã móc dễ đọc: GU-00001, GU-00002… được cấp tại API server trong giao dịch Firestore cùng lúc tạo sản phẩm, không nhận mã nhập từ client.
- Mã nội bộ cũ / ID đơn hàng cũ giữ nguyên; `hangerCode` mới tách biệt nên không làm hỏng lịch thuê.
- Admin có nút **Cấp mã cho đồ cũ** (tối đa 25 món/lần) để triển khai cho kho đã tồn tại, không tạo lại sản phẩm.
- Mã móc hiển thị tại kho (nhấn để sao chép), tìm trong form tạo đơn, kiểm nhận đơn hàng và quản lý giặt.
- Dán/in nhãn mã GU lên móc; muốn phân biệt bộ gần giống cần luôn giữ nhãn và đồ cùng nhau, nhất là khi giặt.
- Xóa/lưu trữ sản phẩm không tái sử dụng mã; lịch sử đơn giữ nguyên snapshot mã.

## Lưu ý triển khai

Nếu hai nhân viên tạo cùng lúc, giao dịch với `inventoryCounters/hanger` tránh trùng số. Không chỉnh tay document counter và không thay nhãn qua combobox.

Với kho cũ, đăng nhập Admin → **Kho sản phẩm → Cấp mã cho đồ cũ**. Lặp lại đến khi nút biến mất. Chuẩn bị móc và ghi đúng mã theo từng dòng.

Chạy `npm run test`, `npm run typecheck`, `npm run build` trước khi deploy. Backup dữ liệu trước thao tác cấp mã hàng loạt.
