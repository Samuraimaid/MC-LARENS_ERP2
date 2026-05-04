# ============================================================
# MUNDO DE ACCESORIOS - Script de Instalación para Windows
# Ejecutar como Administrador en PowerShell
# ============================================================

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "╔═══════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║    MUNDO DE ACCESORIOS - Instalación Local            ║" -ForegroundColor Cyan
Write-Host "║         Sistema de Facturación e Inventario           ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Verificar permisos de administrador
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "ERROR: Este script debe ejecutarse como Administrador" -ForegroundColor Red
    Write-Host "Haz clic derecho en PowerShell y selecciona 'Ejecutar como administrador'" -ForegroundColor Yellow
    exit 1
}

# Obtener directorio del script
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

# Función para verificar si un comando existe
function Test-CommandExists {
    param ($command)
    $exists = $null -ne (Get-Command $command -ErrorAction SilentlyContinue)
    return $exists
}

# Verificar requisitos
Write-Host "Verificando requisitos..." -ForegroundColor Yellow

$missingDeps = @()

if (-not (Test-CommandExists "mongod")) {
    Write-Host "✗ MongoDB no encontrado" -ForegroundColor Red
    $missingDeps += "mongodb"
} else {
    Write-Host "✓ MongoDB instalado" -ForegroundColor Green
}

if (-not (Test-CommandExists "node")) {
    Write-Host "✗ Node.js no encontrado" -ForegroundColor Red
    $missingDeps += "nodejs"
} else {
    Write-Host "✓ Node.js instalado" -ForegroundColor Green
}

if (-not (Test-CommandExists "python")) {
    Write-Host "✗ Python no encontrado" -ForegroundColor Red
    $missingDeps += "python"
} else {
    Write-Host "✓ Python instalado" -ForegroundColor Green
}

# Instalar dependencias faltantes con Chocolatey
if ($missingDeps.Count -gt 0) {
    Write-Host ""
    Write-Host "Faltan dependencias: $($missingDeps -join ', ')" -ForegroundColor Yellow
    
    # Verificar/Instalar Chocolatey
    if (-not (Test-CommandExists "choco")) {
        Write-Host "Instalando Chocolatey..." -ForegroundColor Cyan
        Set-ExecutionPolicy Bypass -Scope Process -Force
        [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
        $chocoInstallScript = Join-Path $env:TEMP "install-choco.ps1"
        (New-Object System.Net.WebClient).DownloadFile('https://community.chocolatey.org/install.ps1', $chocoInstallScript)
        & powershell -NoProfile -ExecutionPolicy Bypass -File $chocoInstallScript
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    }
    
    foreach ($dep in $missingDeps) {
        Write-Host "Instalando $dep..." -ForegroundColor Cyan
        switch ($dep) {
            "mongodb" {
                choco install mongodb -y
                # Iniciar servicio MongoDB
                Start-Service MongoDB
            }
            "nodejs" {
                choco install nodejs-lts -y
            }
            "python" {
                choco install python311 -y
            }
        }
    }
    
    # Refrescar variables de entorno
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    Write-Host "Reinicie PowerShell si los comandos no se reconocen" -ForegroundColor Yellow
}

# Obtener IP local
$LocalIP = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notlike "*Loopback*" -and $_.PrefixOrigin -eq "Dhcp" } | Select-Object -First 1).IPAddress
if (-not $LocalIP) {
    $LocalIP = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notlike "*Loopback*" } | Select-Object -First 1).IPAddress
}
Write-Host ""
Write-Host "IP del servidor: $LocalIP" -ForegroundColor Green

# Configurar Backend
Write-Host ""
Write-Host "Configurando Backend..." -ForegroundColor Cyan
Set-Location "$ScriptDir\backend"

# Crear entorno virtual
if (-not (Test-Path "venv")) {
    python -m venv venv
}

# Activar entorno virtual e instalar dependencias
& ".\venv\Scripts\Activate.ps1"
pip install --upgrade pip
pip install -r requirements.txt

# Configurar .env
@"
MONGO_URL=mongodb://localhost:27017
DB_NAME=mundo_accesorios_erp
CORS_ORIGINS=*
STRIPE_API_KEY=sk_test_your_key_here
"@ | Out-File -FilePath ".env" -Encoding UTF8

Write-Host "✓ Backend configurado" -ForegroundColor Green

# Configurar Frontend
Write-Host ""
Write-Host "Configurando Frontend..." -ForegroundColor Cyan
Set-Location "$ScriptDir\frontend"

# Instalar dependencias
npm install

# Configurar .env con IP local
@"
VITE_BACKEND_URL=http://${LocalIP}:8001
"@ | Out-File -FilePath ".env" -Encoding UTF8

Write-Host "✓ Frontend configurado" -ForegroundColor Green

# Configurar Firewall
Write-Host ""
Write-Host "Configurando Firewall..." -ForegroundColor Cyan
    try {
    New-NetFirewallRule -DisplayName "MUNDO DE ACCESORIOS Frontend" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3000 -ErrorAction SilentlyContinue
    New-NetFirewallRule -DisplayName "MUNDO DE ACCESORIOS Backend" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 8001 -ErrorAction SilentlyContinue
    Write-Host "✓ Reglas de firewall creadas" -ForegroundColor Green
} catch {
    Write-Host "Nota: No se pudieron crear reglas de firewall automáticamente" -ForegroundColor Yellow
}

# Crear script de inicio
Set-Location $ScriptDir
@"
@echo off
title MUNDO DE ACCESORIOS
echo.
echo ╔═══════════════════════════════════════════════════════╗
echo ║           MUNDO DE ACCESORIOS - Iniciando             ║
echo ╚═══════════════════════════════════════════════════════╝
echo.

:: Obtener IP local
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do set LOCAL_IP=%%a
set LOCAL_IP=%LOCAL_IP:~1%

:: Iniciar Backend
echo Iniciando Backend...
cd /d "%~dp0backend"
start "MUNDO DE ACCESORIOS Backend" cmd /c "venv\Scripts\activate && uvicorn server:app --host 0.0.0.0 --port 8001"

:: Esperar
timeout /t 5 /nobreak > nul

:: Iniciar Frontend
echo Iniciando Frontend...
cd /d "%~dp0frontend"
start "MUNDO DE ACCESORIOS Frontend" cmd /c "set PORT=3000 && npm start"

echo.
echo ╔═══════════════════════════════════════════════════════╗
echo ║           MUNDO DE ACCESORIOS Iniciado                ║
echo ╠═══════════════════════════════════════════════════════╣
echo ║  Frontend:  http://%LOCAL_IP%:3000                    ║
echo ║  Backend:   http://%LOCAL_IP%:8001/api                ║
echo ║  Tecnicos:  http://%LOCAL_IP%:3000/technician         ║
echo ╚═══════════════════════════════════════════════════════╝
echo.
echo Cierra esta ventana para ver las ventanas de los servicios
pause
"@ | Out-File -FilePath "start-mundo.bat" -Encoding ASCII

Write-Host ""
Write-Host "╔═══════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║          ¡Instalación Completada!                     ║" -ForegroundColor Green
Write-Host "╠═══════════════════════════════════════════════════════╣" -ForegroundColor Green
Write-Host "║                                                       ║" -ForegroundColor Green
Write-Host "║  Para iniciar la aplicación:                          ║" -ForegroundColor Green
Write-Host "║    Doble clic en start-mundo.bat                      ║" -ForegroundColor Green
Write-Host "║                                                       ║" -ForegroundColor Green
Write-Host "║  Acceso desde la red local:                           ║" -ForegroundColor Green
Write-Host "║    http://${LocalIP}:3000                             ║" -ForegroundColor Green
Write-Host "║                                                       ║" -ForegroundColor Green
Write-Host "║  App móvil técnicos:                                  ║" -ForegroundColor Green
Write-Host "║    http://${LocalIP}:3000/technician                  ║" -ForegroundColor Green
Write-Host "║                                                       ║" -ForegroundColor Green
Write-Host "╚═══════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
