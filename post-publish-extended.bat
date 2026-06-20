@echo off
setlocal
cd /d "%~dp0"

powershell -ExecutionPolicy Bypass -File ".\scripts\post_publish_extended_suite.ps1"
set EXIT_CODE=%ERRORLEVEL%

if not "%EXIT_CODE%"=="0" (
  echo.
  echo [ERROR] Suite extendida post-publicacion fallo.
) else (
  echo.
  echo [OK] Suite extendida post-publicacion aprobada.
)

exit /b %EXIT_CODE%