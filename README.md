# GU v5 Beta 10 — Firestore index diagnostics + responsive actions

Bản phát hành kế thừa Beta 9, loại bỏ hai cách sắp xếp danh sách dùng document ID tường minh có nguy cơ yêu cầu composite index, bổ sung tên endpoint vào lỗi Firebase, chuẩn hóa bố cục nút Admin PC / Nhân viên PC / Nhân viên Mobile. Đính kèm hướng dẫn Word 12 hình minh họa tại `docs/GU-v5-Beta10-Huong-Dan-Co-Hinh-Anh-Admin-Nhan-Vien.docx`. Xem `docs/GU-v5-BETA10-INDEX-AND-UI.md` trước khi đẩy Production.

**Không thay đổi cơ sở dữ liệu, không xóa dữ liệu và không chạy migration** để chữa lỗi này. Nếu còn `GU_DB_INDEX_REQUIRED`, bắt buộc cần Vercel Logs để lấy đúng composite index do Google chỉ định. Đây vẫn là bản Beta cần kiểm thử tích hợp.

---

# GU - Thuê đồ xinh | v5.0.0-beta.10

## Ba giao diện
- Admin PC: quản trị sản phẩm, góc chụp, nhân viên, công nợ, duyệt ảnh giao/nhận, nhật ký và Cloudinary.
- Nhân viên PC: khách hàng, kho, lịch, tạo đơn, tìm bằng ảnh, các thao tác được server phân quyền.
- Nhân viên Mobile (`/mobile`): nhận việc, chụp ảnh giao/nhận, tìm sản phẩm bằng ảnh. Không có tạo đơn hay thu tiền.

## Nâng cấp Beta 9
- Tránh trùng tên sản phẩm bất kể dấu tiếng Việt, chữ hoa/thường, dấu câu và khoảng trắng; kiểm tra trong giao dịch Firestore (`productNameIndex`).
- Dữ liệu trước Beta 9 cần chạy `npm run data:index-names` rồi `node --experimental-strip-types --env-file=.env.local scripts/migrate-product-names.mjs --execute --confirm=INDEX-<FIREBASE_PROJECT_ID>` **trên cùng Firebase của Vercel** trước khi cho nhân viên thêm/sửa sản phẩm.
- Mặc định migration chỉ **rà soát**, không tự đổi tên hay xóa dữ liệu. Các tên trùng cũ được liệt kê và có thể đổi thủ công tại Kho. Sao lưu trước migration.
- Phân biệt Firestore FAILED_PRECONDITION: chỉ báo thiếu index nếu chính Google chỉ ra thiếu index. Mã sự cố cần xem log Vercel.
- Sắp lại menu và bố cục PC/Admin/Mobile, khống chế bottom nav không hiển thị sai kích thước.

## Kiểm thử và triển khai
```bash
nvm use 22
npm install
npm run verify:release
npm test
npm run typecheck
npm run build
npm run data:index-names
```

Dùng nhánh thử nghiệm và Firebase staging trước khi cập nhật Production. Không commit `.env.local`, private key, backup hoặc ZIP.
Bản sao lưu và index bắt buộc xử lý riêng trên Production, không được làm tự động chỉ bằng `git push`.

**Firebase vẫn là cơ sở dữ liệu chính**. GU Admin chỉ giữ thống kê Cloudinary. Bản này chưa tự xác nhận được lỗi 0ff171b8 nếu thiếu log máy chủ.

Xem tài liệu Word GU v5 Beta 9 để biết toàn bộ quy trình Admin, PC và Mobile.
