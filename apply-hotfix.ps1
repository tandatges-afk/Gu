# Apply only the sensitive-evidence cleanup fix to the current project.
$ErrorActionPreference = 'Stop'
$source = Join-Path $PSScriptRoot 'src\lib\sensitive-evidence-cleanup.ts'
$target = Join-Path (Get-Location).Path 'src\lib\sensitive-evidence-cleanup.ts'
if (-not (Test-Path $source)) { throw "Không tìm thấy file vá: $source" }
if (-not (Test-Path $target)) { throw "Không tìm thấy file nguồn trong thư mục hiện tại: $target. Hãy mở đúng thư mục GU." }
$original = Get-Content -Raw -Encoding UTF8 $target
if ($original -notmatch 'sensitiveEvidenceCleanup' -or $original -notmatch 'removeRemote') {
  throw 'File hiện tại khác phiên bản dự kiến; không tự ghi đè.'
}
$backup = "$target.backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
Copy-Item -LiteralPath $target -Destination $backup
Copy-Item -LiteralPath $source -Destination $target -Force
Write-Host "Đã sao lưu file cũ: $backup"
Write-Host 'Đã áp dụng hotfix. Chạy: npm.cmd run typecheck; npm.cmd run test; npm.cmd run build'
