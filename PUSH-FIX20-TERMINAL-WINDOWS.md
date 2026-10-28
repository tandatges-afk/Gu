# GU Fix20 — Push bằng PowerShell vào repo Git đã có

**Repo người dùng:** `C:\Users\Admin\Desktop\GU-MAIN-READY`. **Không clone lại, không xóa `.git`, không force push.**

**Bản nguồn:** ZIP Fix20 build repair rev3, chứa thư mục `Gu-main/` ở cấp đầu. Phần kiểm tra và deploy trên VPS nằm trong `FIX20-HUONG-DAN-TRIEN-KHAI.md`. ZIP này **chưa được kiểm tra thực tế trên VPS của cửa hàng**; push chỉ chạy kiểm tra CI, không phải cutover production.

## 1. Kiểm tra kho Git TRƯỚC KHI chép mã

Mở **PowerShell** trong VS Code. Các lệnh sau dùng trên máy Windows, **không chạy qua SSH**.

```powershell
$repo = 'C:\Users\Admin\Desktop\GU-MAIN-READY'
$zip = 'C:\Users\Admin\Downloads\GU_FIX20_BUILD_REPAIR_REV3_FULL_SOURCE.zip'
if (!(Test-Path -LiteralPath "$repo\.git")) { throw "Không thấy Git repo tại $repo. Dừng." }
if (!(Test-Path -LiteralPath $zip)) { throw "Không thấy ZIP: $zip. Dời ZIP mới tải vào Downloads hoặc sửa đường dẫn." }
Set-Location -LiteralPath $repo
git status -sb
git remote -v
$branch = (git branch --show-current).Trim()
if ($branch -ne 'main') { throw "Đang ở nhánh '$branch', không phải main. Dừng để kiểm tra." }
if ((git status --porcelain).Length -gt 0) { throw 'Repo đang có thay đổi chưa commit. Sao lưu/commit/stash thay đổi của chính bạn rồi làm lại.' }
git fetch origin main
if ($LASTEXITCODE -ne 0) { throw 'Không fetch được origin/main' }
git pull --ff-only origin main
if ($LASTEXITCODE -ne 0) { throw 'Không thể fast-forward main. Dừng; KHÔNG force push.' }
```

**Nhìn `git remote -v`** để chắc chắn đang thao tác đúng GitHub của GU, không phải Amorri/Élia. Không chạy tiếp nếu nghi ngờ.

## 2. Giải nén bản hoàn chỉnh và chép vào repo

```powershell
$unpack = Join-Path $env:TEMP ('GU_FIX20_' + [guid]::NewGuid().ToString('N'))
Expand-Archive -LiteralPath $zip -DestinationPath $unpack
$src = Join-Path $unpack 'Gu-main'
if (!(Test-Path -LiteralPath "$src\package-lock.json") -or !(Test-Path -LiteralPath "$src\.github\workflows\deploy-main.yml")) {
    throw 'ZIP không đúng cấu trúc Fix20. Dừng.'
}
# /E = copy toàn bộ file trong Gu-main (không xóa file cũ tại repo).
# Không ghi đè Git metadata, mật khẩu, thư mục cache hoặc dữ liệu backup.
# KHÔNG loại trừ thư mục có tên uploads: cần copy đúng src/app/api/uploads/route.ts.
# ZIP nguồn này không chứa ảnh tải lên hay database thực tế.
robocopy $src $repo /E /R:1 /W:1 /XD .git node_modules .next .vscode backups /XF .env .env.local .env.production .env.development '*.pem' '*.key' '*.dump' '*.zip'
if ($LASTEXITCODE -ge 8) { throw "Copy không thành công, robocopy code=$LASTEXITCODE" }
Set-Location -LiteralPath $repo
```

**Không dùng** `windows/01-replace-main-safely.ps1` hoặc `windows/apply-full-source.ps1` của bản RC cũ. Không dùng `robocopy /MIR` vì sẽ xóa file hiện có, có thể gồm cấu hình và dữ liệu chưa sao lưu.

Kiểm tra GitHub Actions cũ. Bộ Fix20 chỉ có `deploy-main.yml`; workflow còn sót có thể vẫn **tự triển khai Production**:

```powershell
Get-ChildItem -LiteralPath '.github\workflows' -File | Select-Object Name
$old = @(Get-ChildItem -LiteralPath '.github\workflows' -File | Where-Object Name -ne 'deploy-main.yml')
if ($old.Count -gt 0) {
    $old | ForEach-Object { Write-Warning "WORKFLOW CŨ CẦN KIỂM TRA: $($_.FullName)" }
    throw 'Còn workflow ngoài Fix20. Hãy xem, sao lưu và gỡ workflow tự deploy cũ TRƯỚC khi push.'
}
```

Nếu Git còn `git status --porcelain` báo sửa/xóa những file cá nhân không mong muốn, **dừng lại để kiểm tra**. ZIP không có khả năng xác minh nội dung đang nằm trong repo Windows.

## 3. Dọn source cũ còn sót trước khi build

`robocopy /E` không xóa các route của bản cũ. Sau khi copy, chạy kiểm tra (không sửa dữ liệu):

```powershell
npm run source:check
```

Nếu phát hiện `STALE`, chạy lệnh dưới đây để **chuyển** các file `.ts/.tsx/.js/.jsx/.mjs/.cjs` không thuộc bộ Fix20 ra thư mục backup cùng cấp với `GU-MAIN-READY`:

```powershell
npm run source:prune
npm run source:check
```

Xem đường dẫn backup được in trong terminal; không xóa nó trước khi kiểm tra Git diff. Script sẽ từ chối dọn nếu source từ ZIP chưa được chép đầy đủ. Sau khi dọn file cũ, bạn có thể xóa cache `.next` (không chứa dữ liệu đơn hàng):

```powershell
if (Test-Path -LiteralPath '.next') { Remove-Item -LiteralPath '.next' -Recurse -Force }
```

Sau đó mới chạy kiểm thử.

## 4. Cài dependencies và kiểm thử trên máy

Kiểm tra `node -v`: dùng Node **22.x**. Ở thư mục `GU-MAIN-READY`:

```powershell
node -v
npm ci
if ($LASTEXITCODE -ne 0) { throw 'npm ci thất bại; không push' }
npm run verify:release
if ($LASTEXITCODE -ne 0) { throw 'verify:release thất bại; không push' }
npm run typecheck
if ($LASTEXITCODE -ne 0) { throw 'typecheck thất bại; không push' }
npm test
if ($LASTEXITCODE -ne 0) { throw 'test thất bại; không push' }
npm run test:vps
if ($LASTEXITCODE -ne 0) { throw 'test:vps thất bại; không push' }
npm run build
if ($LASTEXITCODE -ne 0) { throw 'build thất bại; không push' }
```

**Không tự chỉnh lockfile** nếu `npm ci` lỗi. Gửi nguyên log để tìm đúng nguyên nhân. Kết quả test local không chứng minh đã chạy an toàn với hai tài khoản hoặc DB thật.

## 5. Commit và push main qua terminal

```powershell
Set-Location -LiteralPath 'C:\Users\Admin\Desktop\GU-MAIN-READY'
git diff --check
git status --short
git add -A
git diff --cached --stat
git diff --cached --name-only
git diff --cached --check
```

**Kiểm tra trong `git diff --cached --name-only` không có** `.env.local`, `id_rsa`, private keys, `uploads/`, ảnh khách, file `.sql`/`.dump`, thư mục `node_modules`/`.next`, hoặc workflow deploy Production ngoài `deploy-main.yml`.

Sau khi đã xem danh sách thay đổi:

```powershell
git commit -m "GU Fix20 rev3 - remove stale routes and fix build tracing"
if ($LASTEXITCODE -ne 0) { throw 'Commit thất bại' }
git push origin main
if ($LASTEXITCODE -ne 0) { throw 'Push thất bại: kiểm tra GitHub login/branch, KHÔNG force push.' }
git rev-parse HEAD
git status -sb
```

Nếu `git push` yêu cầu đăng nhập, đăng nhập qua trình duyệt/Git Credential Manager. Nếu xuất hiện `non-fast-forward`, **không** dùng `--force`: `git fetch origin main` rồi kiểm tra lịch sử và thay đổi trước khi merge.

## 6. Sau khi push

- Vào `https://github.com/tandatges-afk/Gu/actions`, chọn workflow **GU Fix20 — Validate / Stage / Controlled Production**. Push `main` **chỉ chạy `validate`** với file workflow Fix20 mới; chưa deploy Stage/Prod.
- Nếu CI báo đỏ, **không** triển khai staging/production. Gửi ảnh/log bước lỗi.
- Chỉ sau khi CI xanh: cài root release script mới `vps-main/gu-v5-release` lên VPS (sau khi đã xác minh host), chuẩn bị staging DB `gu_v546_stage` + migration/index và backup, rồi chạy workflow thủ công `target=stage`.
- **Không bật production** cho đến khi có UAT hai nhân viên, backup/restore và phê duyệt. Bản app đã push `main` không chứng minh đang chạy trên VPS.

## Những chỗ cần đặc biệt chú ý

- Bản này không tự sửa database trên Windows. Script index `db:optimize` bị khóa chỉ với DB `gu_v546_stage` hoặc `gu_v546_prod` nằm trên localhost, production cần cờ cho phép riêng.
- Script GC ảnh sản phẩm bắt buộc `GU_UPLOAD_DIR` đúng với database, chống trỏ nhầm staging sang ảnh Production.
- `db:preflight` kiểm tra trạng thái VALID/READY thực sự của chỉ mục PostgreSQL, không chỉ kiểm tra tên index; index lỗi `CREATE INDEX CONCURRENTLY` cần điều tra và sửa an toàn.
- README/RC1 cũ được giữ làm lịch sử, không dùng để chạy replace-main hoặc deploy tự động.
