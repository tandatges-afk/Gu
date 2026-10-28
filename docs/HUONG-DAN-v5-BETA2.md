# GU v5.0.0 Beta 2 — Máy ảnh & lưu 7 lượt ảnh

**Đây là bản thử nghiệm.** Không đưa ngay lên Production nếu chưa chạy `npm run typecheck`, `npm run build` trong Codespaces và thử một đơn thực tế trên Firebase staging.

## 1. Những thay đổi

- 7 lượt ảnh **giao + nhận** gần nhất cho **từng mã sản phẩm vật lý**; chỉ cộng một lượt khi **Admin duyệt trả** và cả hai bộ ảnh thực sự có ảnh.
- Khi duyệt lượt thứ 8, lượt thứ nhất được đưa vào hàng chờ xóa Cloudinary, gồm cả ảnh giao và ảnh nhận; dữ liệu đơn, tiền, người giao và người nhận vẫn còn. GUI Admin → Kho sản phẩm → **Ảnh 7 lượt** cho xem lịch sử gần nhất.
- Cron mỗi ngày tiếp tục xử lý các tác vụ xóa thất bại; có thể gọi thủ công bằng tài khoản Admin.
- Mẫu máy ảnh mặc định: **Canon EOS R50** và **Canon M50**, có bảng giá riêng theo giờ.
- Mỗi thân máy mang một **mã GU tự động duy nhất** và **serial thân máy** (Admin nhập khi đăng ký). Không quản lý 4 R50 bằng một món số lượng 4.
- Máy ảnh đánh dấu **Có vấn đề** lúc trả được chuyển **Bảo trì**, không quay lại sẵn sàng ngay.

## 2. Cách nhập 5 máy ảnh đang có

Admin → Kho sản phẩm → Thêm sản phẩm → chọn **Máy ảnh**.

Tạo riêng:

| Số chiếc | Mẫu | Mã GU | Serial thân máy |
|---:|---|---|---|
| 1 | Canon EOS R50 | GU tự cấp | Serial của R50 số 1 |
| 1 | Canon EOS R50 | GU tự cấp | Serial của R50 số 2 |
| 1 | Canon EOS R50 | GU tự cấp | Serial của R50 số 3 |
| 1 | Canon EOS R50 | GU tự cấp | Serial của R50 số 4 |
| 1 | Canon M50 | GU tự cấp | Serial của M50 |

**Không dùng ví dụ mã GU-00001 nếu chưa xem mã thực tế do web cấp.** Có thể dán mã trên *phần dán tháo được*, túi bảo quản hoặc tem không che số serial/vent; luôn dùng serial để xác nhận thân máy. Nên chụp các góc mặt trước, sau/màn hình, trên/nút bấm, đáy/serial, ngàm và ảnh riêng cho ống kính/pin nếu thuê kèm.

## 3. Giá thuê máy ảnh

| Khoảng thời gian | Canon EOS R50 | Canon M50 |
|---|---:|---:|
| Từ >0 đến 3h | 110.000đ | 90.000đ |
| Trên 3h đến 6h | 130.000đ | 110.000đ |
| Trên 6h đến 24h | 190.000đ | 180.000đ |
| Trên 24h đến 48h | 350.000đ | 340.000đ |
| Trên 48h | **Chưa cấu hình** | **Chưa cấu hình** |

Giờ tính từ lúc nhân viên mobile **giao thực tế**. Một đơn đặt máy ảnh quá 48 giờ sẽ bị từ chối cho tới khi bảng giá được thống nhất. Nếu người thuê máy ảnh trả quá 48 giờ thực tế, GU **tạm không cho Admin duyệt hoàn tất tiền** vì chưa có giá trễ, tránh áp sai giá quần áo; Admin cần giải quyết sau khi thêm chính sách trễ.

## 4. Khi đủ 8 lượt ảnh

Ví dụ **Canon R50 A** đã có 7 lượt giao/nhận được duyệt. Khi hoàn tất lượt 8:

1. Firestore `inspectionEvidence/{itemId}` chỉ còn metadata của 7 lượt gần nhất (lượt 2–8).
2. Firestore `inspectionCleanup/{itemId}_{oldOrderId}` chứa tác vụ xóa ảnh lượt 1.
3. GU yêu cầu Cloudinary xóa chính xác các ảnh giao+nhận của món đó, đồng thời yêu cầu làm mất hiệu lực cache CDN.
4. Khi Cloudinary xác nhận, các liên kết ảnh trong đơn cũ và bản ghi `proofUploads` liên quan được xóa, các dữ liệu nghiệp vụ của đơn vẫn được giữ.
5. Nếu Cloudinary không trả thành công, tác vụ **vẫn chờ** để chạy lại; KHÔNG tuyên bố đã xóa khi chưa xác nhận.

**Lưu ý xóa vĩnh viễn:** Cloudinary có thể có backup riêng, bản sao CDN/trình duyệt bên ngoài; việc xóa qua API không chứng minh mọi bản sao trên mọi thiết bị bị xóa ngay. Liên hệ Cloudinary nếu bật tính năng backup. Dữ liệu ảnh chứng cứ từ v5 Beta 1 hiện là URL ảnh công khai nếu biết liên kết; cần cải thiện cơ chế ảnh riêng tư trước khi triển khai với ảnh nhạy cảm.

## 5. Cấu hình tác vụ xóa định kỳ

Trong **Vercel → Settings → Environment Variables → Production**:

- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` phải được cấu hình đúng (đã dùng cho upload).
- Thêm `CRON_SECRET`: một chuỗi dài ngẫu nhiên; không ghi vào mã nguồn hay chia sẻ trong chat.
- Cấu hình `vercel.json` trong ZIP: Cron gọi `/api/v5/evidence-cleanup` lúc 03:00 UTC hằng ngày. Vercel tự gửi `Authorization: Bearer ...` từ `CRON_SECRET`.

Tạo chuỗi secret trong Codespaces để dán riêng vào Vercel (KHÔNG commit giá trị):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Admin có thể yêu cầu xử lý hàng chờ ngay bằng API `POST /api/v5/evidence-cleanup` kèm token đăng nhập GU; `GET /api/v5/evidence-history/{itemId}` hiển thị 7 lượt và số tác vụ tồn. Cron là quy trình khôi phục lỗi, không phải cam kết xóa thành công nếu nhà cung cấp đang lỗi.

## 6. Chạy Codespaces trên nhánh thử nghiệm

Trước hết sao lưu thay đổi và dữ liệu Firestore. Upload ZIP **đầy đủ** vào `/workspaces/Gu`:

```bash
cd /workspaces/Gu
git status
git switch main
git pull --ff-only origin main
git switch -c test/gu-v5-beta2-camera

mkdir -p /tmp/gu-v5-beta2
unzip -q GU-v5.0.0-beta.2-CAMERA-RETENTION-FULL.zip -d /tmp/gu-v5-beta2
SRC=/tmp/gu-v5-beta2/GU-v5.0.0-beta.2

for dir in src public tests scripts docs; do
  mkdir -p "$dir"
  rsync -a --delete "$SRC/$dir/" "$dir/"
done
cp "$SRC/package.json" "$SRC/tsconfig.json" "$SRC/next.config.ts" "$SRC/next-env.d.ts" \
   "$SRC/firebase.json" "$SRC/firestore.rules" "$SRC/.gitignore" \
   "$SRC/.env.example" "$SRC/README.md" "$SRC/vercel.json" .

nvm install 22
nvm use 22
npm install
npm run verify:release
npm run test
npm run typecheck
npm run build
```

**Đừng push Production** nếu kiểm thử Firebase/Cloudinary thực, hoạt động xóa ảnh, quyền Admin, và cách xử lý đơn quá 48 giờ chưa được xác minh. Với bản beta, ưu tiên môi trường Firebase/Cloudinary staging riêng để tránh xóa ảnh khách thật.

## 7. Thử nghiệm nên làm

- Tạo 4 máy R50, 1 máy M50 với serial khác nhau; kiểm tra không thể dùng lại serial.
- Tạo đơn R50 3h/3h01/6h/24h/48h; tương tự M50; >48h bị chặn đúng thông báo.
- Chụp ảnh giao/nhận nhiều góc trên mobile, Admin duyệt và kiểm tra tình trạng kho.
- Với sản phẩm thử, tạo đủ 8 lượt đã duyệt; xác nhận **chỉ lượt đầu** bị xóa, 7 lượt còn lại nguyên vẹn, không ảnh hưởng ảnh khác trong đơn.
- Thử mô phỏng lỗi Cloudinary (trên staging) và cho Cron/API Admin chạy lại.

Đơn cũ giữ nguyên giá; bản này chưa thực hiện migration hàng loạt lịch sử ảnh từ v5 Beta 1. Lượt mới sẽ bắt đầu tính từ khi dùng v5 Beta 2.
