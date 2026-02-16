# Install Python on Windows (for the frontend server)
# Run in PowerShell as Administrator for system-wide install, or normally for current user.

$ErrorActionPreference = "Stop"
Write-Host ""
Write-Host "Python installer for CRM Restaurant" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Check if already installed
try {
    $version = python --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Python is already installed: $version" -ForegroundColor Green
        Write-Host "You're good to go. Restart the terminal if you just installed it." -ForegroundColor Gray
        exit 0
    }
} catch {}

# Try winget first (Windows 10/11)
try {
    $winget = Get-Command winget -ErrorAction Stop
    Write-Host "Installing Python via winget (Python 3.12)..." -ForegroundColor Yellow
    winget install --id Python.Python.3.12 -e --accept-package-agreements --accept-source-agreements
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "Python installed. Close and reopen PowerShell, then run: python --version" -ForegroundColor Green
        Write-Host "Then you can use the frontend with: cd fila; python server.py" -ForegroundColor Gray
        exit 0
    }
} catch {
    Write-Host "winget not available or install failed." -ForegroundColor Yellow
}

# Fallback: open download page
Write-Host ""
Write-Host "Opening Python download page..." -ForegroundColor Yellow
Write-Host "  - Download the Windows installer (e.g. Python 3.12)" -ForegroundColor Gray
Write-Host "  - Run it and CHECK 'Add python.exe to PATH' at the bottom" -ForegroundColor Gray
Write-Host "  - Restart PowerShell after installing" -ForegroundColor Gray
Write-Host ""
Start-Process "https://www.python.org/downloads/"
Write-Host "Done. After installing, restart your terminal." -ForegroundColor Green
