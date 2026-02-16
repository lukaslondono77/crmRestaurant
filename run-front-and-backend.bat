@echo off
title CRM Restaurant - Backend + Frontend
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js not found. Install from https://nodejs.org then run this again.
  pause
  exit /b 1
)

cd backend

if not exist "node_modules" (
  echo Installing dependencies (first time)...
  call npm install
  if errorlevel 1 (
    echo npm install failed.
    pause
    exit /b 1
  )
  echo.
)

echo Starting server (backend + frontend on http://localhost:8000)...
echo.
echo Open in browser: http://localhost:8000/core/index.html
echo Press Ctrl+C to stop.
echo.
start "" "http://localhost:8000/core/index.html"
call npm start
pause
