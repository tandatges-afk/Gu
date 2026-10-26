# Phiên bản 6.1 RC1

Xem [README-UPGRADE-6.1-VI.md](README-UPGRADE-6.1-VI.md) để cập nhật GU VPS PostgreSQL 6.1 và đối chiếu tính năng với GU V5.

# GU VPS PostgreSQL v2 – Hướng dẫn triển khai

Đây là **ứng dụng Next.js độc lập không dùng Firebase/Vercel**, cài cùng `gu_db` PostgreSQL trên Ubuntu 24.04. Mã mới là bản xây dựng lại phần nghiệp vụ cốt lõi, không khẳng định giữ được mọi tính năng phụ của GU v5 (AI tìm bằng ảnh, soát xét chứng từ nhiều cấp, quy tắc giá máy ảnh, báo cáo mở rộng). **Không thay thế website Vercel production khi chưa kiểm thử nghiệp vụ đầy đủ.**

## Đã thực hiện trong mã nguồn

- PostgreSQL bảng categories, customers, inventory_items, rental_orders, lines, reservations, sessions, events, shifts, payments, debt_ledger, audit_logs, media_assets.
- Đăng nhập Admin/Staff, session HttpOnly, mật khẩu Argon2id, giới hạn số lần nhập sai/email.
- Dashboard, lịch tháng, thêm/tìm không dấu, sửa khách/sản phẩm, ảnh từ PC/camera, đơn nhiều sản phẩm, đặt trước, nhận và trả hàng, checklist kiểm tra trả, phí phát sinh, giặt, thanh toán/hoàn tiền, công nợ, ca 2 người, báo cáo, nhật ký.
- Chống trùng bằng PostgreSQL exclusion constraint; mọi cập nhật đơn thực hiện trong transaction.
- Lưu ảnh trên đĩa VPS; ảnh chứng từ chỉ Admin truy cập, ảnh giao/nhận nhân viên có thể xem. Không gửi ảnh vào thư mục `public`.
- Migration dùng CREATE IF NOT EXISTS; không DROP/TRUNCATE dữ liệu.

## 0. Điều kiện

- SSH vào VPS `103.176.25.226`, Node.js 22, PostgreSQL 16, database `gu_db`, user `gu_app` đã tạo.
- **Giữ nguyên** Vercel + GitHub nhánh `main` cũ cho tới khi đánh giá bản mới trên nhánh/địa chỉ staging.
- Clone dự án mới vào **/var/www/gu-pg**; không ghi đè `/var/www/gu` đang chạy.

## 1. Đưa source từ máy Windows vào GitHub nhánh staging

Giải nén ZIP này trong một thư mục **riêng**, sau đó mở folder đó bằng VS Code:

```powershell
git init
git switch -c vps-postgres-v2
git add .
git commit -m "feat: rebuild GU for private VPS PostgreSQL"
# Chỉ khi repo là một repo MỚI hoặc đã xác định remote phù hợp:
git remote add origin https://github.com/USERNAME/REPO-TEST.git
git push -u origin vps-postgres-v2
```

Không force push hoặc xóa lịch sử repo GU hiện tại. Đối với repo cũ đang kết nối Vercel, thay đổi nhánh `main` có thể phát hành thay đổi ngay.

## 2. Cài trên VPS

```bash
cd /var/www
# nếu clone từ GitHub
# git clone -b vps-postgres-v2 https://github.com/USERNAME/REPO-TEST.git gu-pg
cd /var/www/gu-pg/gu-pg
npm install
cp .env.example .env.local
nano .env.local
```

Lưu các biến:

```
DATABASE_URL="postgresql://gu_app:PASSWORD_URL_ENCODED@127.0.0.1:5432/gu_db"
GU_UPLOAD_DIR="/var/lib/gu/uploads"
APP_URL="http://localhost:3100"
```

`APP_URL` phải đúng origin của trình duyệt. Để thử SSH tunnel từ Windows, dùng `http://localhost:3100`. Khi dùng tên miền với HTTPS, đổi thành `https://domain-cua-ban`, sau đó build/restart và cấu hình Nginx. Nếu mật khẩu DB chứa `@`, `#`, `/`, ... phải percent-encode trong DATABASE_URL.

Cài/migrate:

```bash
mkdir -p /var/lib/gu/uploads
id guapp || useradd --system --create-home --home-dir /home/guapp --shell /usr/sbin/nologin guapp
chown -R guapp:guapp /var/www/gu-pg /var/lib/gu
chmod 700 /var/lib/gu/uploads
chmod 600 /var/www/gu-pg/gu-pg/.env.local
npm run db:migrate
npm run db:check
npm run db:smoke
npm run typecheck
npm run build
```

`db:migrate` có thể chạy trên schema Phase 1 đã tồn tại. Nếu một migration thất bại, **dừng lại** và xem lỗi, không xóa database.

## 3. Admin cũ

Nếu bạn đã tạo Admin bằng bộ Phase 1 trước đó thì **giữ nguyên**, không tạo lại. Nếu database chưa có Admin:

```bash
read -rs -p 'Mật khẩu Admin: ' GU_ADMIN_PASSWORD; echo
export GU_ADMIN_PASSWORD
npm run admin:create -- "email@example.com" "Admin GU"
unset GU_ADMIN_PASSWORD
```

## 4. Chạy bằng SSH tunnel

VPS:

```bash
npm run start -- -H 127.0.0.1 -p 3100
```

Windows CMD khác:

```powershell
ssh -N -L 3100:127.0.0.1:3100 root@103.176.25.226
```

Mở `http://localhost:3100/`. Tuyệt đối không mở cổng 5432 ra Internet.

## 5. Chạy lâu dài sau kiểm thử

```bash
cp deploy/gu.service /etc/systemd/system/gu-pg.service
systemctl daemon-reload
systemctl enable --now gu-pg
journalctl -u gu-pg -n 100 --no-pager
```

Dùng `deploy/nginx-gu.conf` làm mẫu Nginx rồi cấp HTTPS bằng Certbot. APP_URL phải trùng origin HTTPS sử dụng thật. Ảnh chứng từ cần giữ kín đường dẫn, không đặt `GU_UPLOAD_DIR` trong `/var/www/gu-pg/public`.

## 6. Kiểm thử bắt buộc trước khi phát hành

1. Login đúng/sai, hết hạn phiên, logout và chặn người chưa xác thực.
2. Tạo và tìm khách theo số điện thoại/tên không dấu, tạo danh mục/sản phẩm và tải ảnh.
3. Tạo hai đơn trùng thời gian trên cùng sản phẩm ở hai cửa sổ → một đơn phải bị từ chối `409`; hai đơn không giao nhau đều được nhận.
4. Giao → trả cần checklist đủ từng sản phẩm; phí phát sinh cộng vào tổng tiền, hàng chuyển `LAUNDRY` hoặc `AVAILABLE`.
5. Thanh toán, hoàn tiền, công nợ và báo cáo phải khớp thực tế.
6. Ca làm quá 2 người bị chặn, phân quyền Staff/Admin đúng, nhân viên bị khóa không đăng nhập.
7. Ảnh chứng từ Admin được xem, người chưa đăng nhập/Staff không được xem.
8. Sao lưu cả database và `/var/lib/gu/uploads`; thử khôi phục trên môi trường khác.

## Giới hạn đã biết

- Đây không phải bản port nguyên vẹn 190 tệp của GU v5. Hệ thống mới không kèm toàn bộ các luồng chụp giao nhận phức tạp, AI, phân quyền ca làm tự động, chính sách bồi thường đặc biệt, và phân tích bán hàng nâng cao.
- Chưa kiểm thử tích hợp trực tiếp trên VPS/dữ liệu thực của người dùng; không thể xác nhận hoạt động production chỉ từ việc tạo ZIP.
- Bản SQL đầu tiên tạo khoảng 15 bảng; auth/media/migration tạo thêm các bảng tiếp theo.
- Cần backup định kỳ, HTTPS, firewall, quyền tối thiểu cho ứng dụng, kiểm tra tải đồng thời và bảo mật trước khi dùng chính thức.

## 7. Kiểm tra thực tế

Lệnh `npm run db:smoke` tự tạo dữ liệu thử trong transaction, xác minh `23P01` khi đặt lịch trùng, sau đó **ROLLBACK** toàn bộ. Đây chưa thay thế kiểm thử end-to-end từ trình duyệt.

## Bản sửa Beta 2 – 26/10/2026

- Khắc phục 9 lỗi TypeScript trong phần state ảnh chứng từ, upload ảnh `HANDOVER` và import `.ts` trong test.
- Ấn định `turbopack.root` để tránh Next.js đoán workspace sai khi có nhiều `package-lock.json`.
- ZIP có thư mục gốc `gu-pg/` bên trong. Nếu giải nén vào `/var/www/gu-pg`, thư mục ứng dụng là **`/var/www/gu-pg/gu-pg`**. Đừng chạy npm ở thư mục cha.
- Kiểm thử `npm test` trên mã nguồn đã sửa: 4/4 đạt. Kiểm tra cú pháp TypeScript: đạt. `npm run typecheck` và `npm run build` phải được thực hiện trên VPS vì môi trường đóng gói không truy cập được npm registry để cài dependencies.
- Nếu `npm install` báo lỗ hổng nghiêm trọng, chạy `npm audit --omit=dev` và đánh giá trước khi phát hành. **Không dùng `npm audit fix --force` khi chưa kiểm tra tác động đến Next.js.**
