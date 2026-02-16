# Setup everything that's missing: .env, node_modules, database
# Run from project root in PowerShell. Requires Node.js installed.

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$backend = Join-Path $root "backend"

# Check Node/npm available
try { $null = Get-Command node -ErrorAction Stop } catch {
    Write-Host "Node.js not found. Install from https://nodejs.org and run this script again." -ForegroundColor Red
    exit 1
}
try { $null = Get-Command npm -ErrorAction Stop } catch {
    Write-Host "npm not found. Ensure Node.js is installed and on your PATH." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "CRM Restaurant - Setup (install missing)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Ensure .env exists (backend for local run, root for Docker)
$rootEnvPath = Join-Path $root ".env"
if (-not (Test-Path $rootEnvPath)) {
    Write-Host "Creating root .env for Docker from .env.example..." -ForegroundColor Yellow
    $rootExample = Join-Path $root ".env.example"
    if (Test-Path $rootExample) {
        Copy-Item $rootExample $rootEnvPath
        Write-Host "  Created .env (Docker Compose will use this)" -ForegroundColor Green
    }
}
$envPath = Join-Path $backend ".env"
if (-not (Test-Path $envPath)) {
    Write-Host "Creating backend/.env from .env.example..." -ForegroundColor Yellow
    $example = Join-Path $backend ".env.example"
    $content = Get-Content $example -Raw
    # Add a generated JWT_SECRET (64 hex chars)
    $jwt = -join ((48..57) + (97..102) | Get-Random -Count 64 | ForEach-Object { [char]$_ })
    $content = $content -replace "JWT_SECRET=.*", "JWT_SECRET=$jwt"
    Set-Content -Path $envPath -Value $content -NoNewline
    Write-Host "  Created .env with JWT_SECRET" -ForegroundColor Green
} else {
    Write-Host "backend/.env already exists" -ForegroundColor Green
}

# 2. Install backend dependencies
Set-Location $backend
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing backend dependencies (npm install)..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "npm install failed. Is Node.js installed and on PATH?" -ForegroundColor Red
        exit 1
    }
    Write-Host "  Dependencies installed" -ForegroundColor Green
} else {
    Write-Host "backend/node_modules already present" -ForegroundColor Green
}

# 3. Create database (init + migrate)
$dbPath = Join-Path $backend "database\restaurant_cost.db"
if (-not (Test-Path $dbPath)) {
    Write-Host "Creating database (init + migrations)..." -ForegroundColor Yellow
    node (Join-Path $backend "database\init.js")
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Database init failed." -ForegroundColor Red
        exit 1
    }
    npm run migrate
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Migrations failed." -ForegroundColor Red
        exit 1
    }
    Write-Host "  Database created and migrated" -ForegroundColor Green
} else {
    Write-Host "Database already exists (database/restaurant_cost.db)" -ForegroundColor Green
}

# 4. Ensure uploads dir exists
$uploads = Join-Path $backend "uploads"
if (-not (Test-Path $uploads)) {
    New-Item -ItemType Directory -Path $uploads -Force | Out-Null
    Write-Host "Created backend/uploads" -ForegroundColor Green
}

Set-Location $root
Write-Host ""
Write-Host "Setup complete. You can run:" -ForegroundColor Green
Write-Host "  .\start-dev.ps1    # Start backend + frontend and open browser" -ForegroundColor White
Write-Host "  Or: cd backend; npm run dev   and   cd fila; python server.py" -ForegroundColor Gray
Write-Host ""
