# Windows PowerShell 5.1+; DO NOT FORCE-PUSH or delete Git history.
param(
  [string]$Archive = "$env:USERPROFILE\Downloads\GU_V5_546_FAST_MAIN_RC1.zip",
  [string]$Target = "$env:USERPROFILE\Desktop\GU-V5-MAIN-READY"
)
$ErrorActionPreference = 'Stop'
$repo = 'https://github.com/tandatges-afk/Gu.git'
if (!(Test-Path -LiteralPath $Archive)) { throw "File ZIP khong ton tai: $Archive" }
if (Test-Path -LiteralPath $Target) { throw "Thu muc $Target da ton tai. Khong ghi de; chon ten Target moi." }
foreach ($tool in @('git','node','npm')) { if (!(Get-Command $tool -ErrorAction SilentlyContinue)) { throw "Chua cai $tool" } }
$temp = Join-Path $env:TEMP ("gu-v5-src-" + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $temp | Out-Null
try {
  Expand-Archive -LiteralPath $Archive -DestinationPath $temp
  if (!(Test-Path (Join-Path $temp 'src/lib/pg-firestore.ts')) -or !(Test-Path (Join-Path $temp '.github/workflows/deploy-main.yml'))) {
    throw 'File ZIP khong phai bo GU V5 MAIN hoan chinh.'
  }
  $version = (& node -p "require('$($temp.Replace('\','/'))/package.json').version").Trim()
  if ($LASTEXITCODE -ne 0 -or $version -ne '5.4.6-vps.fast-rc.1') {throw "Phien ban khong khop: $version"}
  & git clone --branch main --single-branch $repo $Target
  if ($LASTEXITCODE -ne 0) {throw 'Clone main that bai'}
  Push-Location $Target
  try {
    if ((& git status --porcelain)) {throw 'Working tree khong sach'}
    $tag='backup/main-before-v5-' + (Get-Date -Format 'yyyyMMdd-HHmmss')
    & git tag -a $tag -m 'Snapshot main before GU V5 migration'
    if ($LASTEXITCODE -ne 0) {throw 'Khong tao duoc tag'}
    & git push origin "refs/tags/$tag"
    if ($LASTEXITCODE -ne 0) {throw 'Khong day duoc tag sao luu, dung lai'}
    Write-Host "DA SAO LUU MAIN: $tag" -ForegroundColor Green
    # Remove old tracked code from MAIN working tree, not from Git history or VPS.
    & git rm -r -- .
    if ($LASTEXITCODE -ne 0) {throw 'git rm loi'}
    Get-ChildItem -LiteralPath $temp -Force | ForEach-Object {
      Copy-Item -LiteralPath $_.FullName -Destination $Target -Recurse -Force
    }
    # Generate the lockfile using the REAL npm resolver on user's Windows machine.
    Write-Host 'Dang tao package-lock.json. May can truy cap npm registry...' -ForegroundColor Cyan
    & npm install --package-lock-only --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw 'npm install --package-lock-only that bai. KHONG PUSH.' }
    & git add -A
    if ($LASTEXITCODE -ne 0) {throw 'git add that bai'}
    & git diff --cached --check
    if ($LASTEXITCODE -ne 0) {throw 'Git whitespace check failed, sua truoc khi commit'}
    $files=@(& git diff --cached --name-only)
    foreach ($file in $files) {
      if ($file -match '(^|/)(\.env\.local|\.env\.production|id_ed25519|id_rsa|authorized_keys)$' -or $file -match '\.(pem|key|dump|tar\.gz)$') {
        throw "Sensitive file staged: $file"
      }
    }
    Write-Host '===== REVIEW DIFF =====' -ForegroundColor Yellow
    & git diff --cached --stat
    Write-Host "DA CHUAN BI main V5. CHUA PUSH. Old main backup: $tag" -ForegroundColor Green
    Write-Host "FOLDER: $Target"
    Write-Host 'TIEP THEO: npm ci; npm run typecheck; npm test; npm run build; git commit; git push origin main'
  } finally { Pop-Location }
} finally {
  if (Test-Path -LiteralPath $temp) { Remove-Item -LiteralPath $temp -Recurse -Force }
}
