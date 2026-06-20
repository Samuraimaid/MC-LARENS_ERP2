@echo off
setlocal
powershell -ExecutionPolicy Bypass -File "%~dp0scripts\reset_login_session.ps1" %*
endlocal
