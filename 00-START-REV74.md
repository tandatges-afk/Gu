# GU Rev7.4 — Đọc trước khi push Production

Đây là toàn bộ mã nguồn GU Fix20 Rev7.4 (Rev7.3 + xử lý chẩn đoán backup systemd). Bao gồm giao diện nhập kho hàng loạt, workflow `main` -> CI -> Production, script rollback code và backup fail-closed.

**KHÔNG tuyên bố an toàn 100%.** Phần thiếu trong VPS như `/etc/gu-v546/backup-prod.env`, `rclone`, remote offsite và GPG public key không thể được đóng gói kèm source; phải cấu hình thật. Nếu thiếu, auto deploy dừng và website Production cũ tiếp tục chạy.

1. Kết nối: `ssh root@103.176.25.226`. Chạy:

   ```bash
   systemctl show gu-fix20-prod-backup.service -p Result -p ExecMainStatus -p EnvironmentFiles
   journalctl -xeu gu-fix20-prod-backup.service -n 70 --no-pager
   test -f /etc/gu-v546/backup-prod.env && echo CONFIG_EXISTS || echo CONFIG_MISSING
   command -v rclone || echo RCLONE_MISSING
   ```

2. Xem chi tiết **AUTO-PROD-SETUP.md**: sao chép script/units Rev7.4, cấu hình offsite, import GPG public key, kiểm tra qua backup doctor. Script cài mới không restart web hoặc tự enable deploy.

3. Chạy backup bằng systemd; tải backup mã hóa ra thiết bị khác, kiểm tra checksum và **thử khôi phục vào DB thử nghiệm**. Chưa làm bước này thì không mở Production tự động.

4. Trên Windows, giải nén ZIP này vào thư mục mới, dùng clone/worktree sạch của `origin/main`, chép source vào đó **giữ nguyên `.git`**, rồi chạy `npm ci`, `npm run verify:release`, `npm run typecheck`, `npm test`, `npm run test:vps`, `npm run build`. Dừng nếu lỗi.

5. Nếu kiểm tra đạt và backup đã nghiệm thu, commit/push `main` (không force). GitHub Actions tự deploy Production **chỉ khi** có `GU_V5_PRODUCTION_DEPLOY=enabled`, cờ `/etc/gu-v546/PRODUCTION_APPROVED` và SSH secrets hợp lệ.

6. Xác minh bằng `curl -fsS https://guthuedo.io.vn/api/version; echo` và `systemctl is-active gu-v546-prod.service`. Phiên bản `package.json` vẫn là `5.4.6-fix20.0`, dùng commit SHA từ endpoint để phân biệt chính xác build.

**Lưu ý:** Không gửi hoặc commit `.env`, mật khẩu database, private key, file backup hoặc ảnh khách hàng. Nếu GitHub có commit mới, không ghi đè toàn bộ/force push.
