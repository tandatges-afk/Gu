# GU - Thuê đồ xinh — Bản mã nguồn đầy đủ v4.1.4

**Hướng dẫn nâng cấp từ bất kỳ phiên bản cũ nào:** [`docs/HUONG-DAN-CAI-DAT-BAN-TOAN-BO.md`](docs/HUONG-DAN-CAI-DAT-BAN-TOAN-BO.md). Không cần tải/ghép các bản vá 2.x, 3.x, 4.0 hay 4.1.1.

Lệnh kiểm tra đồng bộ: `npm run verify:release`; kiểm thử: `npm run test`; trước khi deploy: `npm run typecheck && npm run build`.

---

## GU v4.1.4 — UX/UI dễ phân biệt & công nợ theo khách

- Bộ màu có độ tương phản cao: trống xanh lá, giữ chỗ cam, đang thuê xanh dương, đang giặt tím, thiếu/trễ đỏ, bảo trì xám.
- Chọn sản phẩm có viền xanh đậm, nền xanh rõ và nhãn **Đã chọn** (không chỉ đổi sắc độ nhẹ).
- Menu chia nhóm Công việc / Kho & vận hành / Admin; hành động phụ trong kho gộp dưới **Khác**; bỏ danh sách giặt trùng lặp khỏi trang Đơn thuê.
- **Admin → Công nợ:** biết ai còn nợ, số điện thoại, từng mã đơn, số phải thu/đã thu/còn nợ và nút mở đơn/gọi khách.
- Đơn **Đặt trước** chưa giao là **Dự kiến thu**, không trộn vào công nợ thực tế; đơn đã giao hoặc đã trả nhưng thiếu tiền mới tính công nợ.
- Công nợ quét lịch sử nhiều trang trên Firestore (không chỉ 300 đơn bootstrap). Nếu vượt ngưỡng 10.000 đơn, hệ thống báo lỗi thay vì hiện số tổng sai.
- Gọi lại GET từng đơn lịch sử cho Admin để xem/thu tiền được cả các đơn đã ra khỏi danh sách 300 đơn mới nhất.

Hướng dẫn nâng cấp và kiểm thử: [`docs/CHANGELOG-v4.1.4.md`](docs/CHANGELOG-v4.1.4.md).

---

# GU v4.1.2 — Kiểm đồ trước, tính tiền sau

Xem [`docs/CHANGELOG-v4.1.2.md`](docs/CHANGELOG-v4.1.2.md) và [`README-v4.1.2.md`](README-v4.1.2.md) để cập nhật an toàn.

---

## GU v4.1.1 — Mã sản phẩm tự động, không nhập tay

Mỗi món đồ thật có mã sản phẩm riêng `GU-00001`, `GU-00002`… Mã xuất hiện trong Kho, Lịch, Tạo đơn, Chi tiết đơn, Nhận trả và Giặt. Mã không chỉnh sửa được trong form. Giữ mã trên móc cố định cho đúng món; trường hợp khách chỉ mang áo về mà không mang móc, phải có quy trình đối chiếu trước khi giao và khi trả vì móc riêng không tự chứng minh danh tính của quần áo.

**Kho cũ:** Admin → Kho sản phẩm → **Cấp mã cho đồ cũ**. Mỗi lần cấp tối đa 25 món, lặp lại nếu còn. Không xóa hay tạo lại món cũ. Chuẩn bị nhãn và ghi lên móc đúng theo dòng trong kho. Bộ đếm được tăng trong Firestore transaction; không nhập/sửa thủ công document `inventoryCounters/hanger`.

Tài khoản Firebase, Cloudinary và dữ liệu thuê được giữ nguyên. Trước khi merge, chạy `npm run test`, `npm run typecheck`, `npm run build` và thử tạo hai sản phẩm cùng lúc trên Firebase thử nghiệm để xác nhận bộ đếm phân phối mã đúng. Không thực hiện cấp mã kho cũ cho đến khi đã sao lưu dữ liệu Firestore.

---

# GU v4.1 — Smart Rental Calendar

**Bản nâng cấp từ GU v4.0.1:** tìm đồ trống theo ngày qua Firestore `rentalSlots`, ngày trống gần nhất, gọi khách (`tel:`), Việc hôm nay, lọc trạng thái lịch và sửa kích thước ô lịch desktop/mobile. **Không cần thay đổi Firebase `gugu-547e3` hoặc Cloudinary.**

Xem [CHANGELOG v4.1](docs/CHANGELOG-v4.1.0.md) để biết giới hạn và các thao tác mới.

## Cập nhật an toàn trong GitHub Codespaces

```bash
cd /workspaces/Gu
git status
# Commit hoặc lưu các sửa đổi chưa hoàn thành rồi mới tạo nhánh
git switch -c gu-v4.1-calendar
# Upload GU-v4.1-Smart-Calendar-Patch.zip vào /workspaces/Gu
unzip -q GU-v4.1-Smart-Calendar-Patch.zip -d /tmp/gu-v41
cp -a /tmp/gu-v41/. .
npm install
npm run test
npm run typecheck
npm run build
npm run dev
```

Kiểm tra các ca: tìm khoảng 1 ngày, tìm nhiều ngày, đặt trùng cùng sản phẩm, tìm ngày trống kế tiếp, lọc từng trạng thái, các liên kết gọi điện trên iPhone/Android, Việc hôm nay, và desktop/mobile. Chỉ sau khi build và kiểm thử thành công mới push nhánh, mở PR xem Vercel Preview, rồi merge vào `main`.

**Bảo mật:** không commit `.env.local`, Firebase Service Account JSON, API Secret hoặc file ZIP chứa chúng.

---

# GU - Thuê đồ xinh v4.0.1

**Phiên bản tổng hợp nâng cấp trực tiếp từ GU v3.0.1.** Next.js 16 + TypeScript + Firebase Authentication/Firestore + Cloudinary + PWA. Không dùng Firebase Storage và không cần tạo lại Firebase Project `gugu-547e3`.

> Đây là **bộ mã nguồn có thể chạy và kiểm thử**, chưa phải thay đổi đã tự động đưa lên website của cửa hàng. Bản nâng cấp cần chạy `npm run typecheck` và `npm run build` trên Codespaces, thử với dữ liệu mẫu trên Preview trước khi merge vào production. Việc chạy test logic không thay thế kiểm thử Firestore transaction thực tế.


## Bản sửa v4.0.1 — Lịch thuê gọn hơn

- Desktop: nút trạng thái ngày là **ô vuông tối đa 72 × 72 px**, được căn giữa cột ngày; không còn phình theo chiều rộng màn hình.
- Điện thoại: ô ngày **80 × 80 px** (màn nhỏ tối đa 380px: **74 × 74 px**), vẫn có thể vuốt ngang.
- Ảnh sản phẩm, ảnh bìa và thư viện tiếp tục giữ khung **1:1**.
- Không sửa dữ liệu Firestore, Cloudinary hoặc logic tạo đơn, đặt trước, trả hàng, tính phụ thu.
- Service Worker đổi bộ nhớ đệm sang `gu-static-v4-0-1`.
- Bản vá được đóng gói riêng; chỉ nâng từ v4.0. Không chép các bản vá v2.3 vào dự án đã nâng v4.

### Cập nhật bản vá trên Codespaces

Trong `/workspaces/Gu`, trên một nhánh thử nghiệm đã lưu các thay đổi hiện tại, upload `GU-v4.0.1-Compact-Calendar-Patch.zip`, rồi chạy:

```bash
mkdir -p /tmp/gu-v401-patch
unzip -q GU-v4.0.1-Compact-Calendar-Patch.zip -d /tmp/gu-v401-patch
cp -a /tmp/gu-v401-patch/. .
npm install
npm run test
npm run typecheck
npm run build
```

Chỉ push/merge lên Vercel sau khi `typecheck` và `build` đều hoàn thành; làm mới PWA trên điện thoại nếu vẫn thấy CSS cũ.

## Tính năng trong v4.0

### Nâng cấp mới so với v3.0.1

1. **Bỏ hoàn toàn trạng thái "Chờ giặt"**. Chỉ có **Đang giặt**. Khi nhân viên hoàn thành checklist và nhận trả đồ, mỗi sản phẩm có cờ *Yêu cầu giặt sau thuê* lập tức trở về kho với trạng thái `LAUNDRY`. Nếu không yêu cầu giặt → `AVAILABLE`; nếu checklist báo thiếu → `MISSING` (ưu tiên cao nhất). **Không phải lúc vừa giao hàng**; trong thời gian khách giữ đồ sản phẩm vẫn là `RENTED`. Cả Admin và nhân viên đều có thể nhấn **Đã giặt** để chuyển `LAUNDRY → AVAILABLE`.
2. **Khóa trạng thái giặt ở máy chủ**. Không cho tự đổi sang `LAUNDRY` từ combobox; chỉ quy trình nhận trả cập nhật tự động. Không cho giao đồ vẫn ở trạng thái giặt, kể cả khi đã có lịch đặt trước.
3. **Gia hạn ngày trả trong chi tiết đơn** cho đơn `RESERVED` hoặc `PICKED_UP`, tối đa 30 ngày từ ngày nhận. Mỗi ngày mới được khóa bởi Firestore transaction, kiểm tra xung đột với đơn khác trước khi sửa đơn. Mọi ngày thuê thêm đều tăng giá theo đơn giá chốt của các món trong đơn; ghi lại người thao tác, số ngày và khoản tiền tăng trong lịch sử/audit.
4. **Không gia hạn hồi tố đơn đã quá hạn**. Phải thực hiện nhận trả và áp dụng phí trễ; không cho sửa ngày để lách phụ thu. Đơn hoàn thành/hủy không được gia hạn.
5. **Đếm số món đang giặt trong dashboard**. Các nhãn giặt trên trang Đơn, Giặt và Chi tiết đơn được đồng bộ thành "Đang giặt".
6. **Tối ưu gia hạn trên điện thoại**: chọn ngày trả mới bằng ô lịch, xem trước tiền tăng, nút xác nhận lớn và không cho chọn ngày vượt quá giới hạn. Giữ layout lịch mobile và khung ảnh vuông 1:1 từ v3.0.1.
7. **PWA cache version mới** để tránh còn giao diện cũ sau nâng cấp.

### Kế thừa từ v3.x

- Đăng nhập, phân quyền Admin/nhân viên, nhật ký thao tác.
- Danh mục, sản phẩm, giá thuê, định giá đền bù, Cloudinary, chọn nhiều ảnh từ thư viện hoặc chụp camera (tùy thiết bị/trình duyệt), ảnh vừa khung 1:1.
- Tìm khách bằng điện thoại; tạo khách ngay trên form; tạo đơn giao ngay hoặc giữ lịch; thêm sản phẩm vào đơn; chống trùng lịch tại máy chủ.
- Checklist nhận lại đủ/thiếu, phí đền bù, phụ thu trễ, thu tiền theo giao dịch, báo cáo Admin, lịch thuê mobile vuốt ngang.
- PWA cài vào màn hình chính, giao diện Mobile First; tuyệt đối không tạo/đổi đơn khi offline.

### Những việc chưa có trong bản này

- Không có Web Push **nền 24/7** khi mọi trình duyệt đều đóng; cảnh báo trong web và thông báo trình duyệt đang mở tiếp tục dùng như v3.x.
- Chưa có hoàn cọc tự động, quản lý thu chi kế toán đầy đủ, cập nhật đa chi nhánh, QR hay app native App Store/Google Play.
- Chưa có gia hạn "đổi sản phẩm" đồng thời; nghiệp vụ **thêm món** đã có từ trước.
- Chưa có phân trang truy vấn trên 300 đơn gần nhất; báo cáo lịch sử lớn cần nâng tiếp trước khi dùng cho đối soát toàn bộ năm.

## Nâng cấp trên GitHub Codespaces

**Ưu tiên dùng một bản nguồn đồng bộ, không chép các bản vá TypeScript rời từ 2.3 vào v4.0 nữa.**

1. Vào `/workspaces/Gu`, chạy `git status`. Nếu có thay đổi chưa commit, hãy commit hoặc stash chúng trước. Tạo nhánh từ `main` mới nhất:

   ```bash
   cd /workspaces/Gu
   git switch main
   git pull --ff-only origin main
   git switch -c gu-v4-upgrade
   ```

2. Tải ZIP `GU-Thue-Do-Xinh-v4.0-Full.zip` vào thư mục `/workspaces/Gu`. Chạy:

   ```bash
   mkdir -p /tmp/gu-v4-source
   unzip -q GU-Thue-Do-Xinh-v4.0-Full.zip -d /tmp/gu-v4-source
   cp -a /tmp/gu-v4-source/GU-Thue-Do-Xinh-v4.0/. /workspaces/Gu/
   ```

   Lệnh `cp` ghi đè file trùng tên trong mã nguồn. Không ghi đè `.env.local` (ZIP không chứa file này). Nếu bạn có thay đổi riêng, so sánh `git diff` trước khi commit.

3. Trong Codespaces, chạy:

   ```bash
   npm install
   npm run test
   npm run typecheck
   npm run build
   npm run dev
   ```

4. Ở Port 3000 **Private**, thử với đơn/sản phẩm mẫu và tài khoản nhân viên + Admin trước. Đặc biệt:
   - Tạo đơn 1 ngày, trả đủ đồ bật giặt → trạng thái `LAUNDRY` ngay sau khi hoàn thành nhận trả.
   - Bấm **Đã giặt** → `AVAILABLE` cả ở Kho và Lịch.
   - Trả thiếu → `MISSING` và phí đền bù, không vào giặt.
   - Gia hạn 1–2 ngày với lịch trống → khóa ngày mới và cộng tiền.
   - Gia hạn gặp ngày của đơn khác → 409, lịch và tiền đơn **không đổi**.
   - Đơn quá hạn → không được gia hạn hồi tố; vẫn tính phụ thu trễ khi trả.
   - Kiểm tra giao diện Lịch trên màn hình điện thoại nhỏ (375px), ảnh vuông và thanh bottom navigation.
   - Đơn đã hoàn thành không hiện ở danh sách nhân viên nhưng Admin xem được.

5. Khi test/typecheck/build thành công, kiểm tra file commit:

   ```bash
   git status
   git add src public tests scripts package.json tsconfig.json next.config.ts README.md firebase.json firestore.rules .env.example .gitignore
   git diff --cached --check
   git diff --cached --name-only
   git commit -m "Upgrade GU to v4.0 and automate laundry after return"
   git push -u origin gu-v4-upgrade
   ```

   **Không đưa `.env.local`, Service Account JSON hoặc file chứa API secret vào Git.** Không cần commit tệp ZIP.

6. Mở Pull Request `gu-v4-upgrade` → `main`. Test trên **Vercel Preview** trước, nếu mọi thao tác chính hoạt động đúng thì mới merge vào `main` để cập nhật production. Giữ một commit/tag v3.0.1 để có thể rollback frontend nếu cần.

## Trạng thái kiểm thử tại thời điểm đóng gói

- `npm run test`: **46/46 pass** (logic + kiểm tra đặc tả giao diện/API)
- TypeScript parser: **44 file .ts/.tsx không có lỗi cú pháp**.
- `npm install`: **không hoàn tất ở môi trường đóng gói**, npm registry không phân giải được tên miền (`EAI_AGAIN`). Do đó **`npm run typecheck` và `npm run build` chưa được xác nhận**; phải chạy trên Codespaces.
- **Chưa chạy Firebase Emulator hoặc Firestore/Cloudinary thật**. Việc khóa lịch bằng transaction cần được thử với dữ liệu mẫu trước khi vận hành.

## Quy tắc nghiệp vụ gia hạn

- Hẹn trả cũ 20/10, gia hạn đến 22/10, giá đã chốt mỗi món 300.000đ/ngày → tăng **2 × 300.000 = 600.000đ** đối với món đó.
- Ngày cuối thuê mới được lưu, tổng giá thuê và từng dòng sản phẩm được cập nhật. Ngày thuê đã có khóa vẫn được giữ; ngày mở rộng khóa thêm trong **cùng Firestore transaction**. Với đơn đời cũ có `bufferDays`, bộ khóa cũ được tôn trọng để không xung đột với chính nó.
- Ngày đã quá hạn không thể gia hạn: nhận trả và tính tiền trễ theo số ngày quá hẹn.

## Bảo mật & vận hành

- Firebase Project ID: `gugu-547e3`; ảnh Cloudinary không cần Firebase Storage Blaze.
- Giữ nguyên 10 biến trong `.env.local` và Vercel Environment Variables; không có biến mới cho v4.0.
- Tài khoản nhân viên cần quyền `staff` để tạo đơn, nhận trả, giặt và gia hạn; Admin xem nhật ký. Mọi gia hạn qua API được ghi log.
- Vì sao cần kết nối mạng: nếu lưu đơn offline, hai nhân viên có thể giữ lịch một bộ đồ cùng ngày; GU chỉ ghi xác nhận thuê khi Firestore đã lưu thành công.


## GU v4.1.4 — Lịch thuê theo nhân viên, mã sản phẩm, giao diện gọn

- Nhân viên tạo đơn được máy chủ xác định từ Firebase Authentication (`staffUser`), lưu `createdBy` (UID) và `createdByName` (tên tại thời điểm lập). Không lấy người tạo từ biểu mẫu client.
- Lịch trên desktop và điện thoại hiển thị người tạo từng đơn; Admin lọc sản phẩm có lịch do nhân viên được chọn tạo, click ô để xem tên đầy đủ trong chi tiết đơn. Xuất CSV có thêm cột nhân viên tạo.
- Đơn cũ: ưu tiên tra cứu nhân viên qua UID còn lưu trong Firestore. Nếu hồ sơ nhân viên không còn, GU hiển thị “Chưa rõ nhân viên” thay vì đoán.
- Đổi tất cả nhãn hiển thị “mã móc” thành “mã sản phẩm”, nhưng giữ giá trị và trường Firestore `hangerCode`, đường dẫn API `items/hanger-codes` để không mất mã đang dùng hay ảnh hưởng đơn cũ. Không có hành động đổi mã hàng loạt.
- Bỏ `gu-smart-hint` và các đoạn văn nhắc quy trình không cần thiết. Vẫn giữ các thông báo lỗi, xác nhận thanh toán, và tình trạng cần xử lý.
- Lưu ý lịch hiện chỉ tải tối đa 300 đơn mới nhất theo endpoint bootstrap hiện có. Dữ liệu công nợ lịch sử được Admin mở riêng.
- Trước khi triển khai, chạy `npm run verify:release && npm run test && npm run typecheck && npm run build` ở Codespaces.


## GU v4.2.0 – Tối ưu 5 năm và Admin Hệ thống

Xem `docs/GU-v4.2.0-TRIEN-KHAI-5-NAM.md` trước khi nâng cấp. Công nợ và dòng tiền cũ cần chuyển đổi riêng, không được coi bản deploy là đã chuyển dữ liệu.

## GU v4.2.1 – Sửa hiển thị Monitoring và định dạng tiền

Xem `docs/CHANGELOG-v4.2.1.md`. Mã tiền được nhập có dấu chấm theo định dạng Việt Nam ở giao diện, nhưng server nhận giá trị nguyên VND.
Nếu bảng Hệ thống báo Cloud Monitoring 403: bật Monitoring API và cấp `roles/monitoring.viewer` cho service account có email trùng `FIREBASE_CLIENT_EMAIL` (trong Google Cloud IAM của đúng project). Không chia sẻ private key hoặc API Secret.

## GU v5.0.0-beta.1 — ba client / 24 giờ / chụp ảnh chứng cứ

**Chưa phát hành Production.** Xem chi tiết `docs/GU-v5-THREE-CLIENTS-BETA.md` trước khi thử.

- Admin PC/mobile: `/` — quản trị và duyệt ảnh nhận trả.
- Staff PC: `/` — tạo đơn theo giờ và tư vấn ảnh.
- Staff mobile: `/mobile` — chỉ tìm ảnh và chụp giao/nhận, tài khoản có `role=staff_mobile`.
- Đơn cũ vẫn dùng giá/lịch cũ. Đơn mới dùng `GU_HOURLY_V1`.
- Visual match hiện dùng đối chiếu đơn giản tối đa 150 sản phẩm, chưa phải AI trên 2.000 sản phẩm.
- Ảnh chứng cứ cần chuyển sang lưu trữ riêng tư trước khi dùng cho khách hàng thật.


## GU v5.0.0-beta.2 — 7 lượt ảnh và bảng giá Canon

- Quản lý 4 Canon EOS R50 + 1 Canon M50 là 5 mã sản phẩm/serial riêng, nhập thủ công **serial** nhưng GU tự cấp mã sản phẩm.
- Giá R50 3h/6h/24h/48h: 110k/130k/190k/350k, M50: 90k/110k/180k/340k. Hơn 48 giờ chưa có phí trễ.
- Giữ tối đa 7 lượt ảnh đã duyệt giao+nhận theo từng thiết bị, tác vụ xóa Cloudinary có retry.
- Xem `docs/GU-v5-CAMERA-RETENTION-BETA.md` về giới hạn, quyền riêng tư, cấu hình Cron và cách kiểm thử.


## GU v5.0.0-beta.3 — Rà soát luồng 3 client & nghiệp vụ

Bản thử nghiệm này sửa phân quyền hủy đơn, giao sớm và khóa giờ, quyết toán máy ảnh quá 48 giờ, cách ly hàng có vấn đề, bảo mật dữ liệu nhân viên mobile, kết quả tìm bằng ảnh và hàng đợi xóa ảnh. Xem `docs/GU-v5-BETA3-KIEM-TRA-LOGIC.md`. Không triển khai vào Production khi chưa chạy `npm run typecheck`, `npm run build` và kiểm thử đầy đủ trên Firebase staging.


## GU v5.0.0-beta.4 — Tự động tính phí trễ máy ảnh (bản beta)

**Thay đổi mới nhất:** Đối với Canon EOS R50 và Canon M50, giờ giao thực tế là điểm bắt đầu.
Mỗi đơn lưu riêng gói thuê đã chốt 3h, 6h, 24h hoặc 48h và giá gốc tương ứng.
Quá hạn gói: cộng **10.000đ cho mỗi giờ trễ bắt đầu** (vượt 1 phút cũng +10.000đ).
Không tự chuyển gói 3h sang giá gói 6h khi khách trả muộn. Áp dụng tiếp cả sau 48h.
Tiền trễ được **gộp trong `total`** và **không nhân đôi vào `lateFeeTotal`**.
Admin thấy chi tiết gói, giờ trễ, tiền trễ trong màn hình duyệt ảnh nhận.
Các đơn đã trả của beta3 có trạng thái chờ quyết toán có nút **Tính tự động phí trễ máy ảnh** cho Admin.
Xem `docs/GU-v5-BETA4-CAMERA-OVERTIME.md`.

**Chưa kiểm tra build Next.js/Firebase live:** Cần chạy `npm run typecheck`, `npm run build`
và thử tạo/giao/nhận/duyệt trên staging trước khi triển khai Production.


## GU v5.0.0-beta.5 — Tối ưu form nhập kho và cấu hình góc chụp

Xem `docs/GU-v5-BETA5-INVENTORY-REFINEMENT.md`.
