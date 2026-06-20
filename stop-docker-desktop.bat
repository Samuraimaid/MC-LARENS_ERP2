@echo off
setlocal
cd /d "%~dp0"

echo.
echo ========================================================
echo   APAGAR SERVICIOS LOCALES - DOCKER DESKTOP
echo ========================================================
echo.

docker compose ps
echo.
set /p CONFIRM=Detener servicios backend/frontend/mongodb? (S/N): 

if /I not "%CONFIRM%"=="S" (
  echo.
  echo Operacion cancelada.
  echo.
  pause
  exit /b 0
)

docker compose stop backend frontend mongodb
set EXIT_CODE=%ERRORLEVEL%

if not "%EXIT_CODE%"=="0" (
  echo.
  echo [ERROR] No se pudieron detener todos los servicios.
) else (
  echo.
  echo [OK] Servicios detenidos correctamente.
)

echo.
pause
exit /b %EXIT_CODE%
