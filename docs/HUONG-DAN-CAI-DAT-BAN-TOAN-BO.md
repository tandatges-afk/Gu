# GU — Thuê đồ xinh v4.1.2 (BẢN MÃ NGUỒN TỔNG HỢP)

Đây là **toàn bộ dự án** GU v4.1.2, không phải bản vá. Nó tổng hợp các thay đổi đã có từ GU 2.x, 3.x, 4.0 và 4.1, bao gồm bước **kiểm đồ trước, tính tiền sau** của v4.1.2.

## 1. Có gì trong gói?

- Frontend Next.js 16 + TypeScript + giao diện điện thoại/PWA.
- Firebase Auth và Firebase Admin/Firestore, phân quyền Admin–nhân viên, audit log.
- Cloudinary thay Firebase Storage: chụp ảnh hoặc chọn ảnh, ảnh sản phẩm khung vuông.
- Kho, danh mục, mã móc tự cấp `GU-00001`, cấp mã cho sản phẩm cũ.
- Đặt trước, giao ngay, thêm món, gia hạn, kiểm tra trùng ngày tại server.
- Smart Calendar: tìm đồ trống, tìm ngày trống gần nhất, lọc trạng thái, công việc hôm nay, gọi khách.
- Kiểm nhận từng món, tính tiền trễ và đền bù tự động, chỉ nhập phụ phí khác khi cần.
- Giặt tự động sau khi nhận trả món có yêu cầu giặt; bấm Đã giặt để mở thuê tiếp.

Các tính năng chưa có: Web Push nền 24/7, kế toán/hoàn cọc tự động, quản lý nhiều chi nhánh, ứng dụng iOS/Android native, RFID/QR, phát hiện nhầm móc tự động.

## 2. Nâng cấp từ GU v2.x, v3.x hoặc v4.x an toàn trên Codespaces

**Quan trọng:** Mỗi thư mục `src`, `public`, `tests`, `scripts`, `docs` phải thuộc **cùng bộ phiên bản**, không ghép bản vá cũ. Trước khi sửa, `git status` phải sạch (hoặc commit/stash các thay đổi).

```bash
cd /workspaces/Gu
git status
git switch main
git pull --ff-only origin main
git switch -c gu-v412-unified
```

Upload ZIP tổng hợp vào Codespaces. Giải nén ra thư mục tạm (ZIP bao ngoài chứa thư mục `GU-Thue-Do-Xinh-v4.1.2`):

```bash
mkdir -p /tmp/gu-v412-full
unzip -q GU-Thue-Do-Xinh-v4.1.2-FULL-UNIFIED.zip -d /tmp/gu-v412-full
SRC=/tmp/gu-v412-full/GU-Thue-Do-Xinh-v4.1.2
```

**Thay đồng bộ các thư mục code** (chỉ khi đang ở nhánh `gu-v412-unified` và đã xem trạng thái Git):

```bash
for dir in src public tests scripts docs; do
  mkdir -p "$dir"
  rsync -a --delete "$SRC/$dir/" "$dir/"
done
cp "$SRC/package.json" "$SRC/tsconfig.json" "$SRC/next.config.ts" \
   "$SRC/firestore.rules" "$SRC/firebase.json" \
   "$SRC/next-env.d.ts" "$SRC/README.md" .
cp "$SRC/.env.example" .
```

Lệnh trên xóa những file **mã nguồn cũ trong 5 thư mục được đồng bộ** nếu bản mới không còn sử dụng chúng. Do đó phải làm trên nhánh mới; nếu có tùy chỉnh riêng, kiểm tra `git diff` và chọn giữ lại trước khi commit. Nó **không xóa `.git`, `.env.local`, `node_modules`, `package-lock.json` hoặc dữ liệu Firebase/Cloudinary**.

Nếu Codespaces chưa có `rsync`, dùng `sudo apt-get update && sudo apt-get install -y rsync` hoặc đồng bộ qua trình quản lý tệp, nhưng nhớ dọn những file cũ không còn thuộc phiên bản.

## 3. Cấu hình và chạy thử

Giữ nguyên `.env.local` đã hoạt động trong Codespaces. **Không nhập lại API Secret nếu chúng đang đúng.** Đảm bảo `.env.local` có các biến Firebase `gugu-547e3` và Cloudinary (10 biến trong `.env.example`). Không bao giờ đưa `.env.local` hoặc Service Account JSON lên GitHub.

```bash
npm install
npm run verify:release
npm run test
npm run typecheck
npm run build
npm run dev
```

Khi `npm install` kết thúc, nó có thể tạo/cập nhật `package-lock.json`. Nên commit file lock này nếu được cập nhật để bản build trên Vercel dùng cùng dependency graph.

**Không deploy nếu `npm run typecheck` hoặc `npm run build` còn lỗi.** Bản ZIP được chuẩn bị từ mã nguồn đã vượt 61/61 bài test, nhưng chưa được build Next.js cuối cùng trong môi trường đóng gói vì registry npm không truy cập được.

## 4. Kiểm thử nghiệp vụ tối thiểu trước khi merge

- Đăng nhập Admin/nhân viên, kiểm tra nhân viên không được xem phần Admin.
- Thêm sản phẩm từ thư viện và camera; hình ảnh vuông đúng tỷ lệ, mã móc cấp tự động và duy nhất.
- Tìm đồ còn trống, tìm ngày trống gần nhất, lọc danh mục, lọc lịch.
- Đặt trước 1 ngày; thử đặt trùng cùng món từ hai trình duyệt.
- Đơn giao ngay; gia hạn và thêm món; chặn khi lịch đã kín.
- Trả đủ: kiểm đồ trước, tiền mới hiện; trả trễ một ngày tự tính phí.
- Trả thiếu: tính đền bù; thử thêm phụ phí khác có lý do.
- Đồ cần giặt sau trả: tự sang Đang giặt rồi nhân viên nhấn Đã giặt.
- Trên điện thoại: nút gọi khách, Việc hôm nay, lịch vuốt ngang, PWA.

Nếu có dữ liệu thật, nên dùng các đơn thử riêng và sao lưu Firestore trước khi đổi nhiều logic cùng lúc. Test trên Codespaces/Preview có thể vẫn truy cập cùng Firebase production nếu dùng cùng `.env.local` — Preview không đồng nghĩa cơ sở dữ liệu thử.

## 5. Commit và triển khai

```bash
git status
git diff --check
git add src public tests scripts docs package.json package-lock.json \
  tsconfig.json next.config.ts firebase.json firestore.rules next-env.d.ts \
  README.md .env.example
git diff --cached --name-only
git commit -m "GU v4.1.2 unify full source"
git push -u origin gu-v412-unified
```

Nếu không có `package-lock.json` sau cài npm, bỏ tên đó trong lệnh `git add`. Trước commit, kiểm tra file staged để tránh ZIP thừa, `.env.local` hoặc khóa bí mật.

Tạo PR `gu-v412-unified` → `main`, kiểm thử Vercel Preview rồi merge. Ở Vercel dùng cùng 10 biến môi trường và cấu hình Next.js hiện tại; không tạo lại Firebase hoặc Cloudinary. Nếu PWA còn giao diện cũ, đóng/mở ứng dụng và làm mới dữ liệu cache qua trình duyệt.

## 6. Khắc phục lỗi thường gặp

- `Export lateDays doesn't exist`: các file `src/lib/rental.ts` và `src/app/page.tsx` không cùng bản. Đồng bộ lại toàn bộ `src/` từ ZIP này.
- `Property lateFeeTotal / hangerCode doesn't exist`: `src/lib/types.ts` cũ. Đồng bộ toàn bộ `src/`.
- `app/invalid-credential`: kiểm tra Firebase Admin Service Account trong `.env.local`/Vercel; không gửi private key cho người khác.
- Vercel 404: xem Deployments/Build Logs và project domain; push GitHub thành công không có nghĩa deployment đã sẵn sàng.
- Ảnh không tải được: kiểm tra Cloudinary variables, giới hạn ảnh và quyền nhân viên.
- `npm audit`: đánh giá cụ thể các lỗ hổng; không chạy `npm audit fix --force` tùy tiện.
