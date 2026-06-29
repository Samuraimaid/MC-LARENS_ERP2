param(
  [string]$TaskName = "MC-LARENS ERP Daily MongoDB Backup",
  [string]$RunAt = "02:00",
  [int]$RetentionDays = 14,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$scriptPath = Join-Path $PSScriptRoot "mongodb_backup.ps1"
if (-not (Test-Path $scriptPath)) {
  throw "No se encontró: $scriptPath"
}

$argList = @(
  "-ExecutionPolicy", "Bypass",
  "-File", ('"{0}"' -f $scriptPath),
  "-RetentionDays", $RetentionDays
)

$taskCommand = "powershell.exe " + ($argList -join " ")

Write-Host "TaskName : $TaskName" -ForegroundColor Cyan
Write-Host "RunAt    : $RunAt" -ForegroundColor Cyan
Write-Host "Command  : $taskCommand" -ForegroundColor Cyan

if ($DryRun) {
  Write-Host "[DryRun] No se creó tarea programada." -ForegroundColor Yellow
  exit 0
}

$createArgs = @(
  "/Create",
  "/F",
  "/SC", "DAILY",
  "/TN", ('"{0}"' -f $TaskName),
  "/TR", ('"{0}"' -f $taskCommand),
  "/ST", $RunAt,
  "/RL", "LIMITED"
)

Invoke-Expression ("schtasks " + ($createArgs -join " ")) | Out-Null
Write-Host "Tarea de respaldo diario creada/actualizada." -ForegroundColor Green
Write-Host "Prueba manual: powershell -File .\scripts\mongodb_backup.ps1" -ForegroundColor Yellow