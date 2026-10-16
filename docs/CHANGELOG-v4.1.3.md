# GU v4.1.3 — Rà soát giao diện và công nợ theo khách

## Thay đổi giao diện
- Dùng bảng màu theo ngữ nghĩa: trống = xanh lá; giữ lịch = cam; đã giao = xanh dương; đang giặt = tím; trả trễ/thất lạc = đỏ; bảo trì = xám. Các thẻ có tên trạng thái, không dựa duy nhất vào màu.
- Khi chọn sản phẩm tại Tạo đơn/Thêm đồ, có nền xanh dương nhạt, viền xanh dương đậm 2.5px, dấu chọn và nhãn **Đã chọn**. Khóa lựa chọn có nền xám và viền đứt.
- Gom menu thành Công việc, Kho & vận hành, Dành cho Admin; không hiển thị menu công nợ/nhân viên/kiểm toán với nhân viên.
- Trong Kho, ưu tiên **Sửa**, chỉ hiện **Đã giặt** khi thực tế đang giặt; hành động Lưu trữ và trạng thái bảo trì nằm trong **Khác**.
- Đơn thuê chỉ dẫn một đường sang **Quản lý giặt**, bỏ danh sách giặt lặp lại với nhiều nút ở trang đơn.
- Trang chủ thay cụm hành động trùng chức năng bằng xem nhanh công nợ của Admin hoặc tình trạng giặt dành cho nhân viên.
- Giữ khung ảnh sản phẩm vuông, mobile nav và PWA, không thay đổi nghiệp vụ khóa ngày.

## Công nợ có định danh
- Admin có trang **Công nợ** riêng. Hiển thị tên khách, số điện thoại để gọi, các đơn thiếu tiền, tổng tiền phải thu/đã thu/còn thiếu.
- Công nợ thực tế chỉ tính đơn **PICKED_UP** hoặc **RETURNED** còn thiếu tiền. Đơn **RESERVED** chưa giao chuyển sang ô **Dự kiến thu** riêng; đơn **CANCELLED** không tính.
- Bắt đầu từ các đơn đã chốt, bao gồm phụ phí/đền bù/phí trả trễ đã ghi trên đơn. Không tự đoán phí trễ tương lai của đơn chưa trả.
- API `/api/debts` chỉ Admin truy cập và quét từng trang lịch sử thay vì giới hạn 300 đơn mới nhất. Vượt 10.000 đơn sẽ báo không thể đối soát đầy đủ, không hiển thị tổng tạm sai.
- API `GET /api/orders/[id]` cho Admin tải đơn cũ khi bấm **Mở đơn** và tiếp tục ghi nhận thu tiền qua API đang có.
- Báo cáo thu tiền hiện tại vẫn dựa trên 300 đơn mới nhất và có ghi rõ giới hạn này. Công nợ dùng nguồn riêng cho toàn lịch sử trong hạn mức.

## Hướng dẫn Codespaces
1. Làm trên nhánh mới, không ghi đè production, không commit `.env.local`.
2. Đồng bộ toàn bộ `src`, `public`, `scripts`, `tests`, `docs` từ ZIP cùng phiên bản.
3. Chạy `npm install`, `npm run verify:release`, `npm run test`, `npm run typecheck`, `npm run build`.
4. Trên Vercel Preview kiểm tra Android/iPhone, chọn sản phẩm, menu của nhân viên, trang công nợ Admin; thử ghi nhận một khoản thu trên **dữ liệu thử**.
5. Kiểm tra Firebase `gugu-547e3` dùng đúng quyền Admin và không mở trực tiếp Firestore Rules.

## Giới hạn
- Chưa có đối soát tự động từ ngân hàng/tiền cọc tách sổ; GU đang tính theo các trường `paid`, `total`, `compensationTotal`, `lateFeeTotal`, `otherFeeTotal` của đơn.
- Không kiểm thử được `next build` trong môi trường đóng gói vì npm registry không truy cập được. Bắt buộc xác nhận `typecheck` và `build` trên Codespaces trước khi merge.
