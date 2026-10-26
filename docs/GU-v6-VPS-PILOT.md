# GU v6.0 VPS Pilot — triển khai thử, chưa chuyển đổi dữ liệu Production

## Phạm vi hiện thực trong gói này

- Next.js 16 dùng `output: standalone`, build Webpack tương thích AI CLIP.
- Docker image build trên GitHub Actions, không cần build Next.js trên VPS 4 GB RAM.
- Caddy reverse proxy tự cấp HTTPS cho tên miền đã trỏ DNS đến VPS.
- Trang Kho / Khách / Đơn thuê: tải hết các trang API theo con trỏ, lọc trên toàn bộ kết quả; giao diện hiển thị 50 dòng/trang. Không còn nhầm 40 dòng đầu là toàn bộ kho.
- API lịch vẫn chia 25 món/trang, bộ lọc toàn kho; bỏ giới hạn quét 250 dòng của trang nhanh, nới ngưỡng bảo vệ dữ liệu lịch có cấu hình để tránh hiển thị lịch trống giả.
- Bộ xuất Firestore thành JSONL + staging PostgreSQL (đã tách riêng) để đối soát, KHÔNG gắn schema staging vào API business.
- Giữ nguyên API Firebase + Cloudinary cho đến khi chuyển đổi backend và ảnh được kiểm tra đầy đủ. Không xóa tài khoản/dữ liệu gốc.

**Phạm vi CHƯA hoàn thành:** thay toàn bộ 30+ Firestore API bằng PostgreSQL, chuyển Firebase Auth sang đăng nhập riêng, chuyển ảnh Cloudinary và ảnh CCCD sang kho ảnh riêng, bảo đảm đầy đủ transaction/lock, đối chiếu và cutover. Những phần đó cần phát triển và kiểm thử nghiệp vụ. Đây không phải bản tự chủ 100% ở giai đoạn này.

## 1. Mua VPS và chuẩn bị

VPS gói GOLD 4: 2 vCPU / 4 GB RAM / 50 GB NVMe. Chọn Ubuntu 24.04 LTS **không dùng Ubuntu 18.04**. Trỏ tên miền thử `gu-test.<domain>` đến IPv4 của VPS. Không chuyển domain GU chính khi chưa kiểm thử.

Trên VPS Ubuntu 24.04 qua SSH:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y ca-certificates curl git ufw
curl -fsSL https://get.docker.com -o get-docker.sh
# Kiểm tra script của Docker trước khi chạy; hoặc cài theo tài liệu Docker chính thức.
sudo sh get-docker.sh
sudo systemctl enable --now docker
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
sudo mkdir -p /opt/gu/config
sudo chmod 700 /opt/gu/config
```

Bản ZIP nguồn không kèm `package-lock.json` (bản nguồn cũ không có file này). Nếu bạn có file lock đang hoạt động trong repository, giữ nguyên file đó và chạy `npm.cmd install` để đồng bộ; nên commit lock vào Git để cố định phiên bản dependency. Dockerfile hỗ trợ cả repository chưa có lock nhưng khi đó độ tái lập dependency kém hơn.

Cần cài Docker Compose plugin (lệnh `docker compose version`). Sao chép thư mục `deploy/vps/*` gồm `compose.yml`, `Caddyfile` vào `/opt/gu/`. Tạo:

- `/opt/gu/.env` từ `.env.example` và thay `GU_DOMAIN`, `GU_IMAGE`.
- `/opt/gu/config/gu-runtime.env` từ `gu-runtime.env.example` (không commit). Trên VPS: `chmod 600 /opt/gu/.env /opt/gu/config/gu-runtime.env`.

Nội dung khóa private cần giữ `\n` theo định dạng Docker env-file (không paste nguyên khóa có nhiều dòng); kiểm tra Firebase Admin đã xác thực trên Preview. Tất cả biến `NEXT_PUBLIC_FIREBASE_*` cần thiết lập cả khi build GitHub Actions lẫn lúc chạy; biến `NEXT_PUBLIC` là giá trị công khai, còn `FIREBASE_PRIVATE_KEY`, `CLOUDINARY_API_SECRET` tuyệt đối không nằm trong build args.

## 2. GitHub Actions build

Trên GitHub Repository GU → Settings → Secrets and variables → Actions, tạo:

`GU_PUBLIC_FIREBASE_API_KEY`, `GU_PUBLIC_FIREBASE_AUTH_DOMAIN`, `GU_PUBLIC_FIREBASE_PROJECT_ID`, `GU_PUBLIC_FIREBASE_APP_ID`.

Tạo nhánh `v6-vps-pilot`, push từ VS Code Local. Workflow `GU VPS Pilot image` build Docker với Next.js 16 và publish lên GHCR. Khi build thành công, lấy image gắn SHA và sử dụng trong `GU_IMAGE` ở VPS. Với package GHCR private, đăng nhập trên VPS bằng token chỉ có `read:packages` trước khi pull:

```bash
sudo docker login ghcr.io -u <github-user>
cd /opt/gu
sudo docker compose --env-file .env pull
sudo docker compose --env-file .env up -d
sudo docker compose --env-file .env ps
sudo docker compose --env-file .env logs --tail=100 app
```

Caddy cấp HTTPS khi DNS đúng, port 80/443 mở; kiểm tra `https://gu-test.<domain>/api/v6/health`. Health chỉ kiểm tra tiến trình, không xác minh giao dịch Firebase. Không triển khai code chưa được `npm run typecheck && npm run test && npm run build` kiểm tra.

**Rollback:** đặt `GU_IMAGE` về tag SHA của image đang chạy ổn định trước đó, `docker compose pull`, `docker compose up -d`; không xóa volume hay Firebase records.

## 3. Thử nghiệm dữ liệu thực

Kiểm tra đủ: đăng nhập Admin/nhân viên, ca làm, kho 2.000 món, tìm bằng AI, 40 trang sản phẩm, lọc theo trạng thái, lịch 7 ngày, đơn cũ và đơn mới, chống trùng lịch, ảnh sản phẩm, ảnh CCCD authenticated, trả đồ, công nợ và màn điện thoại. Mọi test ghi dữ liệu nên dùng Firestore test project hoặc dữ liệu giả; tránh tạo đơn thử trong dữ liệu Production.

**Cảnh báo:** Đây là phiên bản dùng Firebase Firestore trong giai đoạn pilot, nên các trang tự đồng bộ toàn kho sẽ phát sinh số Reads cao hơn khi mở trang. Blaze đã được bật, phải theo dõi Firebase Billing sau khi test. Không dùng "đọc không giới hạn" từ Firestore chỉ để sửa lỗi hiển thị thiếu trang.

## 4. Chuẩn bị chuyển hẳn khỏi Firebase

Xuất snapshot sang thư mục private tại máy admin (không push file ảnh hay dữ liệu khách lên Git):

```powershell
node --env-file=.env.local deploy/migration/export-firestore.mjs .\private-backups\gu-export
```

Kiểm tra `manifest.json`, số lượng và hash; script liệt kê các collection gốc được tìm thấy trong source; **không bảo đảm bao phủ subcollection hay collection tạo động**. Cần rà soát bằng Firebase Console để bổ sung phần thiếu, thu thập subcollections, timestamp format và thói quen giao dịch trước cutover.

Sau đó trên môi trường staging PostgreSQL riêng, chạy `001_staging.sql`, cài Python psycopg và chạy `import-postgres.py`. Chỉ dùng staging schema để so sánh; GU Production chưa đọc từ bảng này. Cần thiết kế schema chuẩn hóa, transactions chống trùng, lịch sử/việc giặt, công nợ, bằng chứng, đổi authentication và migrations trước khi chuyển.

**Cloudinary:** ảnh sản phẩm công khai và CCCD dạng `authenticated` phải chuyển theo 2 quy trình khác nhau; giữ ID và quyền truy cập. Không tự tải ảnh CCCD sang đường dẫn công khai trên VPS. Với ổ đĩa 50GB, ưu tiên object storage private ngoài VPS + backup mã hóa ở nơi thứ hai.

**Cutover cuối:** lên lịch read-only, xuất delta cuối cùng, đối chiếu số dòng + hash + tiền + tình trạng khóa lịch, kiểm tra ảnh, đăng nhập, rồi mới thay domain. Giữ nguyên Firebase/Cloudinary để rollback; chỉ tắt khi lưu trữ và dữ liệu được xác minh và backup khôi phục thành công.
