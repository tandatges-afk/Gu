param(
  [string]$Repo = 'C:\Users\Admin\Desktop\GU-REV77-UI',
  [string]$Patch = (Join-Path $PSScriptRoot 'GU-v1-from-Rev7.9.7.patch')
)
$ErrorActionPreference = 'Stop'
if (-not (Test-Path -LiteralPath $Repo)) { throw "Không tìm thấy thư mục: $Repo" }
if (-not (Test-Path -LiteralPath $Patch)) { throw "Không tìm thấy patch: $Patch" }
Set-Location -LiteralPath $Repo
& git rev-parse --show-toplevel | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Thư mục không phải Git repository.' }
$dirty = @(& git status --porcelain)
if ($dirty.Count -gt 0) { throw 'Source có file chưa commit. Sao lưu hoặc commit phiên bản đang dùng trước khi áp dụng patch.' }
& git apply --check -- $Patch
if ($LASTEXITCODE -ne 0) { throw 'Patch không khớp source Rev7.9.7 hiện tại. Không áp dụng.' }
& git apply -- $Patch
if ($LASTEXITCODE -ne 0) { throw 'APPLY FAILED' }
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Repo 'GU-V1-LOCAL-CHECK.ps1') -Repo $Repo
if ($LASTEXITCODE -ne 0) { throw 'Kiểm tra GU v1 chưa đạt. Không push.' }
Write-Host 'GU V1 PATCH APPLIED AND LOCAL CHECKS PASSED' -ForegroundColor Green
Write-Host 'Chưa commit, push hoặc deploy.'
