# GU v5 Beta 5 – Sửa lỗi TS2322 khi tạo đơn

Lỗi ở `src/app/api/v5/orders/route.ts`: kiểu `inspectionAngles?: string[]` của sản phẩm cũ có thể là `undefined`, trong khi `RentalOrder.photoTemplates` yêu cầu `Record<string,string[]>`.

Giải pháp: khi tạo đơn mới, lấy góc ảnh qua `normalizedAngles()`, lưu từng danh sách hợp lệ vào `Record<string,string[]>`; nếu góc bị thiếu/sai, trả mã 409 và yêu cầu Admin sửa hồ sơ. Không thay đổi sản phẩm hoặc đơn cũ.

Trên Codespaces sau khi chép toàn bộ bản nguồn: `npm install && npm run verify:release && npm run test && npm run typecheck && npm run build`. Chỉ triển khai `main` sau khi chạy thành công và thử quy trình tạo đơn v5.
