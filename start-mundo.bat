@echo off
title MUNDO DE ACCESORIOS
echo.
echo ========================================================
echo           MUNDO DE ACCESORIOS - Iniciando Servicios
echo ========================================================
echo.

:: Obtener IP local
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do set LOCAL_IP=%%a
set LOCAL_IP=%LOCAL_IP:~1%

:: Ir al directorio del script
cd /d "%~dp0"

:: Build Frontend (servido por backend)
echo [1/2] Generando build del Frontend...
cd frontend
set NODE_OPTIONS=--max_old_space_size=4096
set CI=false
set DISABLE_ESLINT_PLUGIN=true
for /f %%i in ('node -e "process.stdout.write(new Date().toISOString())"') do set REACT_APP_BUILD_TIME=%%i
for /f %%i in ('node -p "require(\"./package.json\").version"') do set REACT_APP_VERSION=%%i
npm run build
if errorlevel 1 (
	echo.
	echo [ADVERTENCIA] El build del frontend fallo. Se usara el build anterior si existe.
	echo.
)
cd ..

:: Iniciar Backend (sirve frontend + API)
echo [2/2] Iniciando Backend en puerto 8001...
cd backend
start "Mundo Backend" cmd /c "venv\Scripts\activate && uvicorn server:app --host 0.0.0.0 --port 8001"
cd ..

:: Esperar que inicie el backend
echo Esperando que el backend inicie...
timeout /t 5 /nobreak > nul

echo.
echo ========================================================
echo           MUNDO DE ACCESORIOS - Sistema Iniciado
echo ========================================================
echo.
echo   ACCESOS:
echo   --------
echo   Aplicacion Web:     http://%LOCAL_IP%:8001
echo   API Backend:        http://%LOCAL_IP%:8001/api
echo   App Tecnicos:       http://%LOCAL_IP%:8001/technician
echo.
echo   USUARIOS EN RED LOCAL:
echo   ----------------------
echo   Desde cualquier computadora o celular en la misma red,
echo   abrir el navegador e ir a: http://%LOCAL_IP%:8001
echo.
echo   Para instalar la app en el celular:
echo   1. Abrir http://%LOCAL_IP%:8001/technician en Chrome
echo   2. Menu (3 puntos) - Instalar aplicacion
echo.
echo ========================================================
echo.
echo Presiona cualquier tecla para cerrar esta ventana...
echo (Los servicios seguiran ejecutandose en segundo plano)
pause > nul
