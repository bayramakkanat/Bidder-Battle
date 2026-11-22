@echo off
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js kurulu degil. https://nodejs.org adresinden kurup tekrar deneyin. & pause & exit /b)
if not exist node_modules (echo Ilk kurulum yapiliyor, biraz bekleyin... & call npm install)
start "" /min cmd /c "timeout /t 3 >nul & start http://localhost:3000"
node server.js
pause
