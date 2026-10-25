# GU v5.5.4 — Cloudinary Private Evidence (Firebase Spark compatible)

Ảnh CCCD/chứng từ cọc mới được lưu Cloudinary `authenticated`, không cần Firebase Storage. Xem `docs/GU-v5.5.4-CLOUDINARY-PRIVATE-EVIDENCE.md` để cấu hình và kiểm tra an toàn trước khi triển khai.

---

# GU v5.5.0 — AI Visual Search + Category Filter + VS Code Local

**Bản phát triển** từ GU v5.4.0 Hotfix. Chưa đưa vào ngân hàng tự động thu cọc hoặc chi hoàn cọc.

Đọc [hướng dẫn triển khai trên Windows và VS Code Local](docs/GU-v5.5.0-AI-VISUAL-SEARCH-VSCODE-LOCAL.md).

```powershell
npm install
npm run verify:release
npm run test
npm run typecheck
npm run build
npm run dev
```

---

> **GU v5.4.0 – Firestore Read Optimization:** Giảm Reads cho tra cứu lịch, ca nhân viên, Dashboard, công nợ, báo cáo. Trước khi đưa lên Production, xem [hướng dẫn GU 5.4](docs/GU-v5.4.0-FIRESTORE-OPTIMIZATION.md).

> **GU v5.3.0 Beta 1 — Đăng ký ca nhân viên:** Đăng ký Chủ nhật 12:00–20:00 cho tuần kế tiếp; 3 ca/ngày, 2 người/ca, ít nhất 5 ngày/tuần; nhân viên ngoài ca chỉ có quyền vào màn đăng ký, hết ca +15 phút tự đăng xuất. Trước khi deploy lên Vercel xem **[hướng dẫn chuyển đổi không khóa nhầm toàn bộ nhân viên](docs/GU-v5.3.0-CA-LAM-VIEC.md)**.

# GU v5.2.0-beta.1 · Full source cho GitHub Codespaces

Bản này kế thừa **toàn bộ mã nguồn GU v5.0.1 Patch 1** (không phải file sửa lẻ).

- Hint khách hàng hiện dưới textbox, không làm nhảy modal.
- Lịch hiển thị giờ giao → giờ nhận trước tên nhân viên.
- Đặt trước bắt buộc chụp chứng từ và xác nhận **đã nhận đủ 100% tiền thuê** khi tạo lịch; chưa cần chụp sản phẩm.
- Giao hàng mới chụp ảnh sản phẩm và (tùy chọn) ảnh CCCD/tiền/vật cọc, lưu riêng tư trên Storage.
- Trả hàng chụp đủ góc, giải phóng lịch/đưa kho về giặt ngay; Admin hậu kiểm ảnh mà không chặn cho thuê lại sau giặt.
- Popup vẫn mở sau nhận trả, tự tính số còn thu, có **Thu tiền**, **Thu đủ** và phụ thu khi cần; không yêu cầu chụp ảnh hoàn vật cọc.
- Có xác nhận trả lại vật cọc, hậu kiểm ảnh và hoàn tiền trước khi hủy đơn đã đặt cọc.

**LƯU Ý CẤU HÌNH MỚI:** Cần bucket Firebase Storage / Google Cloud Storage riêng tư và service account có quyền đọc/ghi, đặt `FIREBASE_STORAGE_BUCKET` trên Vercel. **Không** lưu ảnh CCCD trong Cloudinary công khai. Nếu chưa cấu hình Storage, không triển khai flow ảnh cọc này lên Production. Trước khi push Production phải kiểm tra build và chạy thử trên Firebase staging. Xem `docs/GU-v5.2.0-BETA1-CODESPACES.md`.

---

> **GU v5.0.1-patch.1:** Chi tiết bản vá, điểm chưa nghiệm thu và hướng dẫn triển khai an toàn tại [docs/GU-v5.0.1-PATCH1-SUA-LOI-VA-TRIEN-KHAI.md](docs/GU-v5.0.1-PATCH1-SUA-LOI-VA-TRIEN-KHAI.md).

## GU v5.0.0 Beta 11 — 1 nhân viên / 2 kích thước màn hình

- Đăng nhập tại `/` trên PC lẫn điện thoại; không còn `/mobile` và không tạo vai trò nhân viên riêng theo thiết bị.
- Tạo đơn → chụp ảnh ngay tại chi tiết đơn → nhận trả → chụp ảnh và gửi Admin duyệt; giao trước lịch chỉ khi đã giao hàng thực tế.
- Tìm tên không dấu ở mọi vị trí của tên sản phẩm: phải chạy `npm run data:index-names` (xem trước) và `npm run data:apply-names` (cập nhật index tên + search bigrams) sau khi backup.
- Cảnh báo màu cam sau 17:00 (giờ Việt Nam) khi có hàng chưa trả và đặt thuê ngày mai.
- Kiểm tra trên Codespaces với `npm run test`, `npm run typecheck`, `npm run build`; chưa push Production nếu còn lỗi.

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
