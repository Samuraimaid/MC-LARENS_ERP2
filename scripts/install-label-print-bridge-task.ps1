# Registra el puente de etiquetas para que arranque al iniciar sesión en Windows
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$starter = Join-Path $root "scripts\start-label-print-bridge.ps1"
$taskName = "MCLarens-LabelPrintBridge"
$python = (Get-Command python -ErrorAction Stop).Source

$action = New-ScheduledTaskAction `
  -Execute "powershell.exe" `
  -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$starter`""

$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

Register-ScheduledTask `
  -TaskName $taskName `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Description "Puente USB para impresión de etiquetas MC-LARENS ERP" `
  -Force | Out-Null

Write-Host "Tarea programada '$taskName' instalada."
Write-Host "Se iniciará automáticamente al iniciar sesión."
Write-Host "Python detectado en: $python"