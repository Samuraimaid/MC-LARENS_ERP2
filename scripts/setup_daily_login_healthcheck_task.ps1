param(
  [string]$TaskName = "MC-LARENS ERP Daily Login Healthcheck",
  [string]$RunAt = "07:00",
  [string]$UserName = "Xinon",
  [string]$UserId,
  [string]$PinEnvVar = "ERP_LOGIN_PIN",
  [string]$ApiBase = "http://127.0.0.1:8001/api",
  [switch]$CheckFrontend,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$scriptPath = Join-Path $PSScriptRoot "daily_login_healthcheck.ps1"

if (-not (Test-Path $scriptPath)) {
  throw "No se encontró el script: $scriptPath"
}

$argList = @(
  "-ExecutionPolicy", "Bypass",
  "-File", ('"{0}"' -f $scriptPath),
  "-ApiBase", ('"{0}"' -f $ApiBase),
  "-PinEnvVar", ('"{0}"' -f $PinEnvVar),
  "-NonInteractive"
)

if ($UserId) {
  $argList += @("-UserId", ('"{0}"' -f $UserId))
} else {
  $argList += @("-UserName", ('"{0}"' -f $UserName))
}

if ($CheckFrontend.IsPresent) {
  $argList += "-CheckFrontend"
}

$taskCommand = "powershell.exe " + ($argList -join " ")

Write-Host "TaskName : $TaskName" -ForegroundColor Cyan
Write-Host "RunAt    : $RunAt" -ForegroundColor Cyan
Write-Host "Command  : $taskCommand" -ForegroundColor Cyan

if ($DryRun) {
  Write-Host "[DryRun] No se creó tarea programada." -ForegroundColor Yellow
  return
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

$createCmd = "schtasks " + ($createArgs -join " ")
Write-Host "Ejecutando: $createCmd" -ForegroundColor Cyan

Invoke-Expression $createCmd | Out-Null

Write-Host "Tarea programada creada/actualizada correctamente." -ForegroundColor Green
Write-Host "Tip: define la variable de entorno '$PinEnvVar' con el PIN de 8 dígitos antes del primer run." -ForegroundColor Yellow
