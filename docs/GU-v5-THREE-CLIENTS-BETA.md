# GU v5.0.0-beta.1 — Ba client & quy trình có ảnh, 24 giờ

**Trạng thái:** BETA để kiểm thử; chưa đủ điều kiện tự động triển khai Production. Mã nguồn dựa trên GU v4.2.2. `npm run test` và kiểm tra cú pháp TypeScript đã chạy trong môi trường xây dựng; **chưa chạy được `npm run typecheck` và `npm run build` vì không tải được package npm**.

## 1. Ba giao diện và phân quyền

| Giao diện | Đường dẫn | Tài khoản Firestore staff.role | Quyền |
|---|---|---|---|
| Admin PC/mobile | `/` | `admin` | Toàn bộ kho, đặt lịch, tài chính, review ảnh, quản lý tài khoản và void đơn |
| Nhân viên PC | `/` | `staff` | Quản lý đơn, khách, kho theo quyền sẵn có, tìm ảnh, tạo đơn thuê 24 giờ |
| Nhân viên mobile | `/mobile` | `staff_mobile` | Chỉ tìm bằng ảnh và chụp/gửi ảnh giao/nhận; API server từ chối tạo đơn, thu tiền, hủy, sửa kho |

**Cần cấp tài khoản `staff_mobile` riêng trong Admin → Nhân viên.** Không bảo vệ bằng kích thước màn hình hay User-Agent; vai trò Firestore quyết định quyền server. Một nhân viên kiêm PC/mobile có thể cần hai tài khoản nếu muốn ràng buộc quyền thực sự.

## 2. Trình tự nghiệp vụ mới

1. Admin định nghĩa sản phẩm và các góc ảnh bắt buộc. Có thể đính kèm ảnh mẫu của từng góc. Mã sản phẩm tự động giữ nguyên.
2. Nhân viên PC tạo đơn. Chọn **giờ nhận**, **giờ trả**, khách và đồ. Máy chủ tính giá theo chu kỳ 24 giờ, khóa từng khoảng giờ bằng Firestore Transaction; dữ liệu ngày cũ được kiểm tra để tránh trùng.
3. `mobileJobs` xuất hiện cho nhân viên mobile (kiểm tra 8 giây/lần); popup nhận đơn và mở ảnh yêu cầu.
4. Mobile chụp đủ tất cả góc, tải ảnh lên Cloudinary, lưu bằng chứng với UID/tên nhân viên. Giao đồ được xác nhận sau khi đủ ảnh.
5. Khi khách trả, Mobile nhìn thấy ảnh khi giao, chụp lại các góc, ghi tình trạng, gửi **chờ duyệt**. Tình trạng kho vẫn là đang cho thuê cho đến khi Admin duyệt.
6. Admin vào **Duyệt ảnh giao nhận**, so sánh ảnh hai thời điểm, thấy người giao/người nhận, thêm phụ phí (nếu có), duyệt. Tiền thuê thực tế tính từ giờ bắt đầu đến thời điểm nhân viên mobile gửi ảnh nhận.
7. Sau duyệt, đồ đủ quay về Đang giặt nếu cần giặt; đồ không cần giặt quay về Sẵn sàng; đồ thiếu thành Thất lạc. Các khóa giờ được giải phóng.
8. Admin có quyền **xóa đơn** (VOID, giữ dấu vết): chỉ khi đã đối chiếu thực tế tất cả đồ sạch và chưa có tiền thu. Đồ được chuyển về Sẵn sàng không cần nút Đã giặt; không áp dụng xóa ngầm vào đơn đã thu tiền.

## 3. Bảng giá chung

Mỗi chu kỳ bắt đầu khi đã vượt mốc bội số 24 giờ: tối đa 24 giờ là ngày 1, hơn 24 giờ là ngày 2. Ngày 1, 5, 10, 15, 20, 25, 30 cộng 50.000đ cho quần áo hoặc 20.000đ cho phụ kiện; những ngày khác cộng 10.000đ.

| Ngày thuê | Quần áo | Phụ kiện |
|---|---:|---:|
| 1 | 50.000đ | 20.000đ |
| 4 | 80.000đ | 50.000đ |
| 5 | 130.000đ | 70.000đ |
| 10 | 220.000đ | 130.000đ |
| 30 | 580.000đ | 370.000đ |

Đơn **cũ** không bị tự định giá lại và vẫn đi theo quy trình cũ. Cơ chế mới áp dụng cho **đơn tạo từ v5** (`pricingVersion='GU_HOURLY_V1'`). Không tự dịch chuyển hay nhân đôi khóa lịch cũ.

## 4. Hạn chế chưa được triển khai hoàn chỉnh

- **AI thực thụ chưa triển khai:** tìm ảnh hiện sử dụng đối chiếu màu và bố cục ảnh trong trình duyệt với tối đa **150 sản phẩm** (3 trang × 50) để tránh đọc toàn bộ kho và phát sinh phí. Chưa phù hợp để nhận diện chính xác giữa 2.000 bộ đồ tương tự nhau. Cloudinary Visual Search yêu cầu gói Enterprise; cần thêm giải pháp **image embeddings/CLIP + chỉ mục vector** khi chọn dịch vụ và chi phí.
- **Cloudinary bằng chứng đang dùng đường dẫn ảnh có thể truy cập nếu biết URL.** Chỉ thử với ảnh đồ vật không chứa mặt người hoặc thông tin riêng tư. Trước Production nên chuyển sang lưu ảnh riêng tư kèm URL có hạn sử dụng/quyền xem trên máy chủ.
- Chưa có hệ thống lưu trữ dài hạn và tự chuyển/chuyển/xóa ảnh chứng cứ. Cần xác nhận thời hạn lưu và nơi lưu trước khi dùng cho 40–50 đơn/ngày; Cloudinary Free 25 credits không phù hợp giữ vô hạn số ảnh này.
- Chưa kiểm thử tích hợp thật với Firebase Emulator, Cloudinary/Vercel hoặc `next build`. Không bật trên Production trước khi qua UAT và backup.
- Một lần tạo đơn/đợt thêm giới hạn **12 sản phẩm** và 300 tài liệu khóa ngày/giờ trong giao dịch để tránh lỗi kích thước và giới hạn Firestore. Nếu cần không giới hạn sản phẩm mỗi đơn, cần thiết kế lại cấu trúc khóa giao dịch.
- Đơn quá **30 chu kỳ 24 giờ** chưa có biểu giá nên API không tự chốt. Các đơn trả vượt 30 ngày cần chính sách riêng. Hoàn tiền khi trả sớm và đã thu vượt tiền thực tế hiện cần đối soát thủ công.
- Lịch cũ có giao diện 7 ngày; lịch mới hiển thị số lượt trong cùng ngày và chi tiết giờ khi mở, nhưng chưa có chế độ timeline 24 giờ đầy đủ.
- Trường hợp đổi tài khoản `staff_mobile` cho tài khoản `staff` cũ chưa có màn hình đổi quyền trực tiếp; hãy cấp tài khoản mobile riêng qua Admin.

## 5. Triển khai an toàn trên Codespaces

**Không triển khai beta trực tiếp vào Firebase sản xuất.** Dùng Firebase test/staging với cấu hình Cloudinary test riêng nếu có thể. Trước mọi thay đổi, sao lưu Firestore và lưu nhánh `main`.

```bash
cd /workspaces/Gu
git status
git switch main
git pull --ff-only origin main
git switch -c test/gu-v5-three-clients
# Upload GU-v5.0.0-beta.1-THREE-CLIENTS-FULL.zip vào Codespaces
mkdir -p /tmp/gu-v5
unzip -q GU-v5.0.0-beta.1-THREE-CLIENTS-FULL.zip -d /tmp/gu-v5
SRC=/tmp/gu-v5/GU-v5.0.0-beta.1
for dir in src public tests scripts docs; do mkdir -p "$dir"; rsync -a --delete "$SRC/$dir/" "$dir/"; done
cp "$SRC/package.json" "$SRC/tsconfig.json" "$SRC/next.config.ts" "$SRC/next-env.d.ts" "$SRC/firebase.json" "$SRC/firestore.rules" "$SRC/.gitignore" "$SRC/.env.example" "$SRC/README.md" .
nvm install 22
nvm use 22
npm install
npm run verify:release
npm run test
npm run typecheck
npm run build
npm run dev
```

Nếu thành công và đã kiểm thử nghiệp vụ bằng dữ liệu giả trên staging:

```bash
rm -f GU-v5.0.0-beta.1-THREE-CLIENTS-FULL.zip
git add -A
git diff --cached --check
git diff --cached --name-only
# Không commit .env.local, dữ liệu sao lưu, credentials, ảnh nhạy cảm.
git commit -m "Beta GU v5 three clients hourly rental and photo review"
git push -u origin test/gu-v5-three-clients
```

Vercel Preview cho nhánh test. Chỉ sau khi kiểm tra Cloudinary và ảnh riêng tư, nghiệp vụ, Firebase quota, mới merge sang nhánh `main`.

## 6. Danh sách kiểm thử UAT bắt buộc

- Staff mobile đăng nhập: chỉ thấy Tìm bằng ảnh, Giao & nhận; mọi endpoint legacy tạo đơn/thu tiền/xóa phải HTTP 403.
- Staff PC tạo đơn 09:00 hôm nay → 09:00 ngày mai: 50k quần áo, 20k phụ kiện; 09:01 ngày mai tăng 10k mỗi loại.
- V5 giữ hai khoảng thuê cùng ngày không trùng, chặn khoảng giao nhau; V5 phải nhận thấy khóa từ đơn v4 cũ, V4 gia hạn/thêm đồ phải thấy khóa V5.
- Admin gắn đúng số góc chụp/ảnh mẫu; nhân viên không giao được nếu thiếu ảnh.
- Nhân viên mobile khác nhân viên tạo đơn cũng có thể giao/nhận; ghi UID và họ tên từng người ở log, review.
- Đơn thêm sản phẩm sau khi giao đòi mobile chụp ảnh bổ sung trước khi dùng sản phẩm đó.
- Trả thiếu món có ghi chú, Admin thấy bằng chứng và giá đền bù.
- Trả trễ 25 giờ được tính tổng mức mới từ thời gian thực; tiền đã thu không bị cộng lại phí trễ một lần nữa.
- Khi Admin VOID đơn chưa thanh toán, chỉ sau khi xác nhận hàng sạch, tất cả khóa được gỡ và món của đơn đó sang AVAILABLE.
- Khi đã thu tiền, VOID phải bị chặn cho đến khi xử lý hoàn tiền.
- Ảnh không được chứa khách hàng, thông tin cá nhân hoặc dữ liệu nhạy cảm trong môi trường thử nghiệm.

### Chính xác giờ bắt đầu tính tiền
Đối với đơn mới, thời gian thuê thực tế bắt đầu tại `handoverProof.at` — lúc nhân viên Mobile đã chụp đủ và xác nhận giao. Lúc duyệt nhận, tiền từng sản phẩm được tính từ `line.startAt` (giờ giao thực tế của sản phẩm, gồm cả sản phẩm giao bổ sung) đến `returnProof.at`. Giờ nhận đã đặt lúc PC tạo đơn được dùng để **giữ lịch dự kiến**; nếu giao muộn hơn giờ đặt, hai mốc có thể khác nhau. Khi giao quá giờ trả đã đặt, Mobile phải yêu cầu PC cập nhật lịch trước khi bàn giao. Trường hợp khách ở quá giờ trả đặt vẫn cần xử lý xung đột với đơn tiếp theo bằng quy trình thủ công trong bản beta.
