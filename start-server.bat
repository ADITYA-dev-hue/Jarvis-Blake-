@echo off
title JARVIS Server (Node.js Relay)
echo ===================================================
echo   Starting JARVIS Phase 1 Relay Server
echo ===================================================

cd /d "%~dp0server"

if not exist "node_modules" (
    echo [INFO] Installing Node.js dependencies...
    npm install
)

echo [INFO] Launching server on port 3000...
node server.js
pause
