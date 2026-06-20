@echo off
setlocal
cd /d "%~dp0"

echo.
echo ========================================================
echo   PUBLICACION LOCAL - DOCKER DESKTOP (SIN VS CODE)
echo ========================================================
echo.

powershell -ExecutionPolicy Bypass -File ".\scripts\publish_via_docker_desktop.ps1" -OpenBrowser
set EXIT_CODE=%ERRORLEVEL%

if not "%EXIT_CODE%"=="0" (
  echo.
  echo [ERROR] La publicacion no se completo. Revisa los mensajes anteriores.
) else (
  echo.
  echo [OK] Publicacion completada. Aplicacion disponible en http://localhost:3000
)

echo.
pause
exit /b %EXIT_CODE%
