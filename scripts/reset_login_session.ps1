param(
  [string]$FrontendBase = "http://127.0.0.1:3000",
  [string]$BackendBase = "http://127.0.0.1:8001",
  [switch]$NoOpenBrowser
)

$ErrorActionPreference = 'Continue'

Write-Host "[STEP] Invalidar sesión backend" -ForegroundColor Cyan
try {
  Invoke-WebRequest -Uri "$BackendBase/api/auth/logout" -Method POST -UseBasicParsing -TimeoutSec 10 | Out-Null
  Write-Host "[OK] Logout backend ejecutado" -ForegroundColor Green
} catch {
  Write-Warning "No se pudo llamar logout backend (continuando con limpieza local)."
}

Write-Host "[STEP] Limpiar archivos locales de cookies de pruebas" -ForegroundColor Cyan
$root = Split-Path -Path $PSScriptRoot -Parent
$cookieFiles = @(
  (Join-Path $root 'cookies.txt'),
  (Join-Path $root 'cookies_backend.txt'),
  (Join-Path $root 'frontend_login_response.txt'),
  (Join-Path $root 'backend_login_response.txt')
)
foreach ($file in $cookieFiles) {
  if (Test-Path $file) {
    try {
      Remove-Item $file -Force -ErrorAction Stop
      Write-Host "[OK] Eliminado: $file" -ForegroundColor Green
    } catch {
      Write-Warning "No se pudo eliminar: $file"
    }
  }
}

$freshUrl = "$FrontendBase/login?fresh=1&t=$([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())"
Write-Host "[INFO] URL fresh login: $freshUrl"

if (-not $NoOpenBrowser) {
  Write-Host "[STEP] Abrir login limpio en navegador" -ForegroundColor Cyan
  Start-Process $freshUrl | Out-Null
  Write-Host "[OK] Navegador abierto" -ForegroundColor Green
}

Write-Host "`nReset de sesión completado." -ForegroundColor Green
