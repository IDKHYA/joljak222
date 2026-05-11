@echo off
setlocal

cd /d "%~dp0"

set "LOCAL_URL=http://localhost:3000"
set "LOCAL_CLOUDFLARED=%~dp0tools\cloudflared.exe"

where npm >nul 2>nul
if errorlevel 1 (
    echo [ERROR] npm was not found.
    echo Install Node.js, then run this file again.
    pause
    exit /b 1
)

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

echo Starting Vite dev server...
start "Fitly Vite Server" cmd /k "pushd ""%~dp0"" && npm run dev"

echo Waiting for %LOCAL_URL%...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ok=$false; for($i=0; $i -lt 30; $i++){ try { $r=Invoke-WebRequest -UseBasicParsing '%LOCAL_URL%' -TimeoutSec 2; if($r.StatusCode -eq 200){ $ok=$true; break } } catch {}; Start-Sleep -Seconds 1 }; if(-not $ok){ exit 1 }"
if errorlevel 1 (
    echo [ERROR] Vite server did not start on %LOCAL_URL%.
    pause
    exit /b 1
)

echo.
echo Starting Cloudflare quick tunnel for %LOCAL_URL%...
echo Wait for the "Visit it at" line. That URL is the temporary public address.
echo.

"%CLOUDFLARED%" tunnel --url "%LOCAL_URL%"

exit /b %errorlevel%
