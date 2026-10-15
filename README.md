# GU - Thuê đồ xinh v4.0

**Phiên bản tổng hợp nâng cấp trực tiếp từ GU v3.0.1.** Next.js 16 + TypeScript + Firebase Authentication/Firestore + Cloudinary + PWA. Không dùng Firebase Storage và không cần tạo lại Firebase Project `gugu-547e3`.

> Đây là **bộ mã nguồn có thể chạy và kiểm thử**, chưa phải thay đổi đã tự động đưa lên website của cửa hàng. Bản nâng cấp cần chạy `npm run typecheck` và `npm run build` trên Codespaces, thử với dữ liệu mẫu trên Preview trước khi merge vào production. Việc chạy test logic không thay thế kiểm thử Firestore transaction thực tế.

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
