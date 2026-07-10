# MC-LARENS ERP — Autolimpieza Docker al arranque (Modelo Delta)
param(
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

function Write-Log([string]$Message) {
    $line = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $Message"
    Write-Host $line
    $logDir = Join-Path $env:ProgramData "MCLarensERP\logs"
    New-Item -ItemType Directory -Force -Path $logDir | Out-Null
    Add-Content -Path (Join-Path $logDir "boot-prune.log") -Value $line
}

Write-Log "Iniciando autolimpieza Docker post-arranque"

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Log "Docker no disponible; se omite prune"
    exit 0
}

try {
    $running = docker info 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Log "Docker Desktop aún no está listo"
        exit 0
    }
}
catch {
    Write-Log "Docker no responde: $($_.Exception.Message)"
    exit 0
}

$repoRoot = $env:MCLARENS_ERP_ROOT
if (-not $repoRoot) {
    $repoRoot = "C:\MC-LARENS_ERP_3\MC-LARENS_ERP2"
}

if (Test-Path (Join-Path $repoRoot "docker-compose.yml")) {
    Push-Location $repoRoot
    try {
        if ($DryRun) {
            Write-Log "[DryRun] docker compose up -d"
        }
        else {
            docker compose up -d
            Write-Log "Stack ERP levantado tras arranque"
        }
    }
    finally {
        Pop-Location
    }
}

if ($DryRun) {
    Write-Log "[DryRun] docker system prune -af --volumes"
    exit 0
}

docker system prune -af --volumes | Out-Null
Write-Log "docker system prune completado"
exit 0