@echo off
setlocal

title CRM Restaurant - Backend + Frontend
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 goto :node_missing

cd backend
if exist node_modules goto :start_server

echo Installing dependencies (first time)...
call npm install
if errorlevel 1 goto :install_failed

goto :start_server

:node_missing
echo Node.js not found. Install from https://nodejs.org
echo Then close and reopen this window and run again.
pause
exit /b 1

:install_failed
echo npm install failed.
pause
exit /b 1

:start_server
echo Starting server (backend + frontend on one port)...
echo Open in browser: http://localhost:8000/core/index.html
echo.
start "" "http://localhost:8000/core/index.html"
call npm start
pause
