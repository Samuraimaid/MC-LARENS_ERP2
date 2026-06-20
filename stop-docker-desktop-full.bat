@echo off
setlocal
cd /d "%~dp0"

echo.
echo ========================================================
echo   APAGADO TOTAL - DOCKER DESKTOP (COMPOSE DOWN)
echo ========================================================
echo.
echo Este modo detiene y elimina contenedores y red del proyecto.
echo Los datos de Mongo se conservan porque usan volumen nombrado.
echo.

docker compose ps
echo.
set /p CONFIRM=Ejecutar apagado total (docker compose down)? (S/N): 

if /I not "%CONFIRM%"=="S" (
  echo.
  echo Operacion cancelada.
  echo.
  pause
  exit /b 0
)

docker compose down
set EXIT_CODE=%ERRORLEVEL%

if not "%EXIT_CODE%"=="0" (
  echo.
  echo [ERROR] No se completo el apagado total.
) else (
  echo.
  echo [OK] Apagado total completado. Contenedores y red removidos.
)

echo.
pause
exit /b %EXIT_CODE%
