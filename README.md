# GU - Thuê đồ xinh v2.1 · Firebase gugu-547e3 + Cloudinary Free + Codespaces + Vercel

**Mục tiêu:** chạy web quản lý GU mà **không cần bật Firebase Storage hoặc nâng Firebase lên Blaze**. Đây là bản cập nhật mã nguồn v2.0: tính năng đơn hàng, kho, nhân viên, log, nhắc trả trễ và checklist giữ nguyên; ảnh sản phẩm chuyển sang **Cloudinary Free**.

> TRẠNG THÁI: đã chạy 11 unit tests bằng Node.js 22, tất cả đạt. Chưa kiểm thử trực tiếp được API với Firebase/Cloudinary thật và chưa hoàn thành build Next.js vì môi trường kiểm thử không tải được npm dependencies. Hãy kiểm tra Codespaces trước khi dùng dữ liệu thật.

## Kiến trúc

- Firebase Authentication: tài khoản Admin + nhân viên.
- Firestore (`gugu-547e3`): staff, items, bookings, slot locks, audit, customers. **Không đòi Blaze riêng cho Firestore trong giới hạn Spark.**
- Cloudinary **Programmable Media** Free: ảnh sản phẩm **công khai theo URL**. Không tải ảnh khách, giấy tờ hoặc dữ liệu nhạy cảm.
- Next.js API `/api/uploads`: server kiểm tra Firebase ID token và `staff/{uid}` trước khi tải lên Cloudinary bằng API secret. Browser không thấy secret.
- GitHub Codespaces: chạy bản thử. Vercel: deploy (cần gói phù hợp mục đích kinh doanh).

## Bước 1: Cập nhật mã nguồn trong GitHub Codespaces

**Cách an toàn nhất khi repo GU đang trống:** Download ZIP mới `GU-Thue-Do-Xinh-v2.1-Cloudinary-No-Blaze.zip`, đưa file ZIP vào Codespaces qua Explorer > Upload, sau đó tại thư mục repo (nơi có `.git`):

```bash
unzip -q GU-Thue-Do-Xinh-v2.1-Cloudinary-No-Blaze.zip -d /tmp/gu-v21
cp -a /tmp/gu-v21/gu-thue-do-xinh-v2.1-cloudinary/. .
rm GU-Thue-Do-Xinh-v2.1-Cloudinary-No-Blaze.zip
node -v
ls package.json .env.example
```

**Nếu repo đã có GU v2.0 hoặc bất cứ dữ liệu/code đã chỉnh sửa**, tạo một nhánh dự phòng trước và chỉ sao chép nguồn sau khi so sánh:

```bash
git switch -c backup-before-cloudinary
# sao lưu; xem git status, kiểm tra mọi file quan trọng
```

Không sao chép đè `.env.local` hoặc thư mục `.git`, không trộn project GU vào Amorri Studio. Phiên bản Node.js khuyến nghị 22 LTS.

## Bước 2: Firebase project gugu-547e3

1. https://console.firebase.google.com/project/gugu-547e3/overview
2. Authentication > Sign-in method > bật **Email/Password**.
3. Firestore Database > Create database > Production mode > chọn region phù hợp.
4. Firestore > Rules > dán nội dung file `firestore.rules` trong dự án > Publish.
5. **Bỏ qua mục Storage**: không dùng `storage.rules`, không cần bucket hoặc Blaze.
6. Project settings > Your apps > Web app: Register app `GU Web`; lấy `apiKey`, `authDomain`, `projectId`, `appId`.
7. Project settings > Service accounts > Generate new private key; đọc `project_id`, `client_email`, `private_key`. Tuyệt đối không commit/service account JSON hoặc gửi khóa qua chat.

### Khởi tạo Admin một lần

Authentication > Users > Add User bằng email/mật khẩu quản trị. Copy chính xác UID. Firestore > Data > collection `staff` > document ID = UID, field:

| Key | Type | Value |
|---|---|---|
| `name` | string | `Admin GU` |
| `email` | string | Email Admin |
| `role` | string | `admin` |
| `disabled` | boolean | `false` |

Sau đó Admin tạo tài khoản nhân viên trong giao diện GU, không cần thao tác Firebase Console nữa.

## Bước 3: Tạo Cloudinary Free

1. Đăng ký ở https://cloudinary.com/users/register_free (chọn Programmable Media / Image & Video API).
2. Vào Cloudinary Console > API Keys/Cloud credentials.
3. Lấy **Cloud name**, **API Key**, **API Secret**. Không cần tạo unsigned Upload Preset.
4. Cloudinary có Free 25 credits/tháng dùng chung cho lưu trữ, băng thông và biến đổi ảnh; xem Usage để tránh vượt hạn mức.

## Bước 4: Cấu hình `.env.local` trong Codespaces

```bash
cp .env.example .env.local
```

Mở `.env.local`, điền chính xác:

```dotenv
NEXT_PUBLIC_FIREBASE_API_KEY=AIza...THUC_TE
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=gugu-547e3.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=gugu-547e3
NEXT_PUBLIC_FIREBASE_APP_ID=1:...:web:...

FIREBASE_PROJECT_ID=gugu-547e3
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-...@gugu-547e3.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

CLOUDINARY_CLOUD_NAME=cloud_name_thuc_te
CLOUDINARY_API_KEY=api_key_thuc_te
CLOUDINARY_API_SECRET=api_secret_thuc_te
```

- **Không** cần `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`.
- **Không** thêm `NEXT_PUBLIC_` vào Cloudinary API Secret hay Firebase private key.
- `.env.local` đã nằm trong `.gitignore`. Kiểm tra `git check-ignore .env.local` và `git status`.
- Codespaces có thể lưu secrets dưới GitHub Repo > Settings > Secrets and variables > Codespaces, nếu muốn tránh file cục bộ.

## Bước 5: Khởi chạy

```bash
npm install
npm run test
npm run typecheck
npm run build
npm run dev
```

Trong tab PORTS của Codespaces, mở port 3000 và giữ **Private**. Nếu Firebase báo `auth/unauthorized-domain`, vào Firebase Auth > Settings > Authorized domains, thêm hostname Codespace (không có `https://`, không có path).

## Bước 6: Kiểm tra chức năng

1. Đăng nhập Admin, tạo staff từ menu Nhân viên.
2. Tạo sản phẩm từ Kho: ảnh JPG/PNG/WebP <=3MB/ảnh, tối đa 5 ảnh; ấn chọn ảnh để test tải lên. Chỉ Admin và staff đã cấp quyền mới upload được.
3. Xem ảnh sản phẩm hiện ở bảng kho. Kiểm tra Firestore `items/{id}` có `imagePaths` dạng `https://res.cloudinary.com/...` (URL), **không phải** Firebase Storage path nữa.
4. Admin duyệt giá đền bù; tạo đơn/đặt cùng một món trùng ngày phải bị từ chối; trả hàng thử checklist thiếu/mất; kiểm tra audit và cảnh báo trễ.

Ảnh đã tải lên Cloudinary nhưng bạn hủy form tạo sản phẩm có thể thành ảnh dư. Định kỳ dọn hình ảnh không sử dụng trong Cloudinary Media Library. Không tải ảnh riêng tư của khách lên Cloudinary với thiết kế ảnh URL công khai này.

## Bước 7: GitHub + Vercel

```bash
git status
git add .
git commit -m "GU v2.1 switch product photos to Cloudinary Free"
git push origin main
```

Nếu bạn đang dùng nhánh khác thì push đúng nhánh / tạo pull request. Không push `.env.local`. Tại https://vercel.com/new, import GitHub repo GU, framework Next.js, root directory `./`; thêm **10 biến môi trường** ở trên vào Project Settings > Environment Variables (4 `NEXT_PUBLIC_`, 3 `FIREBASE_`, 3 `CLOUDINARY_` = tổng **10** biến), sau đó Deploy. Nếu sửa biến sau khi đã deploy, Redeploy. Thêm domain `xxx.vercel.app` của GU vào Firebase Authorized domains.

**Quan trọng:** Vercel Hobby dành cho mục đích phi thương mại. GU là web quản lý cửa hàng nên chọn Vercel Pro hoặc nền tảng hosting cho phép thương mại trước khi sử dụng chính thức.

## Xử lý lỗi

| Lỗi | Kiểm tra |
|---|---|
| `Chưa thiết lập Cloudinary trên máy chủ` | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` |
| `Cloudinary từ chối tải ảnh` | API keys, hạn mức Free, quyền tài khoản, Cloudinary Dashboard/Usage |
| `401 / 403` khi upload | Firebase Auth, Firestore `staff/{UID}`, `disabled` |
| `Ảnh phải được tải lên từ tài khoản của bạn` | URL Cloudinary đúng project và UID, không nhập URL thủ công |
| Firebase báo thiếu Web Config | `NEXT_PUBLIC_FIREBASE_*` và restart dev server |
| Ảnh cũ Firebase Storage không hiển thị | bản mới lưu URL Cloudinary; cần upload lại ảnh ở nguồn cũ |

## Bảo mật và giới hạn

- Upload chỉ chạy trong server API và xác minh quyền nhân viên; server tự đặt đường dẫn ảnh `gu/products/<UID>/<uuid>`. Chỉ URL đúng định dạng, đúng Cloud name, đúng UID tạo mới được lưu khi tạo sản phẩm.
- Không đồng nghĩa ảnh được giữ bí mật: người có URL có thể xem ảnh sản phẩm. Đây là thiết kế dành cho ảnh catalog quần áo, phụ kiện.
- Max 5 ảnh/sản phẩm, 3MB/ảnh. Tối đa 3MB và một request qua server khi upload nên tránh ảnh khổng lồ.
- Thiết kế này chưa tự dọn ảnh tải lên rồi hủy biểu mẫu, chưa chuyển ảnh cũ Firebase Storage, chưa có công cụ chỉnh sửa album ảnh sản phẩm đã tạo.
- Firebase Firestore vẫn có hạn mức đọc/ghi Spark riêng; Cloudinary có giới hạn Free riêng. Không có dịch vụ nào bảo đảm lưu trữ không giới hạn.

## GU v2.1.1 – sửa báo lỗi phiên đăng nhập

Lỗi v2.1 `Phiên đăng nhập không hợp lệ hoặc đã hết hạn` xuất hiện cho *mọi* lỗi `verifyIdToken(token, true)`, kể cả Service Account sai. Bản 2.1.1 giữ nguyên kiểm tra token bị thu hồi, nhưng phân loại phản hồi: 401 (token sai/hết hạn), 403 (Firebase Auth disabled), 503 (lỗi cấu hình/quyền máy chủ hoặc không liên lạc được Firebase). API tự thử lại 1 lần với token làm mới khi nhận 401.

Trên Codespaces, với file `.env.local` chứa thông tin thực và tuyệt đối không được commit:

```bash
npm install
npm run diagnose:firebase
npm run test
npm run typecheck
npm run build
npm run dev
```

`diagnose:firebase` kiểm tra *hình thức* 7 biến Firebase mà không in khóa, không gọi dịch vụ bên ngoài. Kết quả OK không đảm bảo private key thật sự hợp lệ, hoặc API Key cùng project: đối chiếu Firebase Console Project `gugu-547e3`. Nếu nhận lỗi 503, đọc terminal Codespaces dòng `GU Firebase token verification failed` và kiểm tra `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY` từ đúng Service Account `gugu-547e3`. Không gửi key/token hoặc `.env.local` để nhờ hỗ trợ.

Nếu sửa `.env.local`, dừng `npm run dev` rồi khởi động lại, thoát tài khoản GU và đăng nhập lại; nếu dùng Vercel, cập nhật Environment Variables rồi Redeploy. Đừng vô hiệu hóa `verifyIdToken` hoặc mở Firestore rules công khai để giải quyết sự cố đăng nhập.
