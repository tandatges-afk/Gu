param(
  [string]$Target = "$env:USERPROFILE\Desktop\GU-V5-MAIN-READY"
)
$ErrorActionPreference = 'Stop'
$source = Split-Path -Parent $PSScriptRoot
if (!(Test-Path (Join-Path $source 'src\app\api\uploads\route.ts'))) { throw 'ZIP thieu API upload' }
if (!(Test-Path (Join-Path $source 'src\lib\inspection-photo-url.ts'))) { throw 'ZIP thieu Fix5' }
if (!(Test-Path (Join-Path $Target '.git'))) { throw "Khong tim thay Git repo: $Target" }
$branch = (& git -C $Target branch --show-current).Trim()
if ($LASTEXITCODE -ne 0 -or $branch -ne 'main') { throw 'Chi ap dung tren Git branch main' }
$dirty = & git -C $Target status --porcelain
if ($LASTEXITCODE -ne 0 -or $dirty) { throw 'Repo dang co thay doi. Hay commit/stash va xem lai truoc khi cap nhat.' }
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backup = "backup/before-full-fix5-$stamp"
& git -C $Target branch $backup
if ($LASTEXITCODE -ne 0) { throw 'Khong tao duoc backup branch' }
Write-Host "Backup branch: $backup" -ForegroundColor Cyan
$root = (Resolve-Path $source).Path.TrimEnd('\','/')
$skip = @('package-lock.json')
$copied = 0
Get-ChildItem -LiteralPath $root -File -Recurse -Force | ForEach-Object {
  $rel = $_.FullName.Substring($root.Length).TrimStart('\','/')
  $relUnix = $rel.Replace('\','/')
  if ($relUnix -match '^(\.git/|node_modules/|\.next/)' -or $relUnix -in $skip) { return }
  $dest = Join-Path $Target $rel
  $dir = Split-Path -Parent $dest
  if (!(Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
  Copy-Item -LiteralPath $_.FullName -Destination $dest -Force
  $script:copied++
}
Write-Host "Da copy $copied files. Khong sua .env hay PostgreSQL. Khong commit/push." -ForegroundColor Green
Write-Host 'Tiep theo: npm install --package-lock-only; npm ci; npm run typecheck; npm test; npm run build'
& git -C $Target status --short
