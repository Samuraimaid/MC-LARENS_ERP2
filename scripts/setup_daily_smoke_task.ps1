param(
  [string]$TaskName = "MC-LARENS ERP Daily Go-Live Smoke",
  [string]$RunAt = "06:30",
  [string]$PinEnvVar = "ERP_LOGIN_PIN",
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$scriptPath = Join-Path $PSScriptRoot "daily_go_live_smoke.ps1"
if (-not (Test-Path $scriptPath)) {
  throw "No se encontró: $scriptPath"
}

$argList = @(
  "-ExecutionPolicy", "Bypass",
  "-File", ('"{0}"' -f $scriptPath),
  "-PinEnvVar", ('"{0}"' -f $PinEnvVar)
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
Write-Host "Tarea de smoke diario creada/actualizada." -ForegroundColor Green
Write-Host "Tip: define '$PinEnvVar' con el PIN de gerencia antes del primer run." -ForegroundColor Yellow