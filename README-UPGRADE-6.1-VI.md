# GU PostgreSQL 6.1 RC1 – Nâng cấp an toàn trên VPS

**Gói source đầy đủ** xuất phát từ GU PostgreSQL V2 Beta 2 (không phải patch đè mã Firebase V5).

## Những gì mới

- Cảnh báo lúc/từ 17h (Asia/Ho_Chi_Minh), nếu đơn `PICKED_UP` chưa trả và cùng sản phẩm đã có đơn `RESERVED` nhận vào ngày mai. Đơn bị rủi ro được đánh dấu vàng trong Tổng quan và danh sách Đơn thuê.
- Bộ lọc nhận biết sản phẩm đã bị giữ trong khoảng ngày nhận/trả ngay khi tạo đơn. Form hiện `ĐÃ CÓ LỊCH`, vô hiệu hóa checkbox. PostgreSQL exclusion constraint vẫn là chốt chặn cuối cùng.
- Mặc định nhân viên không được hoàn tiền; chỉ Admin. Không cho giao dịch số tiền 0.
- Ảnh `EVIDENCE` và `HANDOVER` phải gắn với một đơn thuê hợp lệ.
- Mật khẩu nội bộ không bị tự động cắt khoảng trắng ở đầu/cuối khi kiểm tra.
- 9 bài kiểm thử logic Node.js đạt (4 V2 + 5 mới). Không sửa bảng PostgreSQL; không xóa dữ liệu.
- Next.js pin 16.4.3 theo phiên bản đã build thành công trên VPS ngày 26/10/2026.

**Chưa xác nhận**: Build Next.js đầy đủ trong môi trường đóng gói (npm registry không truy cập được), tích hợp trực tiếp với `gu_db`, tải chịu lực đồng thời và mọi nghiệp vụ GU V5. Cần tự chạy lệnh kiểm thử ở dưới.

## 1. Nhánh GitHub hiện tại

Repository: `https://github.com/tandatges-afk/Gu`.

**Đừng force-push `main`** (vì GU V5 cũ có thể vẫn gắn với Vercel). Dùng nhánh `vps-postgresql` hoặc tạo `vps-postgresql-6.1` nếu nhánh kia đang chứa công việc khác.

Trong một **thư mục mới độc lập** trên Windows, giải nén ZIP này. Thư mục bên trong là `gu-pg` và có `package.json`.

Cách đơn giản khi chưa có nhánh VPS trên remote:

```powershell
cd 'C:\Users\Admin\Desktop\GU-VPS-RELEASE\gu-pg'
git init -b vps-postgresql
git remote add origin https://github.com/tandatges-afk/Gu.git
git add .
git diff --cached --name-only
git commit -m 'feat: GU PostgreSQL 6.1 release candidate'
git push -u origin vps-postgresql
```

Nếu branch `vps-postgresql` đã tồn tại, **không force push**. Hãy làm việc từ checkout nhánh có sẵn, cân nhắc merge/copy thay đổi. Có thể tạo nhánh riêng `vps-postgresql-6.1` để kiểm tra trước.

Không commit `.env.local`, khóa SSH, `gu_db` backup, ảnh khách hàng. `.env.example` chỉ chứa giá trị mẫu.

## 2. Kiểm tra trên Windows hoặc VPS staging

```bash
npm install
npm run typecheck
npm test
npm run build
npm audit --omit=dev
```

Lưu và commit `package-lock.json` tạo bởi `npm install` để lần sau dùng `npm ci` và giảm rủi ro phụ thuộc thay đổi.

## 3. Nâng cấp VPS từ ZIP (không động database)

Không thay app ngay trên đường dẫn `/var/www/gu-pg/gu-pg` bằng giải nén đè trực tiếp. Đầu tiên backup PostgreSQL và hình ảnh:

```bash
/usr/local/sbin/gu-backup.sh
systemctl is-active gu-pg
curl -I http://127.0.0.1:3200
```

Chuyển ZIP qua `scp` vào `/tmp` rồi chạy (chỉ khi service gu-pg hiện vẫn dùng đúng `/var/www/gu-pg/gu-pg`):

```bash
bash /var/www/gu-pg/gu-pg/deploy/upgrade-vps.sh /tmp/GU_VPS_PostgreSQL_6.1_RC1_full.zip
```

**Quan trọng:** Lệnh trên dùng bản script cũ ở source đang chạy; nếu source cũ chưa có `upgrade-vps.sh`, hãy giải nén **chỉ file script** từ ZIP trước:

```bash
unzip -p /tmp/GU_VPS_PostgreSQL_6.1_RC1_full.zip gu-pg/deploy/upgrade-vps.sh > /tmp/gu-upgrade-vps.sh
bash /tmp/gu-upgrade-vps.sh /tmp/GU_VPS_PostgreSQL_6.1_RC1_full.zip
```

Script yêu cầu root, build phiên bản mới trong thư mục tách biệt, giữ nguyên `.env.local`, không gọi `db:migrate`, dừng service ngắn để đổi release, kiểm tra HTTP và quay lại source cũ nếu healthcheck lỗi. Không chạy nếu đang sử dụng release manager có đường dẫn service khác.

**Ghi chú:** Script bảo vệ khi khởi động thất bại, nhưng HTTP 200 **không xác nhận toàn bộ nghiệp vụ**, cần kiểm thử đăng nhập và đơn hàng trước khi xóa release cũ.

## 4. Kiểm tra sau khi nâng cấp

```bash
systemctl status gu-pg --no-pager
curl -I https://guthuedo.io.vn
cd /var/www/gu-pg/gu-pg
runuser -u guapp -- npm run db:check
runuser -u guapp -- npm run db:smoke
npm audit --omit=dev
```

Đăng nhập với Admin rồi thực hiện `docs/TEST-ACCEPTANCE-VI.md`. Không xóa backup, không dừng Vercel/Firebase cũ trước khi chốt kiểm thử.

## 5. CI GitHub

Có `.github/workflows/vps-postgresql-ci.yml`: trên branch VPS, Actions sẽ cài dependencies, chạy typecheck, 9 unit test, build, npm audit. **Workflow không tự deploy production** khi chưa xác minh các bước bằng tay. Sau đó có thể tích hợp deploy kit đã chuẩn bị trước với SSH keys và healthcheck.
