# GU v5.3.5-beta.1 — Image index, inventory, quick customer, payment, responsive modules

## Phạm vi bản cập nhật

- **Tìm ảnh gần đúng:** lưu đặc trưng ảnh gồm histogram màu, độ sáng bốn góc và gradient hash cho ảnh đại diện sản phẩm. Mỗi lần tìm đọc *chỉ mục số nhỏ* (tối đa 150 mục/lượt phân trang, cache 5 phút trong phiên) rồi chỉ tải chi tiết 12 kết quả gần nhất. Không tải toàn bộ ảnh kho mỗi lượt. Hệ thống này là so khớp gần đúng, **không phải model AI/CLIP**, nên có thể lệch khi góc chụp, ánh sáng hoặc nền thay đổi nhiều. Nhân viên luôn phải xác nhận bằng mã móc/sản phẩm.
- Sản phẩm mới / sửa sản phẩm: trình duyệt tạo đặc trưng khi lưu nếu có thể đọc ảnh Cloudinary (CORS). Nếu thất bại, sản phẩm vẫn lưu và Admin có thể lập chỉ mục sau.
- **Ảnh cũ**: Admin mở `Tìm bằng ảnh` → `Lập chỉ mục ảnh cũ` một lần. Chạy từng nhóm tối đa 12 ảnh/lượt, hiển thị tiến độ và số ảnh thất bại. Không ghi đè hình gốc, không thay đổi mã sản phẩm. Làm trong giờ vắng khách để giảm sử dụng Firebase reads/writes và Cloudinary CDN. Có `Làm mới chỉ mục` để đọc data mới ngay.
- **Kho**: lọc danh mục/tình trạng ở phía API thay vì lọc mỗi 40 dòng đã tải, giữ phân trang theo cursor đã quét, tách `GuInventoryFilters` và giao diện kho mobile dạng card bằng CSS module.
- **Khách nhanh**: số điện thoại được kiểm tra với phoneIndex trong transaction tạo đơn. Nếu trùng sẽ dùng hồ sơ đã có, nếu giao dịch đơn lỗi thì không tạo khách mới. Có script backfill phoneIndex chỉ đọc theo mặc định.
- **Thanh toán**: thống nhất UI `GuOrderPaymentPanel` ở chi tiết đơn và popup nhận trả; chọn tiền mặt/chuyển khoản, xác nhận mã chuyển khoản, `requestId` chống ghi trùng trên Firestore. Tiền thu không vượt số phải thu; dư được báo chờ Admin hoàn/đối soát, không tự ghi là phụ thu. Đơn đặt trước nếu thay đổi tiền do thêm đồ/gia hạn, bắt buộc ảnh thanh toán và xác nhận thu chênh; khóa lịch + dòng tiền cùng Firestore transaction. `bookedRentTotal` cập nhật để trả đúng hạn không tính lại phí cũ.
- **UI**: phần ảnh, bộ lọc kho, thanh toán tách module CSS riêng, không thêm chuỗi override `globals.css`. Các khu vực cũ khác chưa được tái cấu trúc toàn diện.

## Thực hiện trên Codespaces

1. Commit/backup source đang chạy và **sao lưu Firestore** trước khi áp dụng. Dùng Node **22.x**, không commit `.env.local` hoặc khóa Firebase.
2. Giải nén bản FULL zip vào thư mục gốc repository.
3. `npm install && npm run verify:imports && npm run verify:release && npm test && npm run typecheck && npm run build`.
4. Deploy Vercel Preview, chạy thủ công các kịch bản dưới đây với Firebase staging. Chỉ push nhánh Production sau khi đã được xác nhận.

## Đồng bộ SĐT khách cũ (chỉ khi cần)

```bash
npm run data:phone-index-plan
# Nếu phát hiện các nhóm trùng, Admin đối chiếu rồi xử lý thủ công.
# KHÔNG chạy lệnh thực thi khi còn nhóm trùng.
node --experimental-strip-types --env-file=.env.local scripts/migrate-customer-phone-index.mjs --execute --confirm=PHONES-<FIREBASE_PROJECT_ID>
```

Thay `<FIREBASE_PROJECT_ID>` bằng ID dự án thực tế, không có dấu `<` hoặc `>`. Không tạo/xóa hồ sơ khách trong lúc migration chạy. Trên Firebase Spark, batch kiểm tra nhiều khách có thể tiêu tốn hạn mức đọc — lên lịch ngoài giờ.

## Checklist staging bắt buộc

1. **Ảnh:** Admin lập chỉ mục ảnh cũ, tìm đúng ảnh, ảnh màu gần giống, ảnh ánh sáng khác; kiểm tra 12 kết quả, màu trạng thái và lịch 7 ngày; tải lại tab, nhấn `Làm mới chỉ mục`, sửa hình sản phẩm và tạo lại dấu vân tay.
2. **Kho:** Mã `GU-00002`, `00002`, `00`; lọc danh mục, trạng thái, chuyển trang 40 món, lưu trữ sản phẩm; thử trên 320/375/390/768/1024/1440px. Đảm bảo tổng số toàn kho khác nhãn `đang hiển thị`.
3. **Khách:** Hai nhân viên đồng thời tạo đơn qua cùng SĐT mới; dự kiến chỉ 1 hồ sơ khách. Thử tạo đơn với lịch bị chiếm: không thêm khách rác. Thử hồ sơ cũ dạng `+84`, `84`, `0`.
4. **Thu tiền:** Thu đủ, thu một phần, bấm hai lần và retry requestId cũ. Kiểm tra sổ `cashMovements`, `cashDaily`, `debtLedger` không nhân đôi. Chuyển khoản yêu cầu mã tham chiếu. Kiểm tra trả đúng hạn đã thanh toán, phụ thu đúng lý do, hoàn dư Admin.
5. **Đặt trước:** Thu trước 100%, thêm món/gia hạn → thu chênh với ảnh mới → giữ lịch và ghi sổ. Nếu trùng lịch, chứng từ không được đánh dấu đã dùng và không ghi doanh thu. Trả sớm/đúng hạn không mất giá thuê đã chốt.
6. **PC/mobile:** kiểm tra popup nhập SĐT, tìm sản phẩm, đối soát sau trả, không bị tràn khung/nút bị che, điều hướng ca sau khi hết giờ, thao tác lại khi mạng mất.

## Giới hạn chưa xác minh

- Không có kiểm thử truy cập **Firebase staging thật**, Vercel deployment hay E2E Safari/Chrome trong môi trường xây dựng của trợ lý. Không coi 100% unit tests là chứng nhận Production.
- So khớp ảnh hiện là fingerprint, không nhận diện đồ vật theo ngữ nghĩa bằng neural embedding. Nếu cần nhận đồ rất giống nhưng chụp nhiều góc/nền khác biệt, nâng cấp tiếp sang model embedding do nhà cung cấp AI xử lý và lưu vector riêng.
- Lọc kho vẫn dùng cursor và quét có giới hạn mỗi request để kiểm soát chi phí Firestore; với kho cực lớn, cần chỉ mục kết hợp và cơ chế phân trang chuyên dụng.
