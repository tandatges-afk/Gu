# Run from project root in VS Code Terminal / PowerShell.
# This script does not access Firebase, modify production data, commit, or push.
$ErrorActionPreference = 'Stop'
if (!(Test-Path 'package.json')) { throw 'Chay script tai thu muc goc GU (chua package.json).' }
$nodeVersion = (& node -v)
if ($LASTEXITCODE -ne 0) { throw 'Node.js chua cai dat. Can Node 22.x.' }
Write-Host "Node $nodeVersion"
if ($nodeVersion -notmatch '^v22\.') { throw 'DU AN GU yêu cầu Node 22.x. Hãy dùng Node 22 rồi chạy lại.' }
$tasks = @('npm install', 'npm run verify:release', 'npm run test', 'npm run typecheck', 'npm run build')
foreach ($command in $tasks) {
  Write-Host "`n>>> $command" -ForegroundColor Cyan
  & cmd /c $command
  if ($LASTEXITCODE -ne 0) { throw "THAT BAI: $command. Chua nen push Production." }
}
Write-Host 'Kiem tra hoan tat. Ban can thu UI AI tren localhost va Vercel Preview.' -ForegroundColor Green
