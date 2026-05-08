@echo off
REM Complete Network Access Setup for MC-Larens
REM This fixes both PortProxy and Windows Firewall
REM MUST be run as Administrator

echo.
echo ========================================
echo MC-Larens: Complete Network Setup
echo ========================================
echo.

REM Check if running as admin
>nul 2>&1 "%SYSTEMROOT%\system32\cacls.exe" "%SYSTEMROOT%\system32\config\system"
if %errorlevel% neq 0 (
    echo ERROR: Must run as Administrator!
    echo.
    echo Right-click this file and select "Run as Administrator"
    pause
    exit /b 1
)

echo Step 1: Setting up PortProxy rules...
netsh interface portproxy add v4tov4 listenport=3000 listenaddress=0.0.0.0 connectport=3000 connectaddress=127.0.0.1
netsh interface portproxy add v4tov4 listenport=8001 listenaddress=0.0.0.0 connectport=8001 connectaddress=127.0.0.1

echo.
echo Step 2: Adding Windows Firewall rules...
netsh advfirewall firewall add rule name="MC-Larens-3000" dir=in action=allow protocol=tcp localport=3000 remoteip=any profile=any
netsh advfirewall firewall add rule name="MC-Larens-8001" dir=in action=allow protocol=tcp localport=8001 remoteip=any profile=any

echo.
echo Step 3: Verifying configuration...
echo.
echo PortProxy Rules:
netsh interface portproxy show all
echo.
echo Firewall Rules:
netsh advfirewall firewall show rule name="MC-Larens*" dir=in

echo.
echo ========================================
echo COMPLETE! Now try from another device:
echo.
echo http://192.168.1.12:3000 (Frontend)
echo http://192.168.1.12:8001 (Backend)
echo ========================================
echo.
pause
