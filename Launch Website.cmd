@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 22.12 or newer is required.
  pause
  exit /b 1
)
if not exist dist\index.html (
  echo Please run npm install and npm run build first.
  pause
  exit /b 1
)
start "" http://127.0.0.1:5180
node scripts\serve.mjs
pause
