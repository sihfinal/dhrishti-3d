@echo off
title SagarDrishti-3D Production Launcher
echo ===================================================
echo   Starting SagarDrishti-3D Production Platform...
echo ===================================================

echo [1/3] Starting FastAPI Python Backend (:8000)...
start "SagarDrishti - Backend" cmd /k "call .venv\Scripts\activate.bat && uvicorn backend.main:app --host 0.0.0.0 --port 8000"

echo [2/3] Starting Caddy Production Web Server (:8080)...
start "SagarDrishti - WebServer" cmd /k "caddy.exe run"

echo Waiting 5 seconds for services to initialize...
timeout /t 5 /nobreak >nul

echo [3/3] Starting Cloudflare Tunnel...
echo Look for the public 'https://*.trycloudflare.com' link below:
echo ===================================================
cloudflared tunnel --url http://localhost:8080
pause
