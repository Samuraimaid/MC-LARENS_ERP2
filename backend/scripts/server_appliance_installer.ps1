#Requires -RunAsAdministrator
<#
.SYNOPSIS
  Instalador autónomo MC-LARENS ERP — Servidor Black Box (.exe empaquetable vía PS2EXE)
.DESCRIPTION
  Instala Git + Docker, fija IP estática, clona repo privado con PAT,
  ejecuta wizard de expansión infinita, despliega Docker y registra tareas de mantenimiento.
#>
param(
    [string]$InstallRoot = "C:\MCLarensERP",
    [string]$StaticIp = "192.168.1.26",
    [string]$Gateway = "192.168.1.1",
    [string]$PrefixLength = "24",
    [string]$RepoUrl = "https://github.com/Samuraimaid/MC-LARENS_ERP2.git",
    [string]$TargetCommit = "7990810",
    [string]$GitHubPat = "",
    [switch]$SkipStaticIp,
    [switch]$SkipDocker,
    [switch]$SkipWizard,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$AppDataRoot = Join-Path $env:ProgramData "MCLarensERP"
$LogDir = Join-Path $AppDataRoot "logs"
New-Item -ItemType Directory -Force -Path $LogDir, $InstallRoot, (Join-Path $InstallRoot "backups\usb") | Out-Null

function Write-Step([string]$Message, [string]$Status = "INFO") {
    $color = switch ($Status) { "OK" { "Green" } "WARN" { "Yellow" } "FAIL" { "Red" } default { "Cyan" } }
    $line = "[$Status] $Message"
    Write-Host $line -ForegroundColor $color
    Add-Content -Path (Join-Path $LogDir "installer.log") -Value "[$(Get-Date -Format o)] $line"
}

function Test-CommandExists([string]$Name) {
    return $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

function Ensure-Winget {
    if (Test-CommandExists "winget") { return }
    Write-Step "winget no encontrado; intentando habilitar App Installer" "WARN"
}

function Install-Dependency([string]$WingetId, [string]$Label, [scriptblock]$Detector) {
    if (& $Detector) {
        Write-Step "$Label ya instalado" "OK"
        return
    }
    if ($DryRun) {
        Write-Step "[DryRun] Instalaría $Label ($WingetId)" "WARN"
        return
    }
    Ensure-Winget
    if (-not (Test-CommandExists "winget")) {
        throw "No se pudo instalar $Label: winget no disponible"
    }
    Write-Step "Instalando $Label en segundo plano..."
    winget install --id $WingetId -e --accept-package-agreements --accept-source-agreements --silent | Out-Null
    Start-Sleep -Seconds 8
    if (-not (& $Detector)) {
        throw "La instalación de $Label no se completó"
    }
    Write-Step "$Label instalado" "OK"
}

function Request-GitHubPat {
    if ($GitHubPat) { return $GitHubPat.Trim() }
    Write-Host ""
    Write-Host "╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Magenta
    Write-Host "║  LLAVE ANTIRROBO — Token GitHub (PAT) obligatorio            ║" -ForegroundColor Magenta
    Write-Host "║  El ERP privado solo se despliega con licencia cifrada.      ║" -ForegroundColor Magenta
    Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor Magenta
    $secure = Read-Host "Ingrese GitHub PAT (repo read)" -AsSecureString
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}

function Set-AuthoritativeStaticIp {
    param([string]$Ip, [string]$Gw, [string]$Prefix)
    if ($SkipStaticIp) {
        Write-Step "IP estática omitida por parámetro" "WARN"
        return
    }
    $adapter = Get-NetAdapter | Where-Object { $_.Status -eq "Up" -and $_.HardwareInterface } | Select-Object -First 1
    if (-not $adapter) { throw "No se encontró adaptador de red activo" }
    $name = $adapter.Name
    Write-Step "Fijando IP estática $Ip en interfaz '$name'"
    if ($DryRun) {
        Write-Step "[DryRun] netsh interface ipv4 set address `"$name`" static $Ip 255.255.255.0 $Gw" "WARN"
        return
    }
    netsh interface ipv4 set address name="$name" source=static address=$Ip mask=255.255.255.0 gateway=$Gw | Out-Null
    netsh interface ipv4 set dnsservers name="$name" source=static address=1.1.1.1 register=primary | Out-Null
    netsh interface ipv4 add dnsservers name="$name" 8.8.8.8 index=2 | Out-Null
    Write-Step "IP estática aplicada: $Ip" "OK"
}

function Test-UsbHasBackups([string]$Root) {
    $usb = Join-Path $Root "backups\usb"
    if (-not (Test-Path $usb)) { return $false }
    return @(Get-ChildItem -Path $usb -Filter "erp_delta_backup_*.tar.gz" -ErrorAction SilentlyContinue).Count -gt 0
}

function Invoke-ExpansionWizard {
    param([string]$Root)
    Write-Host ""
    Write-Host "=== ASISTENTE DE EXPANSIÓN INFINITA — NUEVO NODO ===" -ForegroundColor Yellow

    $nodeId = Read-Host "Identificador del nodo (ej: branch_main, warehouse_oriente)"
    if (-not $nodeId) { $nodeId = "branch_main" }
    $nodeName = Read-Host "Nombre descriptivo (ej: Mundo de Accesorios)"
    if (-not $nodeName) { $nodeName = $nodeId }

    Write-Host "Tipo de nodo:"
    Write-Host "  1) SUCURSAL (ventas/taller/RRHH modulares)"
    Write-Host "  2) BODEGA_PURA (solo inventario, despacho y traslados)"
    $typeChoice = Read-Host "Seleccione [1/2] (default 1)"
    $nodeType = if ($typeChoice -eq "2") { "BODEGA_PURA" } else { "SUCURSAL" }

    $enableSales = "true"
    $enableWorkshop = "true"
    $enableHr = "true"
    if ($nodeType -eq "SUCURSAL") {
        $salesAnswer = Read-Host "¿Activar Ventas Detalle/Mayorista? [S/n]"
        $workshopAnswer = Read-Host "¿Activar Taller Instalaciones/Polarizados? [S/n]"
        $hrAnswer = Read-Host "¿Activar RRHH y Reloj Marcador? [S/n]"
        if ($salesAnswer -match "^[Nn]") { $enableSales = "false" }
        if ($workshopAnswer -match "^[Nn]") { $enableWorkshop = "false" }
        if ($hrAnswer -match "^[Nn]") { $enableHr = "false" }
    }

    $centralUri = Read-Host "MongoDB Atlas URI (opcional, Enter para omitir)"
    $tunnelToken = Read-Host "Cloudflare TUNNEL_TOKEN (opcional)"

    $envPath = Join-Path $Root ".env"
    $envContent = @"
# Generado por server_appliance_installer.ps1
BRANCH_ID=$nodeId
NODE_ID=$nodeId
NODE_NAME=$nodeName
NODE_TYPE=$nodeType
NODE_ENABLE_SALES=$enableSales
NODE_ENABLE_WORKSHOP=$enableWorkshop
NODE_ENABLE_HR=$enableHr
SERVER_LAN_IP=$StaticIp
SERVER_FRONTEND_PORT=3000
MONGODB_LOCAL_URI=mongodb://mongodb:27017
DB_NAME=mc-larens2_mundo_accesorios_erp
MONGODB_CENTRAL_URI=$centralUri
PUBLIC_TUNNEL_URL_MAIN=https://mclarenerp.com
PUBLIC_TUNNEL_URL_NORTH=https://north.mclarenerp.com
PUBLIC_TUNNEL_URL_SOUTH=https://south.mclarenerp.com
CLOUDFLARE_TUNNEL_TOKEN=$tunnelToken
HTTPS_CERT_IPS=127.0.0.1,$StaticIp
"@
    if ($DryRun) {
        Write-Step "[DryRun] Escribiría .env en $envPath" "WARN"
    }
    else {
        Set-Content -Path $envPath -Value $envContent -Encoding UTF8
        Write-Step ".env generado para nodo $nodeId ($nodeType)" "OK"
    }
}

function Register-MaintenanceTasks {
    param([string]$Root)
    $bootScript = Join-Path $Root "backend\scripts\server_boot_prune.ps1"
    $dawnScript = Join-Path $Root "backend\scripts\server_dawn_maintenance.ps1"
    $beepScript = Join-Path $Root "backend\scripts\server_hardware_beep_daemon.ps1"

    [Environment]::SetEnvironmentVariable("MCLARENS_ERP_ROOT", $Root, "Machine")

    if ($DryRun) {
        Write-Step "[DryRun] Registraría tareas programadas de mantenimiento" "WARN"
        return
    }

    schtasks /Create /TN "MCLarensERP_BootPrune" /SC ONSTART /RL HIGHEST /RU SYSTEM /TR "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$bootScript`"" /F | Out-Null
    schtasks /Create /TN "MCLarensERP_DawnRestart" /SC DAILY /ST 03:00 /RL HIGHEST /RU SYSTEM /TR "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$dawnScript`"" /F | Out-Null
    schtasks /Create /TN "MCLarensERP_HardwareBeep" /SC ONSTART /RL HIGHEST /RU SYSTEM /TR "powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$beepScript`"" /F | Out-Null
    Write-Step "Tareas programadas registradas (arranque, 03:00 AM, beep hardware)" "OK"
}

function Start-KioskDashboard([string]$Ip) {
    $url = "http://${Ip}:3000/server-dashboard"
    Write-Step "Abriendo Centro de Mando en modo Kiosk: $url"
    if ($DryRun) { return }
    $edge = "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
    if (Test-Path $edge) {
        Start-Process $edge -ArgumentList "--kiosk", $url, "--edge-kiosk-type=fullscreen"
        return
    }
    Start-Process $url
}

try {
    Write-Step "MC-LARENS ERP — Instalador Servidor Black Box"
    $pat = Request-GitHubPat
    if (-not $pat) { throw "Token GitHub obligatorio para clonar el repositorio privado" }

    Install-Dependency -WingetId "Git.Git" -Label "Git" -Detector { Test-CommandExists "git" }
    if (-not $SkipDocker) {
        Install-Dependency -WingetId "Docker.DockerDesktop" -Label "Docker Desktop" -Detector { Test-CommandExists "docker" }
    }

    Set-AuthoritativeStaticIp -Ip $StaticIp -Gw $Gateway -Prefix $PrefixLength

    $cloneUrl = $RepoUrl -replace "^https://", "https://$pat@"
    if (-not (Test-Path (Join-Path $InstallRoot ".git"))) {
        Write-Step "Clonando repositorio privado en $InstallRoot"
        if ($DryRun) {
            Write-Step "[DryRun] git clone -> checkout $TargetCommit" "WARN"
        }
        else {
            if (Test-Path $InstallRoot) {
                $children = Get-ChildItem $InstallRoot -Force
                if ($children.Count -eq 0) { Remove-Item $InstallRoot -Force }
            }
            git clone $cloneUrl $InstallRoot
            Push-Location $InstallRoot
            git checkout $TargetCommit
            Pop-Location
            Write-Step "Repositorio clonado en commit $TargetCommit" "OK"
        }
    }
    else {
        Write-Step "Repositorio existente detectado; actualizando..."
        Push-Location $InstallRoot
        if (-not $DryRun) {
            git pull
            git checkout $TargetCommit
        }
        Pop-Location
    }

    $needsWizard = -not (Test-UsbHasBackups -Root $InstallRoot)
    if ($needsWizard -and -not $SkipWizard) {
        Invoke-ExpansionWizard -Root $InstallRoot
    }
    elseif (-not (Test-Path (Join-Path $InstallRoot ".env"))) {
        Invoke-ExpansionWizard -Root $InstallRoot
    }
    else {
        Write-Step "Nodo existente con respaldos/.env — wizard omitido" "OK"
    }

    Register-MaintenanceTasks -Root $InstallRoot

    if (-not $SkipDocker -and -not $DryRun) {
        Push-Location $InstallRoot
        docker compose up -d --build
        if ($LASTEXITCODE -ne 0) { throw "docker compose up falló" }
        Pop-Location
        Write-Step "Stack Docker desplegado" "OK"
    }

    Start-KioskDashboard -Ip $StaticIp
    Write-Step "Instalación del Servidor Black Box completada" "OK"
}
catch {
    Write-Step $_.Exception.Message "FAIL"
    exit 1
}