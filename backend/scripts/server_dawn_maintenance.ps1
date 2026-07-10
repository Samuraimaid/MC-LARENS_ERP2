# MC-LARENS ERP — Reinicio de madrugada (03:00 AM)
$ErrorActionPreference = "Stop"

$logDir = Join-Path $env:ProgramData "MCLarensERP\logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$logFile = Join-Path $logDir "dawn-maintenance.log"

function Write-Log([string]$Message) {
    $line = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $Message"
    Add-Content -Path $logFile -Value $line
}

Write-Log "Reinicio programado de madrugada iniciado"
try {
    if (Get-Command docker -ErrorAction SilentlyContinue) {
        docker compose -f "$env:MCLARENS_ERP_ROOT\docker-compose.yml" stop 2>$null
        Write-Log "Contenedores detenidos antes del reinicio"
    }
}
catch {
    Write-Log "No se pudieron detener contenedores: $($_.Exception.Message)"
}

Write-Log "Ejecutando reinicio del sistema operativo"
shutdown /r /t 30 /c "MC-LARENS ERP: mantenimiento de madrugada programado"
exit 0