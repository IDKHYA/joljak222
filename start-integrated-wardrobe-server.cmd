@echo off
setlocal

cd /d "%~dp0"

where npm >nul 2>nul
if errorlevel 1 (
    echo [ERROR] npm was not found.
    echo Install Node.js, then run this file again.
    pause
    exit /b 1
)

echo Starting Fitly integrated wardrobe dev server...
echo Local URL: http://localhost:3000
echo Keep this window open while using the app.
echo.

npm run dev

exit /b %errorlevel%
