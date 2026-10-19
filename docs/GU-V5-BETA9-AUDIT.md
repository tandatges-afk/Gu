# GU v5 Beta 9 — kiểm tra UX/UI, tên sản phẩm, Firestore

## Truy vấn Firestore mã 0ff171b8
Mã gRPC 9 FAILED_PRECONDITION không tự chứng minh là thiếu chỉ mục. Mã cụ thể trong phản hồi Vercel Logs mới phân biệt được. API phân nhóm: `GU_DB_INDEX_REQUIRED`, `GU_DB_TRANSACTION`, hoặc `GU_DB_PRECONDITION`. **Không khẳng định đã hết lỗi cũ** nếu chưa tái hiện và xem log của dự án.

## Tên không trùng
Tất cả tên tạo/sửa dùng NFKD, bỏ dấu thanh, `đ`→`d`, chữ thường, ký tự dấu câu→khoảng trắng, gộp khoảng trắng. Khóa `productNameIndex/<encoded-key>` được đọc/ghi trong Firestore transaction. Trước khi dùng, chạy rà soát và migration, giữ nguyên dữ liệu cũ. Nếu cùng tên ở dữ liệu cũ: script báo những nhóm đó, Admin phải đổi thủ công.

## UX/UI 3 client
- Admin PC: nhóm Đơn hàng / Kho sản phẩm / Quản trị. Các trang review, công nợ, nhân viên, nhật ký, Cloudinary giữ riêng cho Admin.
- Nhân viên PC: nhóm Đơn hàng / Kho sản phẩm; không hiện menu quản trị.
- Nhân viên Mobile: `/mobile` biệt lập, hàng chờ giao-trả, chụp ảnh theo góc, tìm bằng ảnh; không thu tiền.
- Breakpoint 850px: thanh đáy của site chính chỉ hiện trên màn hình hẹp; thanh đáy nhân viên nằm riêng ở `/mobile`. PC sử dụng sidebar/top tab.
- Form thêm/sửa báo tên trùng ngay trong form (không thêm hint giải thích trên màn hình).

## Chưa được xác nhận
- Không có kết nối Firebase của cửa hàng để chạy E2E.
- Chưa có log Vercel của mã 0ff171b8.
- Kiểm thử responsive dựa vào CSS fixtures, không thay cho QA đăng nhập thật ba vai trò.
