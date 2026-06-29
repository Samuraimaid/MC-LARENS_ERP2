param(
  [switch]$SkipBackupTask,
  [switch]$SkipSmokeTask,
  [switch]$SkipInfrastructure,
  [switch]$SkipValidation,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
Push-Location $repoRoot

Write-Host "=== Aplicando pasos pre-go-live (2, 5, 7, 8) ===" -ForegroundColor Cyan

if (-not $SkipBackupTask.IsPresent) {
  Write-Host "`n[Paso 2] Backup MongoDB diario" -ForegroundColor Yellow
  if ($DryRun) {
    & (Join-Path $PSScriptRoot "setup_daily_mongodb_backup_task.ps1") -DryRun
  }
  else {
    & (Join-Path $PSScriptRoot "mongodb_backup.ps1")
    & (Join-Path $PSScriptRoot "setup_daily_mongodb_backup_task.ps1")
  }
}

if (-not $SkipInfrastructure.IsPresent) {
  Write-Host "`n[Paso 5] Infraestructura tienda" -ForegroundColor Yellow
  $infraArgs = @{}
  if ($DryRun) { $infraArgs.DryRun = $true }
  & (Join-Path $PSScriptRoot "setup_store_infrastructure.ps1") @infraArgs
}

if (-not $SkipSmokeTask.IsPresent) {
  Write-Host "`n[Paso 7] QA continuo (Playwright + smoke diario)" -ForegroundColor Yellow
  Push-Location (Join-Path $repoRoot "frontend")
  try {
    if (-not $DryRun) {
      npm run playwright:install
    }
  }
  finally {
    Pop-Location
  }
  if ($DryRun) {
    & (Join-Path $PSScriptRoot "setup_daily_smoke_task.ps1") -DryRun
  }
  else {
    & (Join-Path $PSScriptRoot "setup_daily_smoke_task.ps1")
  }
}

if (-not $SkipValidation.IsPresent) {
  Write-Host "`n[Paso 8] Validación funcional" -ForegroundColor Yellow
  if (-not $DryRun) {
    python (Join-Path $repoRoot "backend\scripts\go_live_validation_suite.py")
  }
  else {
    Write-Host "[DryRun] go_live_validation_suite.py" -ForegroundColor Yellow
  }
}

Pop-Location
Write-Host "`nPasos 2, 5, 7 y 8 aplicados." -ForegroundColor Green