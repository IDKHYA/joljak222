@echo off
setlocal

set "LOCAL_URL=http://localhost:3000"
set "LOCAL_CLOUDFLARED=%~dp0tools\cloudflared.exe"

if exist "%LOCAL_CLOUDFLARED%" (
    set "CLOUDFLARED=%LOCAL_CLOUDFLARED%"
) else (
    where cloudflared >nul 2>nul
    if errorlevel 1 (
        echo [ERROR] cloudflared was not found.
        echo Put cloudflared.exe in the tools folder or install cloudflared globally.
        pause
        exit /b 1
    )
    set "CLOUDFLARED=cloudflared"
)

echo Starting Cloudflare quick tunnel for %LOCAL_URL%...
echo Make sure the Vite dev server is already running with: npm run dev
echo Wait for the "Visit it at" line. That URL is the temporary public address.
echo.

"%CLOUDFLARED%" tunnel --url "%LOCAL_URL%"

exit /b %errorlevel%
