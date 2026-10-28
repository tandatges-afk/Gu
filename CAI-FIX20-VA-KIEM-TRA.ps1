# GU Fix20 Integrated Rev6 - safe, repeatable installation in a NEW Git worktree.
# Does not change the original worktree, push GitHub, or touch live VPS/DB/media.
param(
    [string]$RepoPath = (Join-Path $env:USERPROFILE 'Desktop\GU-MAIN-READY'),
    [string]$WorktreePath = (Join-Path $env:USERPROFILE 'Desktop\GU-FIX20-REV6-VERIFIED'),
    [string]$Branch = 'gu-fix20-integrated-rev6'
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
function Invoke-Checked([string]$Exe, [string[]]$ArgList) {
    Write-Host ('> ' + $Exe + ' ' + ($ArgList -join ' ')) -ForegroundColor Cyan
    & $Exe @ArgList
    if ($LASTEXITCODE -ne 0) { throw "Command failed: $Exe (exit $LASTEXITCODE). No commit/push was performed." }
}
function Get-GitOutput([string[]]$ArgList) {
    $result = & git @ArgList
    if ($LASTEXITCODE -ne 0) { throw "Git command failed: git $($ArgList -join ' ')" }
    return (($result | Out-String).Trim())
}
$source = $PSScriptRoot
$required = @('package.json','package-lock.json','scripts\gu-fix20-source-manifest.json', '.github\workflows\deploy-main.yml','src\app\page.tsx')
foreach ($entry in $required) {
    if (-not (Test-Path -LiteralPath (Join-Path $source $entry) -PathType Leaf)) {
        throw "Incomplete extracted Rev6 source: missing $entry. Extract the FULL ZIP first."
    }
}
$expectedBase = 'a076693d4baf7f2d09992e5c97bb8d6d355159f9'
$repoTop = Get-GitOutput @('-C',$RepoPath,'rev-parse','--show-toplevel')
if (-not $repoTop) { throw "Not a Git repository: $RepoPath" }
$version = Get-GitOutput @('-C',$RepoPath,'rev-parse','--is-inside-work-tree')
if ($version -ne 'true') { throw 'GU-MAIN-READY must be a Git working tree.' }
# Verify source integrity before creating a destination.
Invoke-Checked node @((Join-Path $source 'scripts\gu-fix20-package-check.mjs'), $source)
Invoke-Checked git @('-C',$RepoPath,'fetch','origin','main:refs/remotes/origin/main')
$remoteBase = Get-GitOutput @('-C',$RepoPath,'rev-parse','refs/remotes/origin/main')
if ($remoteBase -ne $expectedBase) {
    throw "GitHub main changed ($remoteBase). This package integrates only $expectedBase. Do not overwrite or force push: re-review integration first."
}
# Never overwrite an existing worktree, even when a previous installation failed.
# Automatically choose a unique directory and branch for repeated attempts.
$folder = $WorktreePath; $branchName = $Branch; $suffix = 1
while ((Test-Path -LiteralPath $folder) -or ((& git -C $RepoPath branch --list $branchName) | Measure-Object -Line).Lines -gt 0) {
    $suffix++
    if ($suffix -gt 50) { throw 'Too many prior installs. Specify a new -WorktreePath and -Branch explicitly.' }
    $folder = "$WorktreePath-$suffix"
    $branchName = "$Branch-$suffix"
}
Write-Host "Creating isolated worktree: $folder (branch $branchName)" -ForegroundColor Cyan
Invoke-Checked git @('-C',$RepoPath,'worktree','add','-b',$branchName,$folder,'refs/remotes/origin/main')
Write-Host 'Copying complete Rev6 source (old repository stays unchanged)...' -ForegroundColor Cyan
& robocopy $source $folder /E /R:1 /W:1 /XD .git node_modules .next .vscode backups /XF .env .env.local .env.production .env.development *.pem *.key *.dump *.zip
$rc = $LASTEXITCODE
if ($rc -ge 8) { throw "Robocopy failed ($rc). Worktree retained for inspection, never pushed." }
Push-Location $folder
try {
    Invoke-Checked node @('scripts/gu-fix20-package-check.mjs', '.')
    Invoke-Checked node @('scripts/gu-fix20-source-guard.mjs','--check')
    Invoke-Checked npm.cmd @('ci','--no-audit','--no-fund')
    Invoke-Checked npm.cmd @('run','verify:release')
    Invoke-Checked npm.cmd @('run','typecheck')
    Invoke-Checked npm.cmd @('test')
    Invoke-Checked npm.cmd @('run','test:vps')
    Invoke-Checked npm.cmd @('run','build')
    Invoke-Checked git @('diff','--check')
    Write-Host ''
    Write-Host 'PASS: package integrity, npm, source, imports, TS, unit tests, VPS tests, Next production build.' -ForegroundColor Green
    Write-Host 'These checks DO NOT establish live PostgreSQL/UAT, restore, or Production approval.'
    Write-Host "Worktree: $folder"
    Write-Host "Branch: $branchName"
    Write-Host 'Review git status and source changes, then commit/push THIS BRANCH only.'
} finally {
    Pop-Location
}
