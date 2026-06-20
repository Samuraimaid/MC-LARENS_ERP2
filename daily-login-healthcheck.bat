@echo off
setlocal
powershell -ExecutionPolicy Bypass -File "%~dp0scripts\daily_login_healthcheck.ps1" %*
endlocal