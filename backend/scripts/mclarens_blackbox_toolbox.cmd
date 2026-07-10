@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul 2>&1
mode con: cols=80 >nul 2>&1
title MCLARENS ERP - Server Black Box Toolbox v2.3-ZeroTouch
color 0B

rem ANSI / Virtual Terminal
reg add HKCU\Console /v VirtualTerminalLevel /t REG_DWORD /d 1 /f >nul 2>&1
for /F "delims=" %%a in ('echo prompt $E^| cmd') do set "ESC=%%a"
if not defined ESC set "ESC=."
set "RST=%ESC%[0m"
set "CYAN=%ESC%[36m"
set "GRN=%ESC%[32m"
set "RED=%ESC%[31m"
set "YLW=%ESC%[33m"
set "BLD=%ESC%[1m"
set "DIM=%ESC%[2m"
set "WHT=%ESC%[97m"
set "BLK=%ESC%[40m"

rem Rutas y constantes - REPO_ROOT dinamico desde ubicacion del script
set "SCRIPT_DIR=%~dp0"
set "REPO_ROOT=%SCRIPT_DIR%..\..\"
for %%I in ("%REPO_ROOT%") do set "REPO_ROOT=%%~fI"
if not exist "%REPO_ROOT%\docker-compose.yml" set "REPO_ROOT=C:\MC-LARENS_ERP_3\MC-LARENS_ERP2"
for %%I in ("%REPO_ROOT%") do set "REPO_ROOT=%%~fI"
set "IP_FIJA=192.168.1.26"
set "SERVER_LAN_IP=192.168.1.26"
set "GATEWAY=192.168.1.1"
set "NET_PREFIX=192.168.1"
set "NODE_ID=branch_main"
set "TARGET_COMMIT=1a27364"
set "SPIN_IDX=0"
set "LOG_DIR=%ProgramData%\MCLarensERP\logs"
set "SCAN_TMP=%TEMP%\mclarens_ip_scan.txt"
set "FREE_TMP=%TEMP%\mclarens_free_ips.txt"
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%" >nul 2>&1

rem Verificar Administrador
net session >nul 2>&1
if errorlevel 1 (
    echo %RED%[ERROR]%RST% Este toolbox requiere ejecucion como Administrador.
    echo         Clic derecho ^> "Ejecutar como administrador"
    pause
    exit /b 1
)

set "CLEAN_INSTALL=0"
if not exist "%REPO_ROOT%\docker-compose.yml" set "CLEAN_INSTALL=1"

set "MCLARENS_ERP_ROOT=%REPO_ROOT%"
setx MCLARENS_ERP_ROOT "%REPO_ROOT%" >nul 2>&1

goto MAIN_MENU

rem =============================================================================
rem  SUBRUTINAS
rem =============================================================================

:BEEP_ERROR
powershell -NoProfile -Command "[console]::Beep(400,600); [console]::Beep(300,600)" >nul 2>&1
goto :eof

:BEEP_OK
powershell -NoProfile -Command "[console]::Beep(1200,200); [console]::Beep(1600,200)" >nul 2>&1
goto :eof

:LOG
echo [%date% %time%] %~1>>"%LOG_DIR%\toolbox.log"
goto :eof

:PARSE_NODE_ID
set "NODE_ID=branch_main"
set "IP_FIJA=192.168.1.26"
set "SERVER_LAN_IP=192.168.1.26"
if not exist "%REPO_ROOT%\.env" goto :eof
for /f "usebackq tokens=1,* delims==" %%a in (`findstr /b /i "NODE_ID BRANCH_ID SERVER_LAN_IP" "%REPO_ROOT%\.env" 2^>nul`) do (
    set "KEY=%%a"
    set "VAL=%%b"
    set "VAL=!VAL:"=!"
    if /i "!KEY!"=="NODE_ID" if not "!VAL!"=="" set "NODE_ID=!VAL!"
    if /i "!KEY!"=="BRANCH_ID" if not "!VAL!"=="" set "NODE_ID=!VAL!"
    if /i "!KEY!"=="SERVER_LAN_IP" (
        if not "!VAL!"=="" (
            set "IP_FIJA=!VAL!"
            set "SERVER_LAN_IP=!VAL!"
        )
    )
)
if not defined IP_FIJA set "IP_FIJA=192.168.1.26"
if not defined SERVER_LAN_IP set "SERVER_LAN_IP=192.168.1.26"
goto :eof

:UPDATE_ENV_LAN_IP
set "NEW_IP=%~1"
if "%NEW_IP%"=="" goto :eof
if not exist "%REPO_ROOT%\.env" (
    echo SERVER_LAN_IP=%NEW_IP%>>"%REPO_ROOT%\.env"
    goto :eof
)
powershell -NoProfile -Command ^
  "$p='%REPO_ROOT%\.env'; $ip='%NEW_IP%';" ^
  "$lines=Get-Content $p -ErrorAction SilentlyContinue;" ^
  "$out=@(); $found=$false;" ^
  "foreach($line in $lines){" ^
  "  if($line -match '^SERVER_LAN_IP='){ $out += 'SERVER_LAN_IP='+$ip; $found=$true }" ^
  "  elseif($line -match '^HTTPS_CERT_IPS='){ $out += 'HTTPS_CERT_IPS=127.0.0.1,'+$ip }" ^
  "  else { $out += $line }" ^
  "}; if(-not $found){ $out += 'SERVER_LAN_IP='+$ip };" ^
  "Set-Content -Path $p -Value $out -Encoding UTF8" >nul 2>&1
set "IP_FIJA=%NEW_IP%"
set "SERVER_LAN_IP=%NEW_IP%"
goto :eof

:CHECK_INTERNET
set "INTERNET=DISCONNECTED"
ping -n 1 -w 1200 1.1.1.1 >nul 2>&1
if not errorlevel 1 set "INTERNET=CONNECTED"
goto :eof

:SPINNER_TICK
set /a SPIN_IDX+=1
set /a MOD=!SPIN_IDX! %% 4
if !MOD!==0 set "SPIN_CHAR=/"
if !MOD!==1 set "SPIN_CHAR=-"
if !MOD!==2 set "SPIN_CHAR=\"
if !MOD!==3 set "SPIN_CHAR=|"
goto :eof

:LOADING_BAR
set "LB_LABEL=%~1"
set "LB_STEPS=%~2"
if "%LB_STEPS%"=="" set "LB_STEPS=10"
set /a LB_PCT=0
set /a LB_STEP_SIZE=100/LB_STEPS
:LOADING_BAR_LOOP
call :SPINNER_TICK
set /a LB_FILLED=!LB_PCT!*30/100
set "LB_BAR="
for /l %%i in (1,1,30) do (
    if %%i leq !LB_FILLED! (
        set "LB_BAR=!LB_BAR!█"
    ) else (
        set "LB_BAR=!LB_BAR!░"
    )
)
<nul set /p "=!CYAN![!SPIN_CHAR!] !LB_LABEL! !GRN[![LB_BAR!] !LB_PCT!%%!RST!   "
echo.
set /a LB_PCT+=LB_STEP_SIZE
if !LB_PCT! leq 100 (
    ping -n 2 127.0.0.1 >nul
    goto LOADING_BAR_LOOP
)
goto :eof

:WAIT_KEY
echo.
echo %DIM%Presione una tecla para volver al menu...%RST%
pause >nul
goto MAIN_MENU

:RUN_WITH_PROGRESS
set "RW_LABEL=%~1"
set "RW_CMD=%~2"
call :LOADING_BAR "!RW_LABEL!" 8
call :LOG "RUN: !RW_CMD!"
cmd /c "!RW_CMD!" >>"%LOG_DIR%\toolbox.log" 2>&1
if errorlevel 1 (
    echo %RED%[FALLO]%RST% !RW_LABEL!
    call :BEEP_ERROR
) else (
    echo %GRN%[OK]%RST% !RW_LABEL!
    call :BEEP_OK
)
goto :eof

:DETECT_NETWORK_PREFIX
set "NET_PREFIX=192.168.1"
set "GATEWAY=192.168.1.1"
set "DETECT_RAW="
for /f "usebackq delims=" %%p in (`powershell -NoProfile -Command "try { $addr=Get-NetIPAddress -AddressFamily IPv4 ^| Where-Object { $_.IPAddress -match '^(192\\.168\\.|10\\.)' -and $_.PrefixOrigin -ne 'WellKnown' } ^| Select-Object -First 1; if($addr){ $ip=$addr.IPAddress; $prefix=$ip -replace '\\.\\d+$',''; $gw=(Get-NetRoute -DestinationPrefix '0.0.0.0/0' ^| Where-Object { $_.NextHop -match '^(192\\.168\\.|10\\.)' } ^| Select-Object -First 1).NextHop; if(-not $gw){ $gw=$prefix+'.1' }; Write-Output ($prefix+'|'+$gw) } else { Write-Output '192.168.1|192.168.1.1' } } catch { Write-Output '192.168.1|192.168.1.1' }" 2^>nul`) do (
    set "DETECT_RAW=%%p"
)
if defined DETECT_RAW (
    for /f "tokens=1,2 delims=|" %%a in ("%DETECT_RAW%") do (
        if not "%%a"=="" set "NET_PREFIX=%%a"
        if not "%%b"=="" set "GATEWAY=%%b"
    )
)
if not defined NET_PREFIX set "NET_PREFIX=192.168.1"
if not defined GATEWAY set "GATEWAY=192.168.1.1"
goto :eof

:SCAN_NETWORK_IPS
del "%SCAN_TMP%" "%FREE_TMP%" >nul 2>&1
set "FREE_COUNT=0"
set "SUGGEST_IP="
set "SUGGEST_SCORE=9999"
echo %CYAN%Escaneando segmento !NET_PREFIX!.X ...%RST%
for /l %%h in (2,1,60) do (
    set "TARGET_IP=!NET_PREFIX!.%%h"
    set "PING_MS=timeout"
    ping -n 1 -w 100 !TARGET_IP! >"%TEMP%\mclarens_ping.txt" 2>&1
    if errorlevel 1 (
        echo LIBRE^|!TARGET_IP!^|0>>"%FREE_TMP%"
        set /a FREE_COUNT+=1
        set /a SCORE=%%h
        if %%h==26 set /a SCORE=0
        if %%h geq 20 if %%h leq 35 set /a SCORE-=5
        if !SCORE! lss !SUGGEST_SCORE! (
            set "SUGGEST_SCORE=!SCORE!"
            set "SUGGEST_IP=!TARGET_IP!"
        )
    ) else (
        set "PING_MS=?"
        for /f "tokens=*" %%t in ('findstr /i /c:"tiempo" /c:"time" "%TEMP%\mclarens_ping.txt" 2^>nul') do (
            set "PLINE=%%t"
        )
        if defined PLINE (
            for /f "tokens=2 delims=<=>" %%m in ("!PLINE!") do set "PING_MS=%%m"
            set "PING_MS=!PING_MS:ms=!"
            set "PING_MS=!PING_MS: =!"
        )
        echo OCUPADA^|!TARGET_IP!^|!PING_MS!>>"%SCAN_TMP%"
    )
)
if not defined SUGGEST_IP (
    set "SUGGEST_IP=!NET_PREFIX!.26"
)
goto :eof

:APPLY_STATIC_IP
set "CHOSEN_IP=%~1"
if "%CHOSEN_IP%"=="" goto :eof
set "ADAPTER=Ethernet"
for /f "tokens=1,* delims=:" %%a in (`powershell -NoProfile -Command "try { (Get-NetAdapter ^| Where-Object Status -eq 'Up' ^| Select-Object -First 1).Name } catch { 'Ethernet' }" 2^>nul`) do set "ADAPTER=%%b"
set "ADAPTER=!ADAPTER: =!"
if "!ADAPTER!"=="" set "ADAPTER=Ethernet"
call :LOADING_BAR "Aplicando IP estatica !CHOSEN_IP!" 6
netsh interface ipv4 set address name="!ADAPTER!" source=static address=!CHOSEN_IP! mask=255.255.255.0 gateway=!GATEWAY! >nul 2>&1
netsh interface ipv4 set dnsservers name="!ADAPTER!" source=static address=1.1.1.1 register=primary >nul 2>&1
netsh interface ipv4 add dnsservers name="!ADAPTER!" 8.8.8.8 index=2 >nul 2>&1
if errorlevel 1 (
    echo %RED%[FALLO]%RST% No se pudo fijar IP estatica en !ADAPTER!
    call :BEEP_ERROR
    goto :eof
)
set "IP_FIJA=!CHOSEN_IP!"
call :UPDATE_ENV_LAN_IP "!CHOSEN_IP!"
echo %GRN%[OK]%RST% IP estatica !CHOSEN_IP! aplicada. .env actualizado.
call :LOG "IP estatica: !CHOSEN_IP! adaptador !ADAPTER!"
call :BEEP_OK
goto :eof

:ENSURE_QRCODE_MODULE
where python >nul 2>&1
if errorlevel 1 goto :eof
python -c "import qrcode" >nul 2>&1
if not errorlevel 1 goto :eof
pip install qrcode==8.2 >nul 2>&1
goto :eof

:RENDER_QR_ASCII
set "QR_URL=%~1"
if "%QR_URL%"=="" set "QR_URL=http://!IP_FIJA!:3000"
echo.
echo %BLD%%WHT%════════ CODIGO QR ASCII - ESCANEAR DESDE CELULAR ════════%RST%
echo %DIM%URL: %QR_URL%%RST%
echo.
set "QR_SCRIPT=%REPO_ROOT%\backend\scripts\render_qr_ascii.py"
if exist "!QR_SCRIPT!" (
    where python >nul 2>&1
    if not errorlevel 1 (
        call :ENSURE_QRCODE_MODULE
        python "!QR_SCRIPT!" "!QR_URL!"
        if not errorlevel 1 goto :eof
    )
    if exist "%REPO_ROOT%\docker-compose.yml" (
        pushd "%REPO_ROOT%"
        docker compose ps --format "{{.Names}}" 2>nul | findstr /i "mundo-backend" >nul 2>&1
        if not errorlevel 1 (
            docker compose exec -T backend python /app/backend/scripts/render_qr_ascii.py "!QR_URL!"
            set "QR_DOCKER_ERR=!errorlevel!"
            popd
            if !QR_DOCKER_ERR! equ 0 goto :eof
        ) else (
            popd
        )
    )
)
echo %YLW%[WARN]%RST% Generador QR no disponible. Instale Python+qrcode o levante el stack Docker.
echo %BLD%http://!IP_FIJA!:3000%RST%
goto :eof

:BUILD_PROGRESS_BAR
set "BP_PCT=%~1"
set "BP_WIDTH=%~2"
if "%BP_WIDTH%"=="" set "BP_WIDTH=20"
set /a BP_FILLED=!BP_PCT!*!BP_WIDTH!/100
set "BP_OUT="
for /l %%b in (1,1,!BP_WIDTH!) do (
    if %%b leq !BP_FILLED! (
        set "BP_OUT=!BP_OUT!█"
    ) else (
        set "BP_OUT=!BP_OUT!░"
    )
)
set "PROGRESS_BAR=!BP_OUT!"
goto :eof

:WZ_RENDER_DUAL_BARS
if not defined WZ_STEP_LABEL set "WZ_STEP_LABEL=Preparando..."
if not defined WZ_STEP_PCT set "WZ_STEP_PCT=0"
if not defined WZ_GLOBAL_PCT set "WZ_GLOBAL_PCT=0"
call :BUILD_PROGRESS_BAR !WZ_STEP_PCT! 20
set "WZ_STEP_BAR=!PROGRESS_BAR!"
call :BUILD_PROGRESS_BAR !WZ_GLOBAL_PCT! 30
set "WZ_GLOBAL_BAR=!PROGRESS_BAR!"
call :SPINNER_TICK
echo %ESC%[8;1H%ESC%[K
echo %BLD%PASO ACTUAL:%RST% %ESC%[K
echo %CYAN%[!SPIN_CHAR!]%RST% !WZ_STEP_LABEL!: %GRN%[![WZ_STEP_BAR!] !WZ_STEP_PCT!%%!RST% %ESC%[K
echo. %ESC%[K
echo %BLD%ACANCE GENERAL DEL APPLIANCE:%RST% %ESC%[K
echo %GRN%[![WZ_GLOBAL_BAR!] !WZ_GLOBAL_PCT!%%!RST% %ESC%[K
goto :eof

:WZ_SET_GLOBAL
set /a WZ_GLOBAL_PCT=%~1
call :WZ_RENDER_DUAL_BARS
goto :eof

:WZ_STEP_BEGIN
set "WZ_STEP_LABEL=%~1"
set "WZ_STEP_PCT=0"
call :WZ_RENDER_DUAL_BARS
goto :eof

:WZ_STEP_TICK
set /a WZ_STEP_PCT=%~1
if !WZ_STEP_PCT! gtr 100 set "WZ_STEP_PCT=100"
call :WZ_RENDER_DUAL_BARS
goto :eof

:WZ_ANIMATE_STEP
set "WZ_ANIM_LABEL=%~1"
set "WZ_ANIM_TICKS=%~2"
if "%WZ_ANIM_TICKS%"=="" set "WZ_ANIM_TICKS=10"
set "WZ_STEP_LABEL=!WZ_ANIM_LABEL!"
set /a WZ_ANIM_SIZE=100/!WZ_ANIM_TICKS!
set /a WZ_STEP_PCT=0
:WZ_ANIMATE_STEP_LOOP
call :WZ_STEP_TICK !WZ_STEP_PCT!
ping -n 2 127.0.0.1 >nul
set /a WZ_STEP_PCT+=WZ_ANIM_SIZE
if !WZ_STEP_PCT! leq 100 goto WZ_ANIMATE_STEP_LOOP
set "WZ_STEP_PCT=100"
call :WZ_STEP_TICK 100
goto :eof

:AUDIT_HARDWARE
set "HW_RAM_OK=1"
set "HW_DISK_OK=1"
set "HW_RAM_MB=0"
set "HW_DISK_FREE_GB=0"
for /f "skip=1 tokens=1" %%r in ('wmic computersystem get TotalPhysicalMemory 2^>nul') do (
    if not "%%r"=="" set /a HW_RAM_MB=%%r/1048576
)
if !HW_RAM_MB! lss 4096 set "HW_RAM_OK=0"
for /f "skip=1 tokens=1,2" %%a in ('wmic logicaldisk where "DeviceID='C:'" get FreeSpace^,Size 2^>nul') do (
    if not "%%a"=="" if not "%%b"=="" (
        set /a HW_DISK_FREE_GB=%%a/1073741824
        set /a HW_DISK_SIZE_GB=%%b/1073741824
    )
)
if !HW_DISK_FREE_GB! lss 20 set "HW_DISK_OK=0"
if "!HW_RAM_OK!"=="0" echo %RED%[HW]%RST% RAM insuficiente: !HW_RAM_MB! MB ^(minimo 4096 MB^)
if "!HW_DISK_OK!"=="0" echo %RED%[HW]%RST% Disco C: libre !HW_DISK_FREE_GB! GB ^(minimo 20 GB^)
if "!HW_RAM_OK!"=="1" if "!HW_DISK_OK!"=="1" echo %GRN%[HW]%RST% RAM !HW_RAM_MB! MB ^| Disco libre !HW_DISK_FREE_GB! GB
call :LOG "HW audit RAM=!HW_RAM_MB!MB DISK_FREE=!HW_DISK_FREE_GB!GB"
goto :eof

:AUTO_APPLY_SUGGESTED_IP
call :DETECT_NETWORK_PREFIX
call :SCAN_NETWORK_IPS
if not defined SUGGEST_IP set "SUGGEST_IP=!NET_PREFIX!.26"
call :WZ_STEP_BEGIN "Asignando IP estatica !SUGGEST_IP!"
call :WZ_ANIMATE_STEP "Escaneo y fijacion IP" 8
call :APPLY_STATIC_IP "!SUGGEST_IP!"
goto :eof

:AUTO_INSTALL_GIT
call :WZ_STEP_BEGIN "Instalando Git"
where git >nul 2>&1
if not errorlevel 1 (
    call :WZ_STEP_TICK 100
    goto :eof
)
where winget >nul 2>&1
if errorlevel 1 (
    echo %RED%[FALLO]%RST% winget no disponible para instalar Git.
    goto :eof
)
call :WZ_ANIMATE_STEP "Descargando Git" 6
winget install --id Git.Git -e --accept-package-agreements --accept-source-agreements --silent >>"%LOG_DIR%\toolbox.log" 2>&1
call :WZ_STEP_TICK 100
goto :eof

:AUTO_INSTALL_DOCKER
call :WZ_STEP_BEGIN "Instalando Docker Desktop"
where docker >nul 2>&1
if not errorlevel 1 (
    docker info >nul 2>&1
    if not errorlevel 1 (
        call :WZ_STEP_TICK 100
        goto :eof
    )
)
where winget >nul 2>&1
if errorlevel 1 (
    echo %RED%[FALLO]%RST% winget no disponible para instalar Docker.
    goto :eof
)
call :WZ_ANIMATE_STEP "Descargando Docker Desktop" 10
winget install --id Docker.DockerDesktop -e --accept-package-agreements --accept-source-agreements --silent >>"%LOG_DIR%\toolbox.log" 2>&1
echo %YLW%[INFO]%RST% Espere a que Docker Desktop inicie el engine...
set /a DOCKER_WAIT=0
:AUTO_DOCKER_WAIT_LOOP
call :WZ_STEP_TICK !DOCKER_WAIT!
docker info >nul 2>&1
if not errorlevel 1 (
    call :WZ_STEP_TICK 100
    goto :eof
)
set /a DOCKER_WAIT+=5
if !DOCKER_WAIT! geq 100 goto :eof
ping -n 6 127.0.0.1 >nul
goto AUTO_DOCKER_WAIT_LOOP

:RESOLVE_GITHUB_PAT
set "GITHUB_PAT="
if not "%MCLARENS_GITHUB_PAT%"=="" set "GITHUB_PAT=%MCLARENS_GITHUB_PAT%"
if "!GITHUB_PAT!"=="" if not "%GITHUB_PAT%"=="" set "GITHUB_PAT=%GITHUB_PAT%"
if not "!GITHUB_PAT!"=="" goto :eof
if exist "%SCRIPT_DIR%.mclarens_pat" (
    set /p GITHUB_PAT=<"%SCRIPT_DIR%.mclarens_pat"
    goto :eof
)
for %%d in (D E F G H I J K L M N O P Q R S T U V W X Y Z) do (
    if exist "%%d:\.mclarens_pat" (
        set /p GITHUB_PAT=<"%%d:\.mclarens_pat"
        goto :eof
    )
)
set /p "GITHUB_PAT=PAT GitHub ^(licencia^): "
goto :eof

:AUTO_CLONE_REPOSITORY
call :WZ_STEP_BEGIN "Clonando repositorio privado"
call :RESOLVE_GITHUB_PAT
if "!GITHUB_PAT!"=="" (
    echo %RED%[FALLO]%RST% PAT GitHub requerido para clonacion.
    goto :eof
)
set "CLONE_URL=https://!GITHUB_PAT!@github.com/Samuraimaid/MC-LARENS_ERP2.git"
if not exist "%REPO_ROOT%\.git" (
    if not exist "%REPO_ROOT%" mkdir "%REPO_ROOT%"
    call :WZ_ANIMATE_STEP "git clone" 8
    git clone "!CLONE_URL!" "%REPO_ROOT%" >>"%LOG_DIR%\toolbox.log" 2>&1
) else (
    call :WZ_ANIMATE_STEP "git pull" 6
    pushd "%REPO_ROOT%"
    git pull >>"%LOG_DIR%\toolbox.log" 2>&1
    popd
)
set "GITHUB_PAT="
set "CLONE_URL="
if errorlevel 1 goto :eof
pushd "%REPO_ROOT%"
git checkout !TARGET_COMMIT! >>"%LOG_DIR%\toolbox.log" 2>&1
popd
call :WZ_STEP_TICK 100
if exist "%REPO_ROOT%\docker-compose.yml" (
    set "CLEAN_INSTALL=0"
    setx MCLARENS_ERP_ROOT "%REPO_ROOT%" >nul 2>&1
)
goto :eof

:WRITE_ENV_AUTO_PROFILE
if "%AUTO_NODE_PROFILE%"=="1" (
    set "AUTO_NODE_ID=branch_main"
    set "AUTO_NODE_TYPE=SUCURSAL"
    set "AUTO_ENABLE_SALES=true"
    set "AUTO_ENABLE_WORKSHOP=true"
    set "AUTO_ENABLE_HR=true"
)
if "%AUTO_NODE_PROFILE%"=="2" (
    set "AUTO_NODE_ID=branch_alt"
    set "AUTO_NODE_TYPE=SUCURSAL"
    set "AUTO_ENABLE_SALES=true"
    set "AUTO_ENABLE_WORKSHOP=true"
    set "AUTO_ENABLE_HR=true"
)
if "%AUTO_NODE_PROFILE%"=="3" (
    set "AUTO_NODE_ID=warehouse_satellite"
    set "AUTO_NODE_TYPE=BODEGA_PURA"
    set "AUTO_ENABLE_SALES=false"
    set "AUTO_ENABLE_WORKSHOP=false"
    set "AUTO_ENABLE_HR=false"
)
if not defined AUTO_NODE_NAME set "AUTO_NODE_NAME=Nodo ERP"
if "%AUTO_NODE_PROFILE%"=="2" (
    set "AUTO_NODE_ID=branch_alt"
)
(
echo # Generado por MODO_AUTOMATICO_DESATENDIDO
echo BRANCH_ID=!AUTO_NODE_ID!
echo NODE_ID=!AUTO_NODE_ID!
echo NODE_NAME=!AUTO_NODE_NAME!
echo NODE_TYPE=!AUTO_NODE_TYPE!
echo NODE_ENABLE_SALES=!AUTO_ENABLE_SALES!
echo NODE_ENABLE_WORKSHOP=!AUTO_ENABLE_WORKSHOP!
echo NODE_ENABLE_HR=!AUTO_ENABLE_HR!
echo SERVER_LAN_IP=!IP_FIJA!
echo SERVER_FRONTEND_PORT=3000
echo MONGODB_LOCAL_URI=mongodb://mongodb:27017
echo DB_NAME=mc-larens2_mundo_accesorios_erp
echo MONGODB_CENTRAL_URI=
echo PUBLIC_TUNNEL_URL_MAIN=https://mclarenerp.com
echo PUBLIC_TUNNEL_URL_NORTH=https://north.mclarenerp.com
echo PUBLIC_TUNNEL_URL_SOUTH=https://south.mclarenerp.com
echo HTTPS_CERT_IPS=127.0.0.1,!IP_FIJA!
)>"%REPO_ROOT%\.env"
set "NODE_ID=!AUTO_NODE_ID!"
call :LOG ".env auto perfil !AUTO_NODE_PROFILE! nodo !AUTO_NODE_NAME!"
goto :eof

:SCAN_USB_BACKUP_FILES
set "USB_BACKUP_FOUND="
set "USB_BACKUP_PATH="
for /f "usebackq delims=" %%d in (`powershell -NoProfile -Command "Get-CimInstance Win32_LogicalDisk ^| Where-Object { $_.DriveType -eq 2 } ^| ForEach-Object { $_.DeviceID }" 2^>nul`) do (
    if exist "%%d\erp_delta_backup_*.tar.gz" (
        for /f "delims=" %%f in ('dir /b /o-d "%%d\erp_delta_backup_*.tar.gz" 2^>nul') do (
            set "USB_BACKUP_FOUND=1"
            set "USB_BACKUP_PATH=%%d\%%f"
            goto :eof
        )
    )
    if exist "%%d\mongodb_*.archive.gz" (
        for /f "delims=" %%f in ('dir /b /o-d "%%d\mongodb_*.archive.gz" 2^>nul') do (
            set "USB_BACKUP_FOUND=1"
            set "USB_BACKUP_PATH=%%d\%%f"
            goto :eof
        )
    )
    if exist "%%d\*.archive" (
        for /f "delims=" %%f in ('dir /b /o-d "%%d\*.archive" 2^>nul') do (
            set "USB_BACKUP_FOUND=1"
            set "USB_BACKUP_PATH=%%d\%%f"
            goto :eof
        )
    )
)
goto :eof

:INJECT_USB_BACKUP
call :SCAN_USB_BACKUP_FILES
if not defined USB_BACKUP_FOUND goto :eof
if not exist "%REPO_ROOT%\backups\usb" mkdir "%REPO_ROOT%\backups\usb" >nul 2>&1
for %%f in ("!USB_BACKUP_PATH!") do set "USB_BACKUP_NAME=%%~nxf"
copy /y "!USB_BACKUP_PATH!" "%REPO_ROOT%\backups\usb\!USB_BACKUP_NAME!" >>"%LOG_DIR%\toolbox.log" 2>&1
set "INJECTED_BACKUP=%REPO_ROOT%\backups\usb\!USB_BACKUP_NAME!"
echo %GRN%[OK]%RST% Respaldo USB inyectado: !USB_BACKUP_NAME!
call :LOG "USB backup injected !INJECTED_BACKUP!"
goto :eof

:RESTORE_DELTA_FROM_USB
if not defined INJECTED_BACKUP goto :eof
if not exist "%REPO_ROOT%\docker-compose.yml" goto :eof
call :WZ_STEP_BEGIN "Restaurando Delta desde USB"
pushd "%REPO_ROOT%"
docker compose ps --format "{{.Names}}" 2>nul | findstr /i "mundo-backend" >nul 2>&1
if errorlevel 1 (
    popd
    goto :eof
)
echo !INJECTED_BACKUP!| findstr /i "\.tar\.gz" >nul 2>&1
if not errorlevel 1 (
    docker compose exec -T backend bash /app/backend/scripts/restore_delta_backup.sh "/mnt/usb_backup/!USB_BACKUP_NAME!" >>"%LOG_DIR%\toolbox.log" 2>&1
) else (
    docker compose exec -T backend bash -c "mongorestore --uri=mongodb://mongodb:27017 --gzip --drop --archive=/mnt/usb_backup/!USB_BACKUP_NAME!" >>"%LOG_DIR%\toolbox.log" 2>&1
)
popd
call :WZ_STEP_TICK 100
goto :eof

:TRIGGER_ATLAS_DELTA_SYNC
if not exist "%REPO_ROOT%\docker-compose.yml" goto :eof
call :WZ_STEP_BEGIN "Sincronizacion Delta Atlas"
pushd "%REPO_ROOT%"
docker compose exec -T backend python /app/backend/scripts/trigger_central_delta_sync.py >>"%LOG_DIR%\toolbox.log" 2>&1
popd
call :WZ_STEP_TICK 100
goto :eof

:MODO_AUTOMATICO_DESATENDIDO
cls
color 0E
echo %YLW%╔══════════════════════════════════════════════════════════════════════╗%RST%
echo %YLW%║%RST%  %BLD%MODO INSTALACION DESATENDIDA ZERO-TOUCH — BLACK BOX APPLIANCE%RST%   %YLW%║%RST%
echo %YLW%╚══════════════════════════════════════════════════════════════════════╝%RST%
echo.
echo %BLD%Perfil del nodo:%RST%
echo   %GRN%[1]%RST% Casa Matriz ^(SUCURSAL^)
echo   %GRN%[2]%RST% Sucursal Alterna ^(SUCURSAL^)
echo   %GRN%[3]%RST% Bodega Satelite Pura
set "AUTO_NODE_PROFILE="
set /p "AUTO_NODE_PROFILE=Seleccione [1-3]: "
if "%AUTO_NODE_PROFILE%"=="" goto MODO_AUTOMATICO_DESATENDIDO
if not "%AUTO_NODE_PROFILE%"=="1" if not "%AUTO_NODE_PROFILE%"=="2" if not "%AUTO_NODE_PROFILE%"=="3" goto MODO_AUTOMATICO_DESATENDIDO
set "AUTO_NODE_NAME="
set /p "AUTO_NODE_NAME=Nombre descriptivo del nodo en red CEO: "
if "!AUTO_NODE_NAME!"=="" set "AUTO_NODE_NAME=Nodo ERP"
echo.
echo %ESC%[6;1H
set "WZ_GLOBAL_PCT=0"
set "WZ_STEP_PCT=0"
set "WZ_STEP_LABEL=Inicializando wizard..."
call :WZ_RENDER_DUAL_BARS
call :WZ_SET_GLOBAL 5
call :WZ_STEP_BEGIN "Auditoria de hardware"
call :AUDIT_HARDWARE
call :WZ_STEP_TICK 100
call :WZ_SET_GLOBAL 15
call :AUTO_APPLY_SUGGESTED_IP
call :WZ_SET_GLOBAL 25
call :AUTO_INSTALL_GIT
call :WZ_SET_GLOBAL 40
call :AUTO_INSTALL_DOCKER
call :WZ_SET_GLOBAL 55
call :AUTO_CLONE_REPOSITORY
if not exist "%REPO_ROOT%\docker-compose.yml" (
    echo %RED%[FALLO]%RST% Clonacion incompleta; docker-compose.yml ausente.
    color 0B
    call :BEEP_ERROR
    call :WAIT_KEY
    goto MAIN_MENU
)
call :WZ_SET_GLOBAL 65
call :WZ_STEP_BEGIN "Generando .env del nodo"
call :WRITE_ENV_AUTO_PROFILE
call :WZ_STEP_TICK 100
call :WZ_SET_GLOBAL 80
call :WZ_STEP_BEGIN "Desplegando stack Docker"
pushd "%REPO_ROOT%"
docker compose up -d --build >>"%LOG_DIR%\toolbox.log" 2>&1
set "WZ_DEPLOY_ERR=!errorlevel!"
popd
call :WZ_STEP_TICK 100
if !WZ_DEPLOY_ERR! neq 0 (
    echo %RED%[FALLO]%RST% docker compose up fallo en modo desatendido.
    color 0B
    call :BEEP_ERROR
    call :WAIT_KEY
    goto MAIN_MENU
)
call :WZ_SET_GLOBAL 90
call :INJECT_USB_BACKUP
call :RESTORE_DELTA_FROM_USB
call :WZ_SET_GLOBAL 95
call :TRIGGER_ATLAS_DELTA_SYNC
call :OPT_DAWN_TASKS_SILENT
call :WZ_SET_GLOBAL 100
echo.
echo %GRN%[OK]%RST% Instalacion desatendida completada — nodo !AUTO_NODE_NAME! en !IP_FIJA!
call :RENDER_QR_ASCII "http://!IP_FIJA!:3000"
color 0B
call :BEEP_OK
call :WAIT_KEY
goto MAIN_MENU

rem =============================================================================
rem  MENU PRINCIPAL
rem =============================================================================

:MAIN_MENU
cls
if exist "%REPO_ROOT%\docker-compose.yml" (set "CLEAN_INSTALL=0") else (set "CLEAN_INSTALL=1")
call :PARSE_NODE_ID
call :CHECK_INTERNET

if /i "!INTERNET!"=="CONNECTED" (
    set "NET_COLOR=%GRN%"
    set "NET_TEXT=CONNECTED"
) else (
    set "NET_COLOR=%RED%"
    set "NET_TEXT=DISCONNECTED"
)

echo %CYAN%╔══════════════════════════════════════════════════════════════════════════════════════╗%RST%
echo %CYAN%║%RST% %BLD%USER:%RST% %-18s %BLD%HOST:%RST% %-18s %BLD%NODE:%RST% %-16s %CYAN%║%RST%
echo %CYAN%║%RST% %USERNAME%          %COMPUTERNAME%          !NODE_ID!          %CYAN%║%RST%
echo %CYAN%║%RST% %BLD%IP_FIJA:%RST% !SERVER_LAN_IP!          %BLD%INTERNET:%RST% !NET_COLOR!!NET_TEXT!!RST%                              %CYAN%║%RST%
echo %CYAN%║%RST% %BLD%REPO:%RST% %DIM%!REPO_ROOT!%RST%
if "!CLEAN_INSTALL!"=="1" echo %CYAN%║%RST% %YLW%[ESTADO: INSTALACION LIMPIA DESDE CERO]%RST%                              %CYAN%║%RST%
echo %CYAN%╠══════════════════════════════════════════════════════════════════════════════════════╣%RST%
echo %CYAN%║%RST%            %BLD%%CYAN%MCLARENS ERP - SERVER BLACK BOX CORE ^(v2.3-ZeroTouch^)%RST%               %CYAN%║%RST%
echo %CYAN%╠═══════════════════════════════╦═══════════════════════════════╦══════════════════════╣%RST%
echo %CYAN%║%RST% %RED%[0]%RST% %YLW%INSTALACION ZERO-TOUCH%RST% ^(auto^)      %CYAN%║%RST% %YLW%[ASISTENTE MULTI-NODO]%RST%          %CYAN%║%RST% %YLW%[MANTENIMIENTO ^& DAEMONS]%RST%     %CYAN%║%RST%
echo %CYAN%╠═══════════════════════════════╬═══════════════════════════════╬══════════════════════╣%RST%
echo %CYAN%║%RST%  %GRN%[1]%RST% Instalar/Verificar Git       %CYAN%║%RST%  %GRN%[5]%RST% Clonar/Actualizar Repo ^(PAT^) %CYAN%║%RST%  %GRN%[9]%RST% Respaldo Manual USB       %CYAN%║%RST%
echo %CYAN%║%RST%  %GRN%[2]%RST% Instalar/Verificar Docker    %CYAN%║%RST%  %GRN%[6]%RST% Nodo CASA MATRIZ ^(Sucursal^)  %CYAN%║%RST%  %GRN%[10]%RST% Daemon Beep Hardware      %CYAN%║%RST%
echo %CYAN%║%RST%  %GRN%[3]%RST% Escaner IP Inteligente       %CYAN%║%RST%  %GRN%[7]%RST% Nodo BODEGA PURA             %CYAN%║%RST%  %GRN%[11]%RST% Suite Caos Logistica QA   %CYAN%║%RST%
echo %CYAN%║%RST%  %GRN%[4]%RST% Tareas Madrugada 03:00 AM    %CYAN%║%RST%  %GRN%[8]%RST% Kiosk ^+ QR ASCII Consola       %CYAN%║%RST%  %RED%[99]%RST% Apagar/Reiniciar Stack    %CYAN%║%RST%
echo %CYAN%╚═══════════════════════════════╩═══════════════════════════════╩══════════════════════╝%RST%
echo.
set "MENU_CHOICE="
set /p "MENU_CHOICE=%BLD%Seleccione una opcion:%RST% "
if "%MENU_CHOICE%"=="" goto MAIN_MENU
if "%MENU_CHOICE%"=="0" goto MODO_AUTOMATICO_DESATENDIDO
if "%MENU_CHOICE%"=="1" goto OPT_GIT
if "%MENU_CHOICE%"=="2" goto OPT_DOCKER
if "%MENU_CHOICE%"=="3" goto OPT_STATIC_IP
if "%MENU_CHOICE%"=="4" goto OPT_DAWN_TASKS
if "%MENU_CHOICE%"=="5" goto CLONE_REPOSITORY
if "%MENU_CHOICE%"=="6" goto OPT_NODE_MAIN
if "%MENU_CHOICE%"=="7" goto OPT_NODE_WAREHOUSE
if "%MENU_CHOICE%"=="8" goto OPT_KIOSK
if "%MENU_CHOICE%"=="9" goto OPT_BACKUP_USB
if "%MENU_CHOICE%"=="10" goto OPT_BEEP_DAEMON
if "%MENU_CHOICE%"=="11" goto OPT_CHAOS_SUITE
if "%MENU_CHOICE%"=="99" goto OPT_STACK_CONTROL
echo %RED%Opcion invalida.%RST%
ping -n 2 127.0.0.1 >nul
goto MAIN_MENU

rem --- [1] Git ---
:OPT_GIT
cls
echo %CYAN%═══ [1] INSTALAR / VERIFICAR GIT ═══%RST%
set "GIT_DONE=0"
where git >nul 2>&1
if not errorlevel 1 (
    for /f "delims=" %%g in ('git --version 2^>nul') do echo %GRN%[OK]%RST% %%g
    set "GIT_DONE=1"
)
if "!GIT_DONE!"=="0" (
    where winget >nul 2>&1
    if errorlevel 1 (
        echo %RED%winget no disponible. Instale App Installer desde Microsoft Store.%RST%
        call :BEEP_ERROR
    ) else (
        call :RUN_WITH_PROGRESS "Instalando Git silencioso" "winget install --id Git.Git -e --accept-package-agreements --accept-source-agreements --silent"
    )
)
call :WAIT_KEY
goto MAIN_MENU

rem --- [2] Docker ---
:OPT_DOCKER
cls
echo %CYAN%═══ [2] INSTALAR / VERIFICAR DOCKER DESKTOP ═══%RST%
set "DOCKER_DONE=0"
where docker >nul 2>&1
if not errorlevel 1 (
    for /f "delims=" %%d in ('docker --version 2^>nul') do echo %GRN%[OK]%RST% %%d
    docker info >nul 2>&1
    if not errorlevel 1 (
        echo %GRN%[OK]%RST% Docker Engine respondiendo
        set "DOCKER_DONE=1"
    )
)
if "!DOCKER_DONE!"=="0" (
    call :RUN_WITH_PROGRESS "Instalando Docker Desktop" "winget install --id Docker.DockerDesktop -e --accept-package-agreements --accept-source-agreements --silent"
    echo %YLW%Inicie Docker Desktop manualmente si es la primera instalacion.%RST%
)
call :WAIT_KEY
goto MAIN_MENU

rem --- [3] Escanner IP Inteligente ---
:OPT_STATIC_IP
cls
echo %CYAN%═══ [3] ESCANER DE RED INTELIGENTE - IP ESTATICA ═══%RST%
call :DETECT_NETWORK_PREFIX
call :LOADING_BAR "Barriendo red !NET_PREFIX!.2-60" 12
call :SCAN_NETWORK_IPS
echo.
echo %BLD%IPs OCUPADAS ^(con latencia^):%RST%
if exist "%SCAN_TMP%" (
    for /f "usebackq tokens=1,2,3 delims=|" %%a in ("%SCAN_TMP%") do echo   %%a  %%b  %%c ms
) else (
    echo   %DIM%Ninguna detectada en el rango escaneado.%RST%
)
echo.
echo %BLD%IPs LIBRES detectadas:%RST%
if exist "%FREE_TMP%" (
    for /f "usebackq tokens=1,2 delims=|" %%a in ("%FREE_TMP%") do echo   %%a  %%b
) else (
    echo   %RED%No se detectaron IPs libres en el rango.%RST%
)
echo.
echo %GRN%SUGERENCIA AUTOMATICA:%RST% !SUGGEST_IP! ^(menor riesgo de colision en zona servidor^)
echo.
echo   %GRN%[1]%RST% Usar IP sugerida automaticamente ^(!SUGGEST_IP!^)
echo   %GRN%[2]%RST% Digitar otra direccion IP manualmente
echo   %GRN%[C]%RST% Cancelar
set "IP_CHOICE="
set /p "IP_CHOICE=Seleccione: "
if /i "!IP_CHOICE!"=="C" goto OPT_STATIC_IP_DONE
if "!IP_CHOICE!"=="1" call :APPLY_STATIC_IP "!SUGGEST_IP!"
if "!IP_CHOICE!"=="2" (
    set "MANUAL_IP="
    set /p "MANUAL_IP=IP estatica deseada ^(ej !NET_PREFIX!.26^): "
    if not "!MANUAL_IP!"=="" call :APPLY_STATIC_IP "!MANUAL_IP!"
)
:OPT_STATIC_IP_DONE
call :WAIT_KEY
goto MAIN_MENU

rem --- [4] Tareas Madrugada ---
:OPT_DAWN_TASKS_SILENT
set "BOOT_PS=%REPO_ROOT%\backend\scripts\server_boot_prune.ps1"
set "DAWN_PS=%REPO_ROOT%\backend\scripts\server_dawn_maintenance.ps1"
set "BEEP_PS=%REPO_ROOT%\backend\scripts\server_hardware_beep_daemon.ps1"
schtasks /Create /TN "MCLarensERP_BootPrune" /SC ONSTART /RL HIGHEST /RU SYSTEM /TR "powershell.exe -NoProfile -ExecutionPolicy Bypass -File \"%BOOT_PS%\"" /F >nul 2>&1
schtasks /Create /TN "MCLarensERP_DawnRestart" /SC DAILY /ST 03:00 /RL HIGHEST /RU SYSTEM /TR "powershell.exe -NoProfile -ExecutionPolicy Bypass -File \"%DAWN_PS%\"" /F >nul 2>&1
schtasks /Create /TN "MCLarensERP_HardwareBeep" /SC ONSTART /RL HIGHEST /RU SYSTEM /TR "powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File \"%BEEP_PS%\"" /F >nul 2>&1
call :LOG "Tareas madrugada registradas (silent)"
goto :eof

:OPT_DAWN_TASKS
cls
echo %CYAN%═══ [4] CONFIGURAR MANTENIMIENTO DE MADRUGADA ^(03:00 AM^) ═══%RST%
call :LOADING_BAR "Registrando tareas programadas" 10
call :OPT_DAWN_TASKS_SILENT
echo %GRN%[OK]%RST% Tareas: BootPrune, DawnRestart 03:00, HardwareBeep
call :BEEP_OK
call :WAIT_KEY
goto MAIN_MENU

rem --- [5] Clonacion PAT ---
:CLONE_REPOSITORY
cls
color 0E
echo %YLW%╔══════════════════════════════════════════════════════════════════════╗%RST%
echo %YLW%║%RST%  %BLD%LLAVE ANTIRROBO - LICENCIA / PAT DE GITHUB OBLIGATORIA%RST%              %YLW%║%RST%
echo %YLW%║%RST%  El repositorio privado solo se despliega con token autorizado.     %YLW%║%RST%
echo %YLW%╚══════════════════════════════════════════════════════════════════════╝%RST%
echo.
echo %DIM%Destino: %REPO_ROOT%%RST%
echo.
set "GITHUB_PAT="
set /p "GITHUB_PAT=Ingrese PAT: "
if "!GITHUB_PAT!"=="" (
    echo %RED%[ABORTADO]%RST% PAT vacio.
    color 0B
    call :BEEP_ERROR
    call :WAIT_KEY
    goto MAIN_MENU
)
set "CLONE_URL=https://!GITHUB_PAT!@github.com/Samuraimaid/MC-LARENS_ERP2.git"
if not exist "%REPO_ROOT%\.git" (
    call :LOADING_BAR "Clonando repositorio privado" 12
    if not exist "%REPO_ROOT%" mkdir "%REPO_ROOT%"
    git clone "!CLONE_URL!" "%REPO_ROOT%" >>"%LOG_DIR%\toolbox.log" 2>&1
) else (
    call :LOADING_BAR "Actualizando repositorio" 8
    pushd "%REPO_ROOT%"
    git pull >>"%LOG_DIR%\toolbox.log" 2>&1
    popd
)
set "GITHUB_PAT="
set "CLONE_URL="
if errorlevel 1 (
    echo %RED%[FALLO]%RST% Clonacion/actualizacion fallida. Revise PAT y red.
    color 0B
    call :BEEP_ERROR
    call :WAIT_KEY
    goto MAIN_MENU
)
pushd "%REPO_ROOT%"
call :LOADING_BAR "Checkout commit !TARGET_COMMIT!" 6
git checkout !TARGET_COMMIT! >>"%LOG_DIR%\toolbox.log" 2>&1
popd
if errorlevel 1 (
    echo %RED%[FALLO]%RST% Checkout !TARGET_COMMIT! fallido.
    color 0B
    call :BEEP_ERROR
    call :WAIT_KEY
    goto MAIN_MENU
)
if exist "%REPO_ROOT%\docker-compose.yml" (
    set "CLEAN_INSTALL=0"
    setx MCLARENS_ERP_ROOT "%REPO_ROOT%" >nul 2>&1
    echo %GRN%[OK]%RST% Repositorio listo en commit !TARGET_COMMIT! - docker-compose.yml detectado.
) else (
    echo %YLW%[WARN]%RST% Repositorio en !TARGET_COMMIT! pero falta docker-compose.yml en %REPO_ROOT%
)
color 0B
call :BEEP_OK
call :WAIT_KEY
goto MAIN_MENU

rem --- [6] Casa Matriz ---
:OPT_NODE_MAIN
cls
echo %CYAN%═══ [6] DESPLEGAR NODO CASA MATRIZ ^(MUNDO DE ACCESORIOS^) ═══%RST%
call :WRITE_ENV_SUCURSAL
goto DEPLOY_STACK

rem --- [7] Bodega Pura ---
:OPT_NODE_WAREHOUSE
cls
echo %CYAN%═══ [7] DESPLEGAR NODO BODEGA PURA ═══%RST%
call :WRITE_ENV_BODEGA
goto DEPLOY_STACK

:WRITE_ENV_SUCURSAL
(
echo # Generado por mclarens_blackbox_toolbox.cmd
echo BRANCH_ID=branch_main
echo NODE_ID=branch_main
echo NODE_NAME=Mundo de Accesorios
echo NODE_TYPE=SUCURSAL
echo NODE_ENABLE_SALES=true
echo NODE_ENABLE_WORKSHOP=true
echo NODE_ENABLE_HR=true
echo SERVER_LAN_IP=!IP_FIJA!
echo SERVER_FRONTEND_PORT=3000
echo MONGODB_LOCAL_URI=mongodb://mongodb:27017
echo DB_NAME=mc-larens2_mundo_accesorios_erp
echo MONGODB_CENTRAL_URI=
echo PUBLIC_TUNNEL_URL_MAIN=https://mclarenerp.com
echo PUBLIC_TUNNEL_URL_NORTH=https://north.mclarenerp.com
echo PUBLIC_TUNNEL_URL_SOUTH=https://south.mclarenerp.com
echo HTTPS_CERT_IPS=127.0.0.1,!IP_FIJA!
)>"%REPO_ROOT%\.env"
echo %GRN%[OK]%RST% .env SUCURSAL escrito.
goto :eof

:WRITE_ENV_BODEGA
(
echo # Generado por mclarens_blackbox_toolbox.cmd
echo BRANCH_ID=warehouse_central
echo NODE_ID=warehouse_central
echo NODE_NAME=Bodega Pura Central
echo NODE_TYPE=BODEGA_PURA
echo NODE_ENABLE_SALES=false
echo NODE_ENABLE_WORKSHOP=false
echo NODE_ENABLE_HR=false
echo SERVER_LAN_IP=!IP_FIJA!
echo SERVER_FRONTEND_PORT=3000
echo MONGODB_LOCAL_URI=mongodb://mongodb:27017
echo DB_NAME=mc-larens2_mundo_accesorios_erp
echo MONGODB_CENTRAL_URI=
echo PUBLIC_TUNNEL_URL_MAIN=https://mclarenerp.com
echo HTTPS_CERT_IPS=127.0.0.1,!IP_FIJA!
)>"%REPO_ROOT%\.env"
echo %GRN%[OK]%RST% .env BODEGA_PURA escrito.
goto :eof

:DEPLOY_STACK
if not exist "%REPO_ROOT%\docker-compose.yml" (
    echo %RED%[FALLO]%RST% No se encontro docker-compose.yml en %REPO_ROOT%
    call :BEEP_ERROR
    call :WAIT_KEY
    goto MAIN_MENU
)
pushd "%REPO_ROOT%"
call :LOADING_BAR "Docker compose build" 15
docker compose up -d --build
set "DEPLOY_ERR=!errorlevel!"
popd
if !DEPLOY_ERR! neq 0 (
    echo %RED%[FALLO]%RST% docker compose up fallo.
    call :BEEP_ERROR
) else (
    echo %GRN%[OK]%RST% Stack ERP desplegado.
    call :BEEP_OK
)
call :WAIT_KEY
goto MAIN_MENU

rem --- [8] Kiosk + QR ASCII ---
:OPT_KIOSK
cls
color 0F
set "KIOSK_URL=http://!IP_FIJA!:3000"
set "DASH_URL=http://!IP_FIJA!:3000/server-dashboard"
echo %CYAN%═══ [8] CENTRO DE MANDO - QR ASCII + KIOSK ═══%RST%
echo.
call :RENDER_QR_ASCII "!KIOSK_URL!"
echo.
echo   %GRN%[1]%RST% Solo QR en consola ^(escanear ahora^)
echo   %GRN%[2]%RST% QR + abrir Kiosk fullscreen en Edge
echo   %GRN%[3]%RST% Volver al menu
set "KIOSK_CHOICE="
set /p "KIOSK_CHOICE=Seleccione: "
if "!KIOSK_CHOICE!"=="3" (
    color 0B
    goto MAIN_MENU
)
if "!KIOSK_CHOICE!"=="2" (
    set "EDGE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
    if exist "!EDGE!" (
        start "" "!EDGE!" --kiosk "!DASH_URL!" --edge-kiosk-type=fullscreen
    ) else (
        start "" "!DASH_URL!"
    )
    call :BEEP_OK
)
color 0B
call :WAIT_KEY
goto MAIN_MENU

rem --- [9] Backup USB ---
:OPT_BACKUP_USB
cls
echo %CYAN%═══ [9] RESPALDO MANUAL A USB EXTRAIBLE ═══%RST%
if not exist "%REPO_ROOT%\backups\usb" mkdir "%REPO_ROOT%\backups\usb" >nul 2>&1
call :LOADING_BAR "Ejecutando backup Delta" 12
docker ps --format "{{.Names}}" 2>nul | findstr /i "mundo-backend" >nul 2>&1
if errorlevel 1 (
    echo %RED%[FALLO]%RST% Contenedor mundo-backend no esta corriendo.
    call :BEEP_ERROR
    call :WAIT_KEY
    goto MAIN_MENU
)
docker exec mundo-backend bash /app/backend/scripts/backup_server_node.sh
if errorlevel 1 (
    echo %RED%[FALLO]%RST% backup_server_node.sh fallo.
    call :BEEP_ERROR
) else (
    echo %GRN%[OK]%RST% Respaldo interno + USB completado.
    call :BEEP_OK
)
call :WAIT_KEY
goto MAIN_MENU

rem --- [10] Beep Daemon ---
:OPT_BEEP_DAEMON
cls
echo %CYAN%═══ [10] DAEMON ALERTA SONORA HARDWARE ═══%RST%
set "BEEP_PS=%REPO_ROOT%\backend\scripts\server_hardware_beep_daemon.ps1"
if not exist "!BEEP_PS!" (
    echo %RED%[FALLO]%RST% No se encontro server_hardware_beep_daemon.ps1
    call :BEEP_ERROR
    call :WAIT_KEY
    goto MAIN_MENU
)
start "MCLarensERP_BeepDaemon" /min powershell.exe -NoProfile -ExecutionPolicy Bypass -File "!BEEP_PS!"
echo %GRN%[OK]%RST% Daemon Beep iniciado en segundo plano.
call :BEEP_OK
call :WAIT_KEY
goto MAIN_MENU

rem --- [11] Chaos Suite ---
:OPT_CHAOS_SUITE
cls
echo %CYAN%═══ [11] SUITE DE CAOS LOGISTICA Y QA EN VIVO ═══%RST%
docker ps --format "{{.Names}}" 2>nul | findstr /i "mundo-backend" >nul 2>&1
if errorlevel 1 (
    echo %RED%[FALLO]%RST% Backend no disponible. Despliegue el stack primero.
    call :BEEP_ERROR
    call :WAIT_KEY
    goto MAIN_MENU
)
call :LOADING_BAR "Ejecutando chaos suite" 20
docker exec mundo-backend python /app/backend/scripts/run_chaos_suite_live.py
if errorlevel 1 (
    echo %YLW%[WARN]%RST% Fallo via docker exec; intentando host local...
    pushd "%REPO_ROOT%"
    set "PYTHONPATH=%REPO_ROOT%"
    python backend\scripts\run_chaos_suite_live.py
    popd
)
if errorlevel 1 (
    echo %RED%[FALLO]%RST% Suite de caos reporto errores.
    call :BEEP_ERROR
) else (
    echo %GRN%[OK]%RST% Suite de caos completada.
    call :BEEP_OK
)
call :WAIT_KEY
goto MAIN_MENU

rem --- [99] Stack Control ---
:OPT_STACK_CONTROL
cls
echo %RED%═══ [99] APAGAR / REINICIAR STACK DE CONTENEDORES ═══%RST%
echo   %GRN%[A]%RST% Apagar stack ^(docker compose down^)
echo   %GRN%[R]%RST% Reiniciar stack ^(down + up --build^)
echo   %GRN%[C]%RST% Cancelar
set "STACK_CHOICE="
set /p "STACK_CHOICE=Seleccione A/R/C: "
if /i "!STACK_CHOICE!"=="C" goto MAIN_MENU
if /i "!STACK_CHOICE!"=="A" (
    pushd "%REPO_ROOT%"
    call :LOADING_BAR "Deteniendo contenedores" 8
    docker compose down
    popd
    goto STACK_DONE
)
if /i "!STACK_CHOICE!"=="R" (
    pushd "%REPO_ROOT%"
    call :LOADING_BAR "Reiniciando stack" 12
    docker compose down
    docker compose up -d --build
    popd
    goto STACK_DONE
)
goto OPT_STACK_CONTROL

:STACK_DONE
if errorlevel 1 (
    call :BEEP_ERROR
) else (
    call :BEEP_OK
)
call :WAIT_KEY
goto MAIN_MENU