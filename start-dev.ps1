# Start CRM Restaurant - backend (8000) + frontend (3000)
# Run this in PowerShell from the project root. Requires Node.js only.

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

# Check Node/npm
try { $null = Get-Command npm -ErrorAction Stop } catch {
    Write-Host "Node.js not found. Install from https://nodejs.org then run this script again." -ForegroundColor Red
    exit 1
}

Write-Host "Starting CRM Restaurant" -ForegroundColor Cyan
Write-Host ""

# Start backend in a new window
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\backend'; Write-Host 'Backend - http://localhost:8000' -ForegroundColor Green; npm run dev"

# Frontend: use Python if available, else npx serve
$usePython = $false
try {
    $null = Get-Command python -ErrorAction Stop
    $usePython = $true
} catch {}
if ($usePython) {
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\fila'; Write-Host 'Frontend - http://localhost:3000' -ForegroundColor Green; python server.py"
} else {
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root'; Write-Host 'Frontend - http://localhost:3000 (Node)' -ForegroundColor Green; npx --yes serve fila -p 3000"
}

Start-Sleep -Seconds 4
Write-Host "Opening app in browser..." -ForegroundColor Yellow
Start-Process "http://localhost:3000/core/index.html"

Write-Host ""
Write-Host "Done. Frontend: http://localhost:3000  |  Backend: http://localhost:8000" -ForegroundColor Green
Write-Host "Close the two PowerShell windows to stop the servers." -ForegroundColor Gray
