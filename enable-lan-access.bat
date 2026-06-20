@echo off
REM This script enables LAN access to Docker via PortProxy
REM MUST be run as Administrator
REM Right-click this file and select "Run as Administrator"

echo.
echo ========================================
echo MC-Larens: Enable LAN Access (PortProxy)
echo ========================================
echo.
echo This will allow other devices on 192.168.1.x to access:
echo   - Frontend: http://192.168.1.12:3000
echo   - Backend: http://192.168.1.12:8001
echo.

REM Check if running as admin
>nul 2>&1 "%SYSTEMROOT%\system32\cacls.exe" "%SYSTEMROOT%\system32\config\system"
if %errorlevel% neq 0 (
    echo ERROR: This script MUST be run as Administrator!
    echo.
    echo Please right-click this file and select "Run as Administrator"
    pause
    exit /b 1
)

echo [1/3] Creating PortProxy rule for port 3000...
netsh interface portproxy add v4tov4 listenport=3000 listenaddress=0.0.0.0 connectport=3000 connectaddress=127.0.0.1
if %errorlevel% equ 0 (
    echo ✓ Port 3000 configured
) else (
    echo ! Warning: Port 3000 might already be configured
)

echo.
echo [2/3] Creating PortProxy rule for port 8001...
netsh interface portproxy add v4tov4 listenport=8001 listenaddress=0.0.0.0 connectport=8001 connectaddress=127.0.0.1
if %errorlevel% equ 0 (
    echo ✓ Port 8001 configured
) else (
    echo ! Warning: Port 8001 might already be configured
)

echo.
echo [3/3] Verifying configuration...
netsh interface portproxy show all

echo.
echo ========================================
echo ✓ DONE! Now try accessing from other devices:
echo.
echo Frontend:  http://192.168.1.12:3000
echo Backend:   http://192.168.1.12:8001
echo.
echo Press any key to close...
pause >nul
