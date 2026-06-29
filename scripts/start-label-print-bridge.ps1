# Inicia el puente local de impresión de etiquetas (USB -> TSPL)
$ErrorActionPreference = "Continue"
$root = Split-Path -Parent $PSScriptRoot
$bridge = Join-Path $root "scripts\label_print_bridge.py"
$port = if ($env:LABEL_BRIDGE_PORT) { [int]$env:LABEL_BRIDGE_PORT } else { 9265 }
$tokenFile = Join-Path $root "backend\data\label-bridge-token.txt"

if (-not $env:LABEL_BRIDGE_HOST) {
  $env:LABEL_BRIDGE_HOST = "127.0.0.1"
}

if (-not $env:LABEL_BRIDGE_TOKEN -and (Test-Path $tokenFile)) {
  $env:LABEL_BRIDGE_TOKEN = (Get-Content $tokenFile -Raw).Trim()
}

function Test-LabelBridge {
  try {
    $response = Invoke-RestMethod -Uri "http://127.0.0.1:$port/status" -TimeoutSec 2
    return $response
  } catch {
    return $null
  }
}

$existing = Test-LabelBridge
if ($existing) {
  Write-Host "Puente ya activo en puerto $port."
  Write-Host "Impresora: $($existing.printer_name) · Estado: $($existing.message)"
  exit 0
}

Write-Host "Iniciando puente de impresión de etiquetas en puerto $port..."
Write-Host "Impresora esperada: Xprinter XP-460B"

python -c "import win32print" 2>$null
if ($LASTEXITCODE -ne 0) {
  Write-Host "Instalando pywin32..."
  pip install pywin32 | Out-Null
}

$python = (Get-Command python -ErrorAction Stop).Source
$env:LABEL_BRIDGE_HOST = "127.0.0.1"

Start-Process `
  -FilePath $python `
  -ArgumentList "`"$bridge`"" `
  -WorkingDirectory $root `
  -WindowStyle Hidden `
  -ErrorAction Stop | Out-Null

$ready = $null
for ($attempt = 1; $attempt -le 12; $attempt++) {
  Start-Sleep -Seconds 1
  $ready = Test-LabelBridge
  if ($ready) {
    break
  }
}

if ($ready) {
  Write-Host "Puente iniciado correctamente en puerto $port."
  Write-Host "Impresora: $($ready.printer_name) · Estado: $($ready.message)"
  exit 0
}

Write-Host "No se pudo confirmar el puente en puerto $port después de 12 segundos."
Write-Host "Revisa que Python y pywin32 estén instalados y que el puerto no esté bloqueado."
exit 1