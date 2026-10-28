> **KHÔNG DÙNG HƯỚNG DẪN RC1 NÀY ĐỂ PUSH/DEPLOY FIX20.** Nội dung bên dưới thuộc phiên bản cũ và có hướng dẫn Production tự động không còn đúng. Cách push bằng terminal vào repo `C:\Users\Admin\Desktop\GU-MAIN-READY`: `PUSH-FIX20-TERMINAL-WINDOWS.md`. Cách staging/production: `FIX20-HUONG-DAN-TRIEN-KHAI.md`.

# GU 5.4.6 VPS Fast RC1 — Thay mã nguồn GitHub `main` và triển khai VPS

> **Bản ứng viên phát hành (RC), chưa được xác nhận sản xuất.** Giữ nguyên GU 6.1 trên cổng 3200 cho đến khi GU V5 build/test tích hợp trên VPS, chứng từ riêng tư, tiền, phân quyền và đồng thời đặt đồ đạt. Mã nguồn lấy GU 5.4.6 và tối ưu truy xuất ý tưởng từ GU 5.0.0. Không xóa khách/đơn/ảnh, không xóa Git history.

## A. Những gì thay đổi

- Source chính trên GitHub: `https://github.com/tandatges-afk/Gu`, nhánh **main**.
- `main` cũ được lưu tại một annotated Git tag `backup/main-before-v5-...`, không cần `git push --force`.
- GitHub Actions mới **validate** V5 trên mỗi push `main`.
- Lượt deploy **staging** chỉ chạy khi chọn thủ công `workflow_dispatch → target=stage`, không đụng website chính.
- **Production** chỉ nhận push tự động nếu bạn chủ động đặt Actions variable `GU_V5_PRODUCTION_DEPLOY=enabled` **và** tạo tệp VPS `/etc/gu-v546/PRODUCTION_APPROVED` sau nghiệm thu. Trước đó, không thể deploy V5 production qua workflow.
- Hai instance V5 riêng: staging 3301 / DB `gu_v546_stage`, production 3302 / DB `gu_v546_prod`; GU 6.1 vẫn 3200 / DB `gu_db`.
- `/api/version` trả về commit thật từ `.gu-deploy-commit`, không suy đoán dựa vào số phiên bản.

## B. THAY MÃ NGUỒN `main` TRÊN WINDOWS (không xóa lịch sử)

1. Tải `GU_V5_546_FAST_MAIN_RC1.zip` về `C:\Users\Admin\Downloads`.
2. Mở **PowerShell Windows**, không SSH vào VPS, chạy:

```powershell
Expand-Archive -LiteralPath 'C:\Users\Admin\Downloads\GU_V5_546_FAST_MAIN_RC1.zip' -DestinationPath 'C:\Users\Admin\Downloads\GU_V5_546_FAST_MAIN_RC1' -Force
& 'C:\Users\Admin\Downloads\GU_V5_546_FAST_MAIN_RC1\windows\01-replace-main-safely.ps1'
```

Nếu PowerShell chặn chạy script, chỉ bật cho phiên hiện tại:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
& 'C:\Users\Admin\Downloads\GU_V5_546_FAST_MAIN_RC1\windows\01-replace-main-safely.ps1'
```

Script sẽ clone GitHub `main` sang **thư mục MỚI** `C:\Users\Admin\Desktop\GU-V5-MAIN-READY`, push tag sao lưu `main` cũ, xóa các tệp nguồn cũ khỏi bản làm việc bằng `git rm`, sao chép source V5 và sinh `package-lock.json` bằng `npm install --package-lock-only`. **Nó KHÔNG commit/push `main` thay bạn.** Máy cần internet để npm lấy gói.

3. Kiểm thử trên Windows tại thư mục mới:

```powershell
cd 'C:\Users\Admin\Desktop\GU-V5-MAIN-READY'
npm ci
npm run verify:imports
npm run typecheck
npm test
npm run build
git status -sb
git diff --cached --name-only
```

Nếu có lỗi, **DỪNG, KHÔNG PUSH**. Nếu thành công, kiểm tra không có `.env.local`, DB dump, private key, ảnh khách hàng. Nếu Vercel cũ vẫn auto-deploy `main`, tắt Git integration/autodeploy cho dự án Vercel trước.

4. Chỉ sau khi kiểm tra đạt:

```powershell
git commit -m 'Replace main with GU 5.4.6 VPS Fast'
git push origin main
```

Không dùng `--force`, không dùng `git push --mirror`, không xóa repository. Xem **GitHub → Actions**: workflow `GU V5 main — Validate / Stage / Deploy VPS` phải chạy `validate`. Đây chỉ là kiểm thử, chưa cập nhật website.

## C. CHUẨN BỊ VPS STAGING — thực hiện một lần

Trên Windows:

```powershell
scp 'C:\Users\Admin\Desktop\GU-V5-MAIN-READY\vps-main\prepare-v5-vps.sh' 'C:\Users\Admin\Desktop\GU-V5-MAIN-READY\vps-main\gu-v5-release' 'C:\Users\Admin\Desktop\GU-V5-MAIN-READY\vps-main\gu-v546-stage.service' 'C:\Users\Admin\Desktop\GU-V5-MAIN-READY\vps-main\gu-v546-prod.service' root@103.176.25.226:/tmp/
ssh root@103.176.25.226
```

Trên **VPS Ubuntu**, không chạy lệnh Windows:

```bash
mkdir -p /tmp/gu-v5-setup
mv /tmp/prepare-v5-vps.sh /tmp/gu-v5-release /tmp/gu-v546-stage.service /tmp/gu-v546-prod.service /tmp/gu-v5-setup/
chmod 700 /tmp/gu-v5-setup/prepare-v5-vps.sh
bash /tmp/gu-v5-setup/prepare-v5-vps.sh
```

Đảm bảo có `id guapp`, `id gu-deploy`, PostgreSQL đang hoạt động. Script chỉ thêm hệ thống phát hành GU V5, KHÔNG sửa GU 6.1. Kiểm tra:

```bash
visudo -cf /etc/sudoers.d/gu-v5-deploy
systemctl cat gu-v546-stage
systemctl is-active gu-pg
```

**Tạo database staging riêng** (không sử dụng `gu_db`):

```bash
sudo -u postgres createdb -O gu_app gu_v546_stage
# Bỏ qua lỗi 'already exists' nếu database này đã được tạo.
```

Soạn bí mật tại `/etc/gu-v546/stage.env` (quyền cho guapp đọc, không lưu trong GitHub):

```bash
nano /etc/gu-v546/stage.env
```

Nội dung ví dụ (**thay placeholders**):

```dotenv
APP_URL=https://v5.guthuedo.io.vn
DATABASE_URL=postgresql://gu_app:URL_ENCODE_PASSWORD@127.0.0.1:5432/gu_v546_stage
GU_UPLOAD_DIR=/var/lib/gu-v546/uploads
GU_SESSION_SECRET=YOUR_UNIQUE_RANDOM_64_HEX_CHARS
CRON_SECRET=ANOTHER_UNIQUE_RANDOM_64_HEX_CHARS
GU_SHIFT_ENFORCE_FROM=2026-11-02
```

Tạo secret bằng `openssl rand -hex 32`; mật khẩu DB có ký tự đặc biệt phải URL encode. Cấp quyền:

```bash
chown root:guapp /etc/gu-v546/stage.env
chmod 640 /etc/gu-v546/stage.env
```

Đảm bảo GitHub Actions Secrets trong repo là `GU_DEPLOY_SSH_KEY` (khóa CI không passphrase **đã kiểm tra**) và `GU_SSH_KNOWN_HOSTS` (host key đã đối chiếu fingerprint). `gu-deploy` cần `sudo -n -l` chứa `/usr/local/sbin/gu-v5-release`.

## D. CHẠY STAGING V5 TỪ GITHUB (không đụng main site)

Vào `https://github.com/tandatges-afk/Gu/actions/workflows/deploy-main.yml`, chọn **Run workflow**, nhánh `main`, `target: stage`.

Workflow thực hiện: kiểm thử GitHub → truyền source → trên VPS `npm ci`, TypeScript, test, khởi tạo **chỉ staging DB**, build → service `gu-v546-stage` cổng 3301 → xác nhận commit trả về `/api/version`.

Trên VPS kiểm tra:

```bash
systemctl status gu-v546-stage --no-pager
curl -fsS http://127.0.0.1:3301/api/version
curl -I http://127.0.0.1:3301/
```

Nếu muốn website staging có HTTPS: tạo DNS A `v5.guthuedo.io.vn → 103.176.25.226`, dùng `deploy-vps/v5.guthuedo.io.vn.nginx`, `nginx -t`, `certbot --nginx -d v5.guthuedo.io.vn`. Chưa đổi `guthuedo.io.vn`. Tạo tài khoản admin staging:

```bash
cd /var/www/gu-v546-stage-deploy/current
runuser -u guapp -- npm run db:admin
```

Test trên điện thoại, đối chiếu lịch, thuê/trả, hai nhân viên giữ cùng sản phẩm, hình ảnh riêng tư, nhân viên/ca, công nợ, thanh toán và hoàn tiền. Thử khôi phục bản sao DB + ảnh trên môi trường riêng. Đặc biệt, adapter JSONB cần được kiểm chứng với nhiều đơn đồng thời và dữ liệu thật trước production.

## E. CHUYỂN PRODUCTION SANG V5 SAU KHI ĐẠT NGHIỆM THU

**Không làm giai đoạn này nếu staging chưa chạy đầy đủ, chưa có backup và phương án rollback.**

1. Sao lưu PostgreSQL + media GU 6.1 hiện tại và sao lưu bản Nginx domain chính. Giữ `gu-pg` port 3200 làm phương án quay lại; giữ GitHub tag sao lưu.
2. Tạo DB `gu_v546_prod` riêng: `sudo -u postgres createdb -O gu_app gu_v546_prod`. Đặt `/etc/gu-v546/prod.env` theo `.env.vps.production.example`, với `APP_URL=https://guthuedo.io.vn`, `GU_UPLOAD_DIR=/var/lib/gu-v546-prod/uploads`. Quyền root:guapp 640. **Không dùng DB `gu_db`.**
3. Khởi tạo schema và admin V5 sau khi review riêng:

```bash
cd /var/www/gu-v546-stage-deploy/current
runuser -u guapp -- env GU_ALLOW_PRODUCTION_DB_SETUP=YES_I_HAVE_BACKUP node --env-file=/etc/gu-v546/prod.env scripts/bootstrap-postgresql.mjs --init
runuser -u guapp -- env GU_ALLOW_PRODUCTION_DB_SETUP=YES_I_HAVE_BACKUP node --env-file=/etc/gu-v546/prod.env scripts/bootstrap-postgresql.mjs --admin
```

**Quan trọng:** dữ liệu GU 6.1 và Firestore V5 **không tự chuyển sang DB V5**. Nếu cần dữ liệu khách cũ, phải kiểm chứng migration trước cutover; không tự xóa bản gốc.

4. Sau khi nghiệm thu và xác nhận đầy đủ ảnh/dữ liệu, quản trị viên chủ động bật hai cổng phê duyệt:
   - `touch /etc/gu-v546/PRODUCTION_APPROVED` trên VPS (chỉ khi đủ điều kiện).
   - GitHub Repository Variable `GU_V5_PRODUCTION_DEPLOY=enabled` và cân nhắc protection rule/reviewer cho environment `gu-v5-production`.
5. Trong GitHub Actions chạy **Run workflow → target: prod** (không phải stage). Xác nhận `gu-v546-prod` port 3302 khỏe và `/api/version` hiển thị đúng commit `main`.
6. Chỉ sau bước 5 mới đổi đúng `server_name guthuedo.io.vn` ở Nginx: backup file config và thay riêng `proxy_pass http://127.0.0.1:3200;` bằng `proxy_pass http://127.0.0.1:3302;`, sau đó `nginx -t && systemctl reload nginx`. Không thay file cho `v5.guthuedo.io.vn`. Chứng chỉ SSL của domain chính giữ nguyên.
7. Kiểm tra `https://guthuedo.io.vn/api/version`, đăng nhập, đặt hàng, ảnh, công nợ và quyền nhân viên. Khi đó các lần `git push origin main` tiếp theo có thể tự triển khai instance V5 production nếu các kiểm tra đạt.

**Rollback:** Khôi phục file Nginx đã sao lưu, `nginx -t && systemctl reload nginx` để proxy lại `127.0.0.1:3200`. Không xóa DB/media V5 hoặc GU 6.1. Nếu đã phát sinh đơn thật trên V5, cần lập kế hoạch đối soát trước khi rollback tránh lệch dữ liệu.

## F. Trạng thái xác minh

- Đã kiểm thử tự động logic trong môi trường tạo source: `npm test` đạt 222/222, `npm run test:vps` đạt 15/15 ở bản Fast Beta 2.
- Đã chỉnh build metadata, endpoint `/api/version`, cách lưu Nginx/proxy riêng biệt, và workflow CI không còn ràng buộc `6.x`.
- **Chưa xác nhận `npm ci`, `npm run typecheck`, `npm run build` hoặc kiểm thử tích hợp PostgreSQL tại VPS.** Môi trường tạo file không truy cập registry npm. Gói ZIP không chứa package-lock.json; script Windows tạo nó trước commit. Đây là lý do **chưa được gọi là bản production đã nghiệm thu**.
