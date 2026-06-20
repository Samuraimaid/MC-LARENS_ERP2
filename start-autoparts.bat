@echo off
echo This file has been deprecated. Run start-mundo.bat instead.
exit /b 0

:: Obtener IP local
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do set LOCAL_IP=%%a
set LOCAL_IP=%LOCAL_IP:~1%

:: Ir al directorio del script
cd /d "%~dp0"

:: Iniciar Backend
echo [1/2] Iniciando Backend en puerto 8001...
cd backend
start "Mundo Backend" cmd /c "venv\Scripts\activate && uvicorn server:app --host 0.0.0.0 --port 8001"
cd ..

:: Esperar que inicie el backend
echo Esperando que el backend inicie...
timeout /t 5 /nobreak > nul

:: Iniciar Frontend
echo [2/2] Iniciando Frontend en puerto 3000...
cd frontend
start "Mundo Frontend" cmd /c "set PORT=3000 && npm start"
cd ..

:: Esperar que inicie el frontend
timeout /t 10 /nobreak > nul

echo.
echo ========================================================
echo           MUNDO DE ACCESORIOS - Sistema Iniciado
echo ========================================================
echo.
echo   ACCESOS:
echo   --------
echo   Aplicacion Web:     http://%LOCAL_IP%:3000
echo   API Backend:        http://%LOCAL_IP%:8001/api
echo   App Tecnicos:       http://%LOCAL_IP%:3000/technician
echo.
echo   USUARIOS EN RED LOCAL:
echo   ----------------------
echo   Desde cualquier computadora o celular en la misma red,
echo   abrir el navegador e ir a: http://%LOCAL_IP%:3000
echo.
echo   Para instalar la app en el celular:
echo   1. Abrir http://%LOCAL_IP%:3000/technician en Chrome
echo   2. Menu (3 puntos) - Instalar aplicacion
echo.
echo ========================================================
echo.
echo Presiona cualquier tecla para cerrar esta ventana...
echo (Los servicios seguiran ejecutandose en segundo plano)
pause > nul
