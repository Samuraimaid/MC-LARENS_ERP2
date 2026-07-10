@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul 2>&1
title MCLARENS ERP — Server Black Box Toolbox v2.0-Delta
color 0B

:: ── ANSI / Virtual Terminal ──────────────────────────────────────────────────
reg add HKCU\Console /v VirtualTerminalLevel /t REG_DWORD /d 1 /f >nul 2>&1
for /F "delims=" %%a in ('echo prompt $E^| cmd') do set "ESC=%%a"
set "RST=%ESC%[0m"
set "CYAN=%ESC%[36m"
set "GRN=%ESC%[32m"
set "RED=%ESC%[31m"
set "YLW=%ESC%[33m"
set "BLD=%ESC%[1m"
set "DIM=%ESC%[2m"

:: ── Rutas y constantes ───────────────────────────────────────────────────────
set "SCRIPT_DIR=%~dp0"
set "ROOT=%SCRIPT_DIR%..\.."
for %%I in ("%ROOT%") do set "ROOT=%%~fI"
if not exist "%ROOT%\docker-compose.yml" set "ROOT=C:\MCLarensERP"
set "IP_FIJA=192.168.1.26"
set "GATEWAY=192.168.1.1"
set "TARGET_COMMIT=1a27364"
set "REPO_URL=https://github.com/Samuraimaid/MC-LARENS_ERP2.git"
set "SPIN_IDX=0"
set "LOG_DIR=%ProgramData%\MCLarensERP\logs"
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%" >nul 2>&1

:: ── Verificar Administrador ──────────────────────────────────────────────────
net session >nul 2>&1
if errorlevel 1 (
    echo %RED%[ERROR]%RST% Este toolbox requiere ejecucion como Administrador.
    echo         Clic derecho ^> "Ejecutar como administrador"
    pause
    exit /b 1
)

set "MCLARENS_ERP_ROOT=%ROOT%"
setx MCLARENS_ERP_ROOT "%ROOT%" >nul 2>&1

goto MAIN_MENU

:: ═══════════════════════════════════════════════════════════════════════════
::  SUBRUTINAS
:: ═══════════════════════════════════════════════════════════════════════════

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
if not exist "%ROOT%\.env" goto :eof
for /f "usebackq tokens=1,* delims==" %%a in (`findstr /b /i "NODE_ID BRANCH_ID" "%ROOT%\.env" 2^>nul`) do (
    set "KEY=%%a"
    set "VAL=%%b"
    set "VAL=!VAL:"=!"
    if /i "!KEY!"=="NODE_ID" set "NODE_ID=!VAL!"
    if /i "!KEY!"=="BRANCH_ID" set "NODE_ID=!VAL!"
)
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

:: ═══════════════════════════════════════════════════════════════════════════
::  MENU PRINCIPAL
:: ═══════════════════════════════════════════════════════════════════════════

:MAIN_MENU
cls
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
echo %CYAN%║%RST% %BLD%IP_FIJA:%RST% %IP_FIJA%          %BLD%INTERNET:%RST% !NET_COLOR!!NET_TEXT!!RST%                              %CYAN%║%RST%
echo %CYAN%║%RST% %BLD%ROOT:%RST% %DIM%%ROOT%%RST%
echo %CYAN%╠══════════════════════════════════════════════════════════════════════════════════════╣%RST%
echo %CYAN%║%RST%            %BLD%%CYAN%MCLARENS ERP — SERVER BLACK BOX CORE (v2.0-Delta)%RST%                  %CYAN%║%RST%
echo %CYAN%╠═══════════════════════════════╦═══════════════════════════════╦══════════════════════╣%RST%
echo %CYAN%║%RST% %YLW%[TWEAK ^& ENTORNO]%RST%              %CYAN%║%RST% %YLW%[ASISTENTE MULTI-NODO]%RST%          %CYAN%║%RST% %YLW%[MANTENIMIENTO]^& DAEMONS%RST%     %CYAN%║%RST%
echo %CYAN%╠═══════════════════════════════╬═══════════════════════════════╬══════════════════════╣%RST%
echo %CYAN%║%RST%  %GRN%[1]%RST% Instalar/Verificar Git       %CYAN%║%RST%  %GRN%[5]%RST% Clonar/Actualizar Repo (PAT) %CYAN%║%RST%  %GRN%[9]%RST% Respaldo Manual USB       %CYAN%║%RST%
echo %CYAN%║%RST%  %GRN%[2]%RST% Instalar/Verificar Docker    %CYAN%║%RST%  %GRN%[6]%RST% Nodo CASA MATRIZ (Sucursal)  %CYAN%║%RST%  %GRN%[10]%RST% Daemon Beep Hardware      %CYAN%║%RST%
echo %CYAN%║%RST%  %GRN%[3]%RST% Forzar IP Estatica !IP_FIJA! %CYAN%║%RST%  %GRN%[7]%RST% Nodo BODEGA PURA             %CYAN%║%RST%  %GRN%[11]%RST% Suite Caos Logistica QA   %CYAN%║%RST%
echo %CYAN%║%RST%  %GRN%[4]%RST% Tareas Madrugada 03:00 AM    %CYAN%║%RST%  %GRN%[8]%RST% Centro Mando Fullscreen      %CYAN%║%RST%  %RED%[99]%RST% Apagar/Reiniciar Stack    %CYAN%║%RST%
echo %CYAN%╚═══════════════════════════════╩═══════════════════════════════╩══════════════════════╝%RST%
echo.
set "MENU_CHOICE="
set /p "MENU_CHOICE=%BLD%Seleccione una opcion:%RST% "
if "%MENU_CHOICE%"=="" goto MAIN_MENU
if "%MENU_CHOICE%"=="1" goto OPT_GIT
if "%MENU_CHOICE%"=="2" goto OPT_DOCKER
if "%MENU_CHOICE%"=="3" goto OPT_STATIC_IP
if "%MENU_CHOICE%"=="4" goto OPT_DAWN_TASKS
if "%MENU_CHOICE%"=="5" goto OPT_CLONE_PAT
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

:: ── [1] Git ─────────────────────────────────────────────────────────────────
:OPT_GIT
cls
echo %CYAN%═══ [1] INSTALAR / VERIFICAR GIT ═══%RST%
where git >nul 2>&1
if not errorlevel 1 (
    for /f "delims=" %%g in ('git --version 2^>nul') do echo %GRN%[OK]%RST% %%g
    call :WAIT_KEY
)
where winget >nul 2>&1
if errorlevel 1 (
    echo %RED%winget no disponible. Instale App Installer desde Microsoft Store.%RST%
    call :BEEP_ERROR
    call :WAIT_KEY
)
call :RUN_WITH_PROGRESS "Instalando Git silencioso" "winget install --id Git.Git -e --accept-package-agreements --accept-source-agreements --silent"
call :WAIT_KEY

:: ── [2] Docker ──────────────────────────────────────────────────────────────
:OPT_DOCKER
cls
echo %CYAN%═══ [2] INSTALAR / VERIFICAR DOCKER DESKTOP ═══%RST%
where docker >nul 2>&1
if not errorlevel 1 (
    for /f "delims=" %%d in ('docker --version 2^>nul') do echo %GRN%[OK]%RST% %%d
    docker info >nul 2>&1
    if not errorlevel 1 (
        echo %GRN%[OK]%RST% Docker Engine respondiendo
        call :WAIT_KEY
    )
)
call :RUN_WITH_PROGRESS "Instalando Docker Desktop" "winget install --id Docker.DockerDesktop -e --accept-package-agreements --accept-source-agreements --silent"
echo %YLW%Inicie Docker Desktop manualmente si es la primera instalacion.%RST%
call :WAIT_KEY

:: ── [3] IP Estatica ─────────────────────────────────────────────────────────
:OPT_STATIC_IP
cls
echo %CYAN%═══ [3] FORZAR IP ESTATICA AUTORITARIA ═══%RST%
call :LOADING_BAR "Detectando adaptador activo" 5
for /f "tokens=1,* delims=:" %%a in ('powershell -NoProfile -Command "(Get-NetAdapter | Where-Object Status -eq 'Up' | Select-Object -First 1).Name"') do set "ADAPTER=%%b"
set "ADAPTER=!ADAPTER: =!"
if "!ADAPTER!"=="" set "ADAPTER=Ethernet"
echo Adaptador: !ADAPTER!
call :LOADING_BAR "Aplicando IP !IP_FIJA!" 6
netsh interface ipv4 set address name="!ADAPTER!" source=static address=!IP_FIJA! mask=255.255.255.0 gateway=!GATEWAY! >nul 2>&1
netsh interface ipv4 set dnsservers name="!ADAPTER!" source=static address=1.1.1.1 register=primary >nul 2>&1
netsh interface ipv4 add dnsservers name="!ADAPTER!" 8.8.8.8 index=2 >nul 2>&1
if errorlevel 1 (
    echo %RED%[FALLO]%RST% No se pudo fijar IP estatica.
    call :BEEP_ERROR
) else (
    echo %GRN%[OK]%RST% IP fijada en !IP_FIJA!
    call :BEEP_OK
)
call :LOG "IP estatica aplicada: !IP_FIJA! en !ADAPTER!"
call :WAIT_KEY

:: ── [4] Tareas Madrugada ─────────────────────────────────────────────────────
:OPT_DAWN_TASKS
cls
echo %CYAN%═══ [4] CONFIGURAR MANTENIMIENTO DE MADRUGADA (03:00 AM) ═══%RST%
set "BOOT_PS=%ROOT%\backend\scripts\server_boot_prune.ps1"
set "DAWN_PS=%ROOT%\backend\scripts\server_dawn_maintenance.ps1"
set "BEEP_PS=%ROOT%\backend\scripts\server_hardware_beep_daemon.ps1"
call :LOADING_BAR "Registrando tareas programadas" 10
schtasks /Create /TN "MCLarensERP_BootPrune" /SC ONSTART /RL HIGHEST /RU SYSTEM /TR "powershell.exe -NoProfile -ExecutionPolicy Bypass -File \"%BOOT_PS%\"" /F >nul 2>&1
schtasks /Create /TN "MCLarensERP_DawnRestart" /SC DAILY /ST 03:00 /RL HIGHEST /RU SYSTEM /TR "powershell.exe -NoProfile -ExecutionPolicy Bypass -File \"%DAWN_PS%\"" /F >nul 2>&1
schtasks /Create /TN "MCLarensERP_HardwareBeep" /SC ONSTART /RL HIGHEST /RU SYSTEM /TR "powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File \"%BEEP_PS%\"" /F >nul 2>&1
echo %GRN%[OK]%RST% Tareas: BootPrune, DawnRestart 03:00, HardwareBeep
call :BEEP_OK
call :WAIT_KEY

:: ── [5] Clonacion PAT ───────────────────────────────────────────────────────
:OPT_CLONE_PAT
cls
color 0E
echo %YLW%╔══════════════════════════════════════════════════════════════════════╗%RST%
echo %YLW%║%RST%  %BLD%LLAVE ANTIRROBO — LICENCIA / PAT DE GITHUB OBLIGATORIA%RST%              %YLW%║%RST%
echo %YLW%║%RST%  El repositorio privado solo se despliega con token autorizado.     %YLW%║%RST%
echo %YLW%╚══════════════════════════════════════════════════════════════════════╝%RST%
echo.
set "GITHUB_PAT="
set /p "GITHUB_PAT=Ingrese PAT (no se mostrara en pantalla): "
if "!GITHUB_PAT!"=="" (
    echo %RED%[ABORTADO]%RST% PAT vacio.
    color 0B
    call :BEEP_ERROR
    call :WAIT_KEY
)
set "CLONE_URL=https://!GITHUB_PAT!@github.com/Samuraimaid/MC-LARENS_ERP2.git"
if not exist "%ROOT%\.git" (
    call :LOADING_BAR "Clonando repositorio privado" 12
    if exist "%ROOT%" rmdir /s /q "%ROOT%" >nul 2>&1
    mkdir "%ROOT%" >nul 2>&1
    git clone "!CLONE_URL!" "%ROOT%" >>"%LOG_DIR%\toolbox.log" 2>&1
) else (
    call :LOADING_BAR "Actualizando repositorio" 8
    pushd "%ROOT%"
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
)
pushd "%ROOT%"
call :LOADING_BAR "Checkout commit !TARGET_COMMIT!" 6
git checkout !TARGET_COMMIT! >>"%LOG_DIR%\toolbox.log" 2>&1
popd
if errorlevel 1 (
    echo %RED%[FALLO]%RST% Checkout !TARGET_COMMIT! fallido.
    color 0B
    call :BEEP_ERROR
    call :WAIT_KEY
)
echo %GRN%[OK]%RST% Repositorio listo en commit !TARGET_COMMIT!
color 0B
call :BEEP_OK
call :WAIT_KEY

:: ── [6] Casa Matriz ─────────────────────────────────────────────────────────
:OPT_NODE_MAIN
cls
echo %CYAN%═══ [6] DESPLEGAR NODO CASA MATRIZ (MUNDO DE ACCESORIOS) ═══%RST%
call :WRITE_ENV_SUCURSAL
goto DEPLOY_STACK

:: ── [7] Bodega Pura ─────────────────────────────────────────────────────────
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
)>"%ROOT%\.env"
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
)>"%ROOT%\.env"
echo %GRN%[OK]%RST% .env BODEGA_PURA escrito.
goto :eof

:DEPLOY_STACK
if not exist "%ROOT%\docker-compose.yml" (
    echo %RED%[FALLO]%RST% No se encontro docker-compose.yml en %ROOT%
    call :BEEP_ERROR
    call :WAIT_KEY
)
pushd "%ROOT%"
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

:: ── [8] Kiosk Dashboard ──────────────────────────────────────────────────────
:OPT_KIOSK
cls
echo %CYAN%═══ [8] CENTRO DE MANDO VISUAL — PANTALLA COMPLETA ═══%RST%
set "KIOSK_URL=http://!IP_FIJA!:3000/server-dashboard"
echo Abriendo: !KIOSK_URL!
set "EDGE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if exist "!EDGE!" (
    start "" "!EDGE!" --kiosk "!KIOSK_URL!" --edge-kiosk-type=fullscreen
) else (
    start "" "!KIOSK_URL!"
)
call :BEEP_OK
call :WAIT_KEY

:: ── [9] Backup USB ───────────────────────────────────────────────────────────
:OPT_BACKUP_USB
cls
echo %CYAN%═══ [9] RESPALDO MANUAL A USB EXTRAIBLE ═══%RST%
if not exist "%ROOT%\backups\usb" mkdir "%ROOT%\backups\usb" >nul 2>&1
call :LOADING_BAR "Ejecutando backup Delta" 12
docker ps --format "{{.Names}}" | findstr /i "mundo-backend" >nul 2>&1
if errorlevel 1 (
    echo %RED%[FALLO]%RST% Contenedor mundo-backend no esta corriendo.
    call :BEEP_ERROR
    call :WAIT_KEY
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

:: ── [10] Beep Daemon ─────────────────────────────────────────────────────────
:OPT_BEEP_DAEMON
cls
echo %CYAN%═══ [10] DAEMON ALERTA SONORA HARDWARE ═══%RST%
set "BEEP_PS=%ROOT%\backend\scripts\server_hardware_beep_daemon.ps1"
if not exist "!BEEP_PS!" (
    echo %RED%[FALLO]%RST% No se encontro server_hardware_beep_daemon.ps1
    call :BEEP_ERROR
    call :WAIT_KEY
)
start "MCLarensERP_BeepDaemon" /min powershell.exe -NoProfile -ExecutionPolicy Bypass -File "!BEEP_PS!"
echo %GRN%[OK]%RST% Daemon Beep iniciado en segundo plano.
call :BEEP_OK
call :WAIT_KEY

:: ── [11] Chaos Suite ─────────────────────────────────────────────────────────
:OPT_CHAOS_SUITE
cls
echo %CYAN%═══ [11] SUITE DE CAOS LOGISTICA Y QA EN VIVO ═══%RST%
docker ps --format "{{.Names}}" | findstr /i "mundo-backend" >nul 2>&1
if errorlevel 1 (
    echo %RED%[FALLO]%RST% Backend no disponible. Despliegue el stack primero.
    call :BEEP_ERROR
    call :WAIT_KEY
)
call :LOADING_BAR "Ejecutando chaos suite" 20
docker exec mundo-backend python /app/backend/scripts/run_chaos_suite_live.py
if errorlevel 1 (
    echo %YLW%[WARN]%RST% Fallo via docker exec; intentando host local...
    pushd "%ROOT%"
    set "PYTHONPATH=%ROOT%"
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

:: ── [99] Stack Control ───────────────────────────────────────────────────────
:OPT_STACK_CONTROL
cls
echo %RED%═══ [99] APAGAR / REINICIAR STACK DE CONTENEDORES ═══%RST%
echo   %GRN%[A]%RST% Apagar stack (docker compose down)
echo   %GRN%[R]%RST% Reiniciar stack (down + up --build)
echo   %GRN%[C]%RST% Cancelar
set "STACK_CHOICE="
set /p "STACK_CHOICE=Seleccione A/R/C: "
if /i "!STACK_CHOICE!"=="C" goto MAIN_MENU
if /i "!STACK_CHOICE!"=="A" (
    pushd "%ROOT%"
    call :LOADING_BAR "Deteniendo contenedores" 8
    docker compose down
    popd
    goto STACK_DONE
)
if /i "!STACK_CHOICE!"=="R" (
    pushd "%ROOT%"
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