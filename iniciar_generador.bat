@echo off
title MC-LARENS ERP - Generador de Siluetas 3/4
color 0b
echo ==============================================================================
echo   INICIANDO GENERADOR DE SILUETAS 3/4 HD (MC-LARENS ERP)
echo ==============================================================================
cd /d "%~dp0"

set "PY_EXE=C:\Program Files\Blender Foundation\Blender 4.5\4.5\python\bin\python.exe"

if exist "%PY_EXE%" (
    "%PY_EXE%" scripts\generate_3q_vehicle_catalog.py
) else (
    python scripts\generate_3q_vehicle_catalog.py
)

pause
