# GU — Thuê đồ xinh · v3.0 hoàn chỉnh (Mobile/PWA + ảnh tự căn khung)

**Đây là gói mã nguồn đầy đủ**, không phải gói vá rời. Gói kế thừa GU 2.3.1 và GU 3.0 Mobile PWA, đồng thời sửa hiển thị ảnh sản phẩm trên màn hình nhỏ: ảnh **tự co vừa khung, không cắt mất người hoặc trang phục**, không méo tỉ lệ. Đã áp dụng cho Kho, Lịch thuê, Chọn sản phẩm, Chi tiết đơn, Quản lý giặt và thư viện ảnh khi thêm/sửa sản phẩm.

### Thay đổi hiển thị ảnh

- `ProductImage` giữ tỉ lệ gốc và hiển thị toàn bộ sản phẩm bằng `object-fit: contain`, không dùng `cover` để cắt ảnh.
- Gallery trên điện thoại tự thành **2 cột**, trên màn hình rộng tự chia cột theo chiều rộng tab/modal, không làm tràn màn hình.
- Ảnh chụp dọc, ngang, ảnh áo dài toàn thân đều nằm gọn trong khung; vùng trống có nền trung tính.
- Ảnh chưa được tải cũng giữ đúng kích thước khung ở lịch, tránh xô lệch.
- Ảnh vẫn lưu trong Cloudinary như cũ, không cần Firebase Storage, không thay đổi dữ liệu hoặc biến môi trường.

### Cập nhật **toàn bộ** mã nguồn trong GitHub Codespaces

1. Trong `/workspaces/Gu`, chạy `git status`, commit hoặc lưu an toàn mọi thay đổi chưa commit.
2. Tạo nhánh nâng cấp: `git switch -c gu-v3-full-imagefit` (chỉ chạy nếu nhánh chưa tồn tại).
3. Upload file **GU-Thue-Do-Xinh-v3.0-Hoan-Chinh.zip** vào thư mục `/workspaces/Gu`.
4. Dán lệnh dưới đây trong Terminal:

```bash
cd /workspaces/Gu
mkdir -p /tmp/gu-v30-full
unzip -q GU-Thue-Do-Xinh-v3.0-Hoan-Chinh.zip -d /tmp/gu-v30-full
cp -a /tmp/gu-v30-full/GU-Thue-Do-Xinh-v3.0-Hoan-Chinh/. .
npm install
npm run test
npm run typecheck
npm run build
```

**Đừng push nếu `typecheck` hoặc `build` còn báo lỗi.** Vì gói không chứa `.env.local`, bạn giữ nguyên 10 biến Firebase + Cloudinary đã chạy trước đó. Tránh dùng `git add .` trước khi kiểm tra `git status` vì file ZIP vừa upload không nên đưa lên GitHub.

5. Chạy `npm run dev` rồi kiểm tra trực tiếp **Kho → Thêm/sửa sản phẩm**, **Lịch thuê** và **Chi tiết đơn** trên điện thoại qua Codespaces HTTPS Port 3000.
6. Khi mọi thứ thành công:

```bash
git add src public scripts tests next.config.ts package.json tsconfig.json README.md firebase.json firestore.rules .env.example .gitignore
git diff --cached --check
git diff --cached --name-only
git commit -m "GU v3.0 full mobile PWA image fit"
git push -u origin gu-v3-full-imagefit
```

Sau đó tạo Pull Request `gu-v3-full-imagefit` → `main`; khi kiểm tra Preview Deployment ổn định thì merge. Vercel tự triển khai production từ main nếu đã cấu hình. **Không tạo lại Firebase `gugu-547e3` hoặc Cloudinary**.

### Đã kiểm tra / chưa kiểm tra

- Đã chạy bài test logic Node và kiểm tra cú pháp TS/TSX độc lập.
- Cần chạy `npm run typecheck` và `npm run build` trong Codespaces trước khi deploy vì môi trường đóng gói không truy cập đầy đủ npm registry.
- Chưa kiểm thử thao tác camera, Firestore và Cloudinary bằng tài khoản thật của cửa hàng; hãy thử ảnh và đơn giả trước khi vận hành.

---

## Chức năng trong bản đầy đủ

- Đăng nhập Firebase Authentication, phân quyền Admin/nhân viên, cấp tài khoản và nhật ký thao tác.
- Quản lý sản phẩm, hình ảnh Cloudinary, danh mục, kích cỡ, giá thuê, giá trị đền bù.
- Lịch thuê theo ngày; chống trùng tại máy chủ, phân biệt đặt trước và giao ngay.
- Tìm khách theo số điện thoại, thêm khách ngay khi tạo đơn, tìm/lọc sản phẩm.
- Giặt sau trả, đánh dấu đã giặt, tự ghi nhận thiếu đồ, phí đền bù và phụ thu trả trễ.
- Mobile-first, bottom navigation, thêm GU lên màn hình chính dưới dạng PWA.
- Chọn ảnh thư viện/chụp camera, thử tối ưu ảnh lớn trước khi upload; chọn ảnh bìa và xóa ảnh khỏi sản phẩm.
- **Ảnh tự co theo khung:** giữ toàn bộ ảnh không cắt, hiển thị đồng bộ ở lịch, kho, đơn và form upload.

Không có chức năng QR, Web Push nền 24/7, hoặc giao dịch offline; chúng không phải tính năng của bản này.

## Cấu hình môi trường

Dùng Firebase Project `gugu-547e3` và Cloudinary đang có, chỉ cần 10 biến trong `.env.local`:

```dotenv
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=gugu-547e3.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=gugu-547e3
NEXT_PUBLIC_FIREBASE_APP_ID=
FIREBASE_PROJECT_ID=gugu-547e3
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

KHÔNG đưa `.env.local`, Service Account JSON, private keys lên GitHub. Dùng cùng Service Account hợp lệ từ Firebase Console. Những giá trị này còn cần thêm vào Environment Variables trên Vercel tương ứng với Preview hoặc Production.

## Kiểm tra các chức năng trước khi Merge vào `main`

1. `npm run test`, `npm run typecheck`, `npm run build` phải đạt trên Codespaces.
2. Đăng nhập Admin và nhân viên trên port 3000, kiểm tra quyền truy cập.
3. Chụp/đăng 1 ảnh dọc toàn thân, 1 ảnh ngang, rồi xem hình trong **Kho / Lịch / Đơn / Form tải ảnh** ở màn hình 375px, 768px và desktop. Hình phải thu vừa khung, không bị cắt hoặc kéo giãn.
4. Tạo đặt trước, giao ngay, trả đồ, giặt, phụ thu, thử đặt trùng và xem nhật ký.
5. Test link Preview Deployment với Firebase Authentication Authorized domains nếu cần, xem có lỗi 401/403 hay không.
6. Kiểm tra thông báo lỗi mất mạng: PWA không được âm thầm ghi đơn khi offline.

## Cài GU lên điện thoại

- iPhone: Safari → website Vercel GU → Chia sẻ → **Thêm vào Màn hình chính**.
- Android: Chrome → website GU → ⋮ → **Cài đặt ứng dụng** hoặc **Thêm vào màn hình chính**.
- Nếu trình duyệt không đọc được HEIC, dùng ảnh JPG/PNG hoặc bật Camera → Formats → Most Compatible, rồi thử lại.

## Kiểm thử phát hành

Đã kiểm tra **31/31 bài test Node**, **40 file TypeScript/TSX không có lỗi cú pháp**, đường dẫn import nội bộ hợp lệ và CSS parser hợp lệ. **Chưa xác minh `npm run typecheck` và `npm run build` đầy đủ do npm registry không khả dụng trong môi trường đóng gói**. Cần chạy hai lệnh này trong Codespaces trước khi đưa bản mới lên Vercel.
