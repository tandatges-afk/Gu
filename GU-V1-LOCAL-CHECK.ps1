param([string]$Repo = $PSScriptRoot)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $Repo
if (-not (Test-Path -LiteralPath '.\package.json')) { throw 'Không thấy package.json trong thư mục GU.' }
$pkg = Get-Content -LiteralPath '.\package.json' -Raw | ConvertFrom-Json
if ($pkg.version -ne '1.0.0') { throw "Đây không phải GU v1: $($pkg.version)" }
$nodeMajor = [int]((& node -p 'process.versions.node.split(".")[0]').Trim())
if ($LASTEXITCODE -ne 0 -or $nodeMajor -ne 22) { throw 'Cần Node.js 22.x.' }
if (-not (Test-Path -LiteralPath '.\node_modules\next')) {
 Write-Host 'Đang cài dependencies với npm ci...' -ForegroundColor Cyan
 & npm ci
 if ($LASTEXITCODE -ne 0) { throw 'npm ci failed' }
}
foreach ($step in @('verify:release','typecheck','test','test:vps','build')) {
 Write-Host "RUN: npm run $step" -ForegroundColor Cyan
 & npm run $step
 if ($LASTEXITCODE -ne 0) { throw "FAILED: $step" }
 Write-Host "PASS: $step" -ForegroundColor Green
}
Write-Host 'GU V1 LOCAL ALL CHECKS PASSED' -ForegroundColor Green
Write-Host 'Không có commit/push/deploy tự động trong script này.'
