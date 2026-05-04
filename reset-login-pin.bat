@echo off
setlocal
powershell -ExecutionPolicy Bypass -File "%~dp0scripts\support_reset_login_pin.ps1" %*
endlocal