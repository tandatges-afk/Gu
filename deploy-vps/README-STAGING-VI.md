# GU 5.4.6 Beta 1 → VPS/PostgreSQL — Hướng dẫn staging an toàn

**Trạng thái:** bản port thử nghiệm, **không phải bản đã nghiệm thu production**. GIỮ GU 6.1 đang chạy tại `https://guthuedo.io.vn` và nhánh `main` nguyên vẹn. Không chạy `gu-release-deploy` hay cập nhật `/var/www/gu-pg/current` từ ZIP này.

## 1. Những gì đã chuyển

- Giữ UI của GU 5.4.6 (lịch, kho, quy trình v5, ảnh, ca làm, đơn máy ảnh, công nợ).
- Thay **Firestore runtime** bằng adapter `src/lib/pg-firestore.ts` lưu dữ liệu vào PostgreSQL `gu_documents` (JSONB) và khóa giao dịch để tránh 2 đơn giữ cùng lịch.
- Thay **Firebase Auth runtime** bằng `gu_accounts`, scrypt + session cookie HttpOnly/SameSite Strict và API `/api/local-auth`.
- Ảnh sản phẩm/giao-trả tại `/var/lib/gu-v546/uploads`, ảnh cọc lưu riêng tư ở thư mục `secure`; ảnh nhạy cảm chỉ xem qua API có xác thực.
- Thay giám sát Cloudinary bằng dung lượng ảnh VPS. GET `/api/version` để kiểm tra bản chạy.
- Thay Vercel Cron bằng endpoint cron sẵn có để sử dụng `systemd timer` hoặc cron sau khi cấu hình. Không còn cần môi trường `NEXT_PUBLIC_FIREBASE_*` và `CLOUDINARY_*`.

## 2. Những gì CHƯA được xác thực

- Bản nguồn chưa chạy `npm ci`, `npm run typecheck`, `npm run build` tích hợp vì môi trường đóng gói không truy cập npm registry và ZIP V5 gốc không có `package-lock.json`.
- Chưa chạy DB integration / concurrency tests thực tế trên PostgreSQL với dữ liệu cửa hàng; tất cả hành vi Firestore phụ thuộc truy vấn phức tạp cần nghiệm thu.
- Dữ liệu Firestore V5, tài khoản Firebase Auth, chứng từ Cloudinary/Firebase Storage cũ **chưa được di chuyển**; migration cần xuất dữ liệu, duyệt trường nhạy cảm và reset mật khẩu nhân viên, không được tự xóa dữ liệu cũ.
- Các test gốc ràng buộc Firebase/Cloudinary/Vercel nằm ở 14 tệp obsolete, không được coi chúng đã đạt. Lệnh `npm test` hiện chạy bộ nghiệp vụ còn phù hợp và kiểm tra VPS mới. `npm run test:legacy-all` chạy nguyên bộ test gốc (dự kiến thất bại ở các kỳ vọng provider cũ); không được che giấu khi nghiệm thu.

## 3. Tạo staging trên VPS (không đụng website hiện tại)

Trên Windows, SCP ZIP lên `/tmp/`, sau đó SSH root:

```bash
apt-get update && apt-get install -y unzip
mkdir -p /var/www/gu-v546 /var/lib/gu-v546/uploads
unzip -q /tmp/GU_5.4.6_VPS_PostgreSQL_PORT_BETA.zip -d /var/www/gu-v546
chown -R guapp:guapp /var/www/gu-v546 /var/lib/gu-v546
chmod 700 /var/lib/gu-v546 /var/lib/gu-v546/uploads
cd /var/www/gu-v546
cp .env.vps.example .env.local
chmod 600 .env.local
nano .env.local
chown guapp:guapp .env.local
```

Database staging **bắt buộc tách khỏi `gu_db` production**. Tạo database staging bằng `sudo -u postgres createdb -O gu_app gu_v546_stage` (nếu chưa tồn tại). Kiểm tra quyền với `sudo -u postgres psql -d gu_v546_stage -c "SELECT has_schema_privilege('gu_app','public','CREATE');"`. Nếu trả `f`, cần cấp quyền schema trên **database staging** trước, không sửa database GU chính. Chỉnh `DATABASE_URL` trỏ đến `gu_v546_stage` (tuyệt đối không `gu_db`), `GU_UPLOAD_DIR=/var/lib/gu-v546/uploads`, `APP_URL=https://v5.guthuedo.io.vn`, `GU_SESSION_SECRET` ngẫu nhiên >=32 ký tự, `CRON_SECRET` ngẫu nhiên khác. Chú ý **mật khẩu trong DATABASE_URL phải URL-encode**. Tạo bí mật bằng `openssl rand -hex 32`.

```
runuser -u guapp -- npm install
runuser -u guapp -- npm run stage:check
runuser -u guapp -- npm run db:init
runuser -u guapp -- npm run db:optimize
runuser -u guapp -- npm run db:check
runuser -u guapp -- npm run db:bench
# `db:admin` cần terminal tương tác; thực hiện riêng với tài khoản triển khai hợp lệ
runuser -u guapp -- npm run verify:imports
npm run typecheck
npm test
npm run build
```

**Nếu npm install, typecheck hoặc build báo lỗi, dừng tại đây; KHÔNG thay Nginx production.** `npm install` sẽ tạo `package-lock.json` (cần lưu bản đó vào `main` khi nghiệm thu). Script `db:admin` yêu cầu terminal, khởi tạo tài khoản Admin MỚI chỉ một lần; mật khẩu nhập có thể hiển thị trên terminal nên tránh ghi hình/chia sẻ.

Để truy cập staging bằng domain chính xác và cookie Secure, tạo DNS A cho `v5.guthuedo.io.vn` → IP VPS. Sau khi đã kiểm tra source build thành công, chạy:

```bash
cp /var/www/gu-v546/deploy-vps/gu-v546.service /etc/systemd/system/
cp /var/www/gu-v546/deploy-vps/v5.guthuedo.io.vn.nginx /etc/nginx/sites-available/gu-v546
ln -s /etc/nginx/sites-available/gu-v546 /etc/nginx/sites-enabled/gu-v546
systemctl daemon-reload
systemctl enable --now gu-v546
nginx -t && systemctl reload nginx
certbot --nginx -d v5.guthuedo.io.vn --redirect
curl -I https://v5.guthuedo.io.vn
```

**Lưu ý:** Service yêu cầu `guapp` tồn tại từ bản GU 6.1, Node.js 22 và `npm` ở `/usr/bin/npm`. Xác nhận bằng `which npm`, `id guapp`. Do không có kết nối thực tế tới VPS, script unit có thể cần điều chỉnh theo máy.

## 4. Kiểm thử nghiệp vụ (bắt buộc)

- Đăng nhập Admin, thêm nhân viên, đăng nhập nhân viên trong ca; đăng xuất, session hết hạn và thử sai mật khẩu.
- Thêm loại đồ/sản phẩm/ảnh, mã GU không trùng, tìm theo chữ có dấu/không dấu, tìm mã số, duyệt ảnh kho.
- Hai nhân viên cùng đặt **cùng sản phẩm và cùng khung giờ**: chỉ một giao dịch được giữ; giờ khác vẫn đặt được.
- Tạo đơn đặt trước, chụp ảnh cọc riêng tư, không ai ngoài người được phép có thể xem trực tiếp qua URL.
- Tạo đơn thuê ngay, giao và chụp ảnh sản phẩm theo góc, nhận trả, giặt, tính tiền, phí trễ, thiếu đồ và công nợ.
- Đơn máy ảnh 3h/6h, ca làm, cảnh báo sau 17h, lọc lịch và tìm bằng ảnh.
- Test retry upload lỗi, upload file giả ảnh, đường dẫn `../`, quyền nhân viên, khôi phục PostgreSQL + ảnh.

## 5. Backup và cutover

Sau khi test đạt, mới cài `gu-v546-backup.*` và `gu-v546-cleanup.*` trong `deploy-vps/` vào systemd và chạy thử restore trong DB riêng. Lưu bản backup ngoài VPS. Đổi proxy của Nginx domain chính `guthuedo.io.vn` từ `127.0.0.1:3200` sang `127.0.0.1:3301` **chỉ khi có quyết định chốt chuyển đổi và phương án rollback**. Không xóa `/var/www/gu-pg/current` hoặc DB GU 6.1.

**Quan trọng:** đổi web chính sang V5 khi chưa nhập dữ liệu Firestore sẽ khiến hệ thống V5 bắt đầu với data trống. Quy trình nhập data JSON (`npm run data:import-json -- /path/export.json`) chỉ là khuôn mẫu có kiểm tra và không nhập ảnh/tài khoản; không tự động trích xuất Firebase từ URL dự án.
