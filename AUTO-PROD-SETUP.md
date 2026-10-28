# GU Rev7.5 – Push `main` → Auto Production 3302, backup tại VPS và copy Windows thủ công

## Những gì đã thay đổi

Rev7.4 cần GPG public key + rclone offsite bắt buộc cho **mọi** lần deploy. GU đã ngừng dùng R2 và không có máy backup offsite thường trực. Rev7.5 chuyển **cổng bảo vệ deploy** sang snapshot PostgreSQL + media trên VPS, đúng với phương án mà người dùng đã chấp nhận. **Không phải backup offsite tự động.** Mỗi lần push, một bản snapshot local mới được tạo và xác minh; khi cần bảo vệ trước sự cố hỏng VPS, phải mã hóa và tải snapshot định kỳ ra Windows hoặc kết nối SFTP/NAS ngoài VPS sau này.

**Cảnh báo:** nếu VPS bị xóa/hỏng giữa các lần bạn tải backup về Windows, dữ liệu mới từ lần backup Windows gần nhất vẫn có thể mất. Không gọi cấu hình này là disaster recovery đầy đủ. Script rollback chỉ quay lại release ứng dụng; nó KHÔNG tự đảo ngược migration SQL.

## 1. Cài tool trên VPS từ source Rev7.5, không restart website

Trên Windows sau khi giải nén ZIP ở thư mục sạch Rev7.5:

```powershell
$server='root@103.176.25.226'
ssh $server 'mkdir -p /root/gu-rev75-bundle/deploy-vps /root/gu-rev75-bundle/vps-main'
scp .\vps-main\gu-v5-release "${server}:/root/gu-rev75-bundle/vps-main/gu-v5-release"
scp .\deploy-vps\gu-fix20-backup-doctor.sh "${server}:/root/gu-rev75-bundle/deploy-vps/gu-fix20-backup-doctor.sh"
scp .\deploy-vps\gu-fix20-local-prod-backup.sh "${server}:/root/gu-rev75-bundle/deploy-vps/gu-fix20-local-prod-backup.sh"
scp .\deploy-vps\gu-fix20-prod-backup.service "${server}:/root/gu-rev75-bundle/deploy-vps/gu-fix20-prod-backup.service"
scp .\deploy-vps\gu-fix20-prod-backup.timer "${server}:/root/gu-rev75-bundle/deploy-vps/gu-fix20-prod-backup.timer"
scp .\deploy-vps\install-gu-auto-prod-backup.sh "${server}:/root/gu-rev75-bundle/deploy-vps/install-gu-auto-prod-backup.sh"
ssh $server 'bash /root/gu-rev75-bundle/deploy-vps/install-gu-auto-prod-backup.sh'
```

Các file cũ được backup dưới `/root`. Installer chỉ cài script & systemd units, không bật deploy, không đụng database hoặc restart Next.js.

## 2. Kiểm tra backup tự động trên VPS

```bash
/usr/local/sbin/gu-fix20-backup-doctor --host
systemctl reset-failed gu-fix20-prod-backup.service
systemctl start gu-fix20-prod-backup.service
journalctl -u gu-fix20-prod-backup.service -n 35 --no-pager
ls -ld /var/backups/gu-fix20-prod/gu-prod-*
systemctl enable --now gu-fix20-prod-backup.timer
```

Phải thấy `GU_LOCAL_BACKUP_OK` với folder và `offsite=0`. Snapshot gồm `database.dump`, `uploads.tar.gz`, `SHA256SUMS`. `SHA256SUMS` được xác minh trước khi đánh dấu thành công. Nếu lỗi, **không bật** auto-deploy.

## 3. Cho phép Production tự chạy sau mỗi push `main`

```bash
install -o root -g root -m 0600 /dev/null /etc/gu-v546/PRODUCTION_APPROVED
```

GitHub repository variable: `GU_V5_PRODUCTION_DEPLOY=enabled`, chuẩn bị Secrets `GU_DEPLOY_SSH_KEY`, `GU_SSH_KNOWN_HOSTS`; GitHub environment `gu-v5-production` giới hạn nhánh `main` và không có Required reviewers nếu muốn tự động hoàn toàn. Nên giữ branch protection PR+CI nếu làm việc nhiều người.

## 4. Đưa Rev7.5 source lên GitHub một lần

Tạo worktree sạch từ `origin/main`, chép nội dung ZIP vào nhưng không đè `.git`; không sao chép `.env`, DB backup, uploads. Chạy:

```powershell
npm ci
if ($LASTEXITCODE -ne 0) { throw 'npm ci FAILED' }
foreach ($s in 'verify:release','typecheck','test','test:vps','build') {
  npm run $s
  if ($LASTEXITCODE -ne 0) { throw "FAILED: $s" }
}
git add -A
git diff --cached --check
git diff --cached --name-only
# Xác nhận không stage secrets / ảnh thật / dữ liệu khách hàng.
git commit -m 'GU Rev7.5 - guarded local backup and auto production'
git push origin HEAD:main
```

Nếu main có commit mới, sync và giải quyết xung đột trước push. Không dùng `--force`.

Sau push, GitHub Actions chạy CI trước khi deploy (mã ở `.github/workflows/deploy-main.yml`), version sẽ ở `http://127.0.0.1:3302/api/version` và public `https://guthuedo.io.vn/api/version`. Không tự kích hoạt push trên máy VPS.

## 5. Offsite định kỳ thủ công

Bản backup `gu-prod-20261029-030843-v2.tar.gpg` bạn đã chuyển Windows và giải mã thử thành công chỉ bảo vệ trạng thái đến 03:08 ngày 29/10/2026. Mỗi ngày hoặc sau nhiều giao dịch mới, tạo một gói GPG mới từ snapshot local và tải về Windows, đối chiếu SHA-256. **Không giữ file `.tar.gpg` duy nhất từ ngày 29/10 mãi mà coi là đủ.**

Nếu muốn tự động hoàn toàn offsite, cần máy Windows/NAS/SFTP luôn online. Không bắt buộc dùng cloud nhưng cần nơi khác VPS.
