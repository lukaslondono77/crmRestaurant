# Install everything needed: Node.js (includes npm) + project dependencies + database
# Run in PowerShell. You may see a prompt to allow the Node.js installer.

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$backend = Join-Path $root "backend"

Write-Host ""
Write-Host "CRM Restaurant - Install everything needed" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# 1. Install Node.js (includes npm) if not present
$needNode = $false
try {
    $v = node --version 2>$null
    if (-not $v) { $needNode = $true }
} catch { $needNode = $true }
if ($needNode) {
    Write-Host "Installing Node.js LTS (includes npm) via winget..." -ForegroundColor Yellow
    winget install OpenJS.NodeJS.LTS -e --accept-package-agreements --accept-source-agreements
    Write-Host "Node.js installed. You must CLOSE and REOPEN PowerShell, then run this script again to finish setup." -ForegroundColor Green
    Write-Host "Or run: .\setup-missing.ps1" -ForegroundColor Gray
    exit 0
}

Write-Host "Node.js: $(node --version)  |  npm: $(npm --version)" -ForegroundColor Green
Write-Host ""

# 2. Run full setup (dependencies + database)
& (Join-Path $root "setup-missing.ps1")

Write-Host ""
Write-Host "All set. Start the app with: .\run-one-server.bat" -ForegroundColor Green
Write-Host "Then open: http://localhost:8000/core/index.html" -ForegroundColor White
Write-Host ""
