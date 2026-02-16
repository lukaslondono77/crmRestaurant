# Push all changes to GitHub
# Run this AFTER installing Git: https://git-scm.com/download/win
# Usage: powershell -ExecutionPolicy Bypass -File .\push-to-github.ps1

$ErrorActionPreference = "Stop"
$repo = "https://github.com/lukaslondono77/crmRestaurant.git"

Write-Host "Checking for Git..." -ForegroundColor Cyan
$git = $null
if (Get-Command git -ErrorAction SilentlyContinue) { $git = "git" }
elseif (Test-Path "C:\Program Files\Git\bin\git.exe") { $git = "C:\Program Files\Git\bin\git.exe" }
elseif (Test-Path "C:\Program Files (x86)\Git\bin\git.exe") { $git = "C:\Program Files (x86)\Git\bin\git.exe" }

if (-not $git) {
    Write-Host "ERROR: Git is not installed." -ForegroundColor Red
    Write-Host "Download and install from: https://git-scm.com/download/win" -ForegroundColor Yellow
    Write-Host "Then restart Cursor and run this script again." -ForegroundColor Yellow
    exit 1
}

Set-Location $PSScriptRoot

# Init repo if needed
if (-not (Test-Path ".git")) {
    Write-Host "`nInitializing git repo..." -ForegroundColor Cyan
    & $git init
}

Write-Host "`nConfiguring remote..." -ForegroundColor Cyan
& $git remote remove origin 2>$null
& $git remote add origin $repo

Write-Host "`nStaging changes..." -ForegroundColor Cyan
& $git add .

Write-Host "`nCommitting..." -ForegroundColor Cyan
& $git commit -m "Performance optimizations, AI_CONTEXT, comoIniciar docs, env fixes, CORS, Docker" 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Nothing to commit (or already committed)." -ForegroundColor Gray
}

Write-Host "`nPushing to GitHub..." -ForegroundColor Cyan
& $git branch -M main 2>$null
& $git push -u origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host "`nDone! Changes pushed to https://github.com/lukaslondono77/crmRestaurant" -ForegroundColor Green
} else {
    Write-Host "`nPush failed. You may need to: authenticate (GitHub login), or pull first." -ForegroundColor Yellow
    exit 1
}
