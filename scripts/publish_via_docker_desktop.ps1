param(
    [switch]$IncludeDraftCheck,
    [switch]$OpenBrowser
)

$ErrorActionPreference = 'Stop'

function Write-Step($message) {
    Write-Host "`n=== $message ===" -ForegroundColor Cyan
}

function Ensure-Command($commandName) {
    if (-not (Get-Command $commandName -ErrorAction SilentlyContinue)) {
        throw "No se encontró el comando '$commandName'. Instálalo o agrégalo al PATH."
    }
}

function Test-Url200($url) {
    try {
        $status = (Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 20).StatusCode
        return ($status -ge 200 -and $status -lt 400)
    } catch {
        return $false
    }
}

function Wait-Url200($url, $timeoutSeconds = 90, $intervalSeconds = 3) {
    $start = Get-Date
    while (((Get-Date) - $start).TotalSeconds -lt $timeoutSeconds) {
        if (Test-Url200 $url) {
            return $true
        }
        Start-Sleep -Seconds $intervalSeconds
    }
    return $false
}

$workspace = Split-Path -Parent $PSScriptRoot
Set-Location $workspace

Write-Step "Validar prerrequisitos"
Ensure-Command docker
Ensure-Command powershell

try {
    docker info | Out-Null
} catch {
    throw "Docker no está disponible. Abre Docker Desktop e inténtalo de nuevo."
}

Write-Step "Ejecutar gate obligatorio pre-publicación"
$gateScript = Join-Path $PSScriptRoot 'pre_publish_gate.ps1'
$gateArgs = @('-ExecutionPolicy', 'Bypass', '-File', $gateScript)
if ($IncludeDraftCheck) {
    $gateArgs += '-IncludeDraftCheck'
}

& powershell @gateArgs
if ($LASTEXITCODE -ne 0) {
    throw "El gate pre-publicación falló. Publicación cancelada."
}

Write-Step "Construir y actualizar contenedores (backend/frontend)"
docker compose up -d --build backend frontend
if ($LASTEXITCODE -ne 0) {
    throw "Falló la actualización de contenedores con docker compose."
}

Write-Step "Verificar estado de servicios"
docker compose ps

$frontendUrl = 'http://127.0.0.1:3000'
$backendDocsUrl = 'http://127.0.0.1:8001/docs'

$frontendOk = Wait-Url200 $frontendUrl 90 3
$backendOk = Wait-Url200 $backendDocsUrl 90 3

if (-not $frontendOk) {
    throw "Frontend no responde en $frontendUrl"
}
if (-not $backendOk) {
    throw "Backend no responde en $backendDocsUrl"
}

Write-Host "`n===============================================" -ForegroundColor Green
Write-Host "PUBLICACION LOCAL EN DOCKER DESKTOP: APROBADA" -ForegroundColor Green
Write-Host "Frontend: $frontendUrl" -ForegroundColor Green
Write-Host "Backend docs: $backendDocsUrl" -ForegroundColor Green
Write-Host "===============================================`n" -ForegroundColor Green

if ($OpenBrowser) {
    Start-Process $frontendUrl | Out-Null
}
