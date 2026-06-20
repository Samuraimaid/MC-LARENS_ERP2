param(
  [string]$BaseUrl = "http://127.0.0.1:8001",
  [switch]$IncludeDraftCheck,
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Path $PSScriptRoot -Parent

function Invoke-Step {
  param(
    [string]$Name,
    [scriptblock]$Action
  )

  Write-Host "`n=== $Name ===" -ForegroundColor Cyan
  if ($DryRun) {
    Write-Host "[DRY-RUN] Paso validado: $Name" -ForegroundColor Yellow
    return
  }

  & $Action
  Write-Host "OK: $Name" -ForegroundColor Green
}

function Assert-Command {
  param([string]$Name)
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Comando requerido no encontrado: $Name"
  }
}

try {
  Assert-Command docker
  Assert-Command python
  Assert-Command npm

  Push-Location $root

  Invoke-Step -Name "Validar contenedores clave en ejecución" -Action {
    $required = @('mundo-backend', 'mundo-frontend', 'mundo-mongodb')
    $running = docker ps --format '{{.Names}}'
    foreach ($name in $required) {
      if (-not ($running -contains $name)) {
        throw "Contenedor no está corriendo: $name"
      }
    }
  }

  Invoke-Step -Name "Health check backend" -Action {
    $health = Invoke-RestMethod -Uri "$BaseUrl/api/" -Method Get -TimeoutSec 20
    if (-not $health.message) {
      throw "Respuesta inesperada en health check"
    }
  }

  Invoke-Step -Name "Prueba rápida de drafts backup" -Action {
    $env:VITE_BACKEND_URL = $BaseUrl
    $env:REACT_APP_BACKEND_URL = $BaseUrl
    python scripts/run_drafts_test.py
    if ($LASTEXITCODE -ne 0) { throw "Falló run_drafts_test.py" }
  }

  Invoke-Step -Name "Suite crítica backend (PIN, lockout, técnicos, importación)" -Action {
    $env:BASE_URL = $BaseUrl
    $tests = @(
      'backend/tests/test_pin_integration.py',
      'backend/tests/test_pin_lockout.py',
      'backend/tests/test_technicians_crud.py',
      'backend/tests/test_csv_import_installation.py'
    )
    python -m pytest -q @tests
    if ($LASTEXITCODE -ne 0) { throw "Falló pytest de suite crítica" }
  }

  Invoke-Step -Name "Build frontend producción" -Action {
    Push-Location (Join-Path $root 'frontend')
    try {
      npm run build
      if ($LASTEXITCODE -ne 0) { throw "Falló build frontend" }
    }
    finally {
      Pop-Location
    }
  }

  if ($IncludeDraftCheck) {
    Invoke-Step -Name "Draft-check frontend (opcional reforzado)" -Action {
      Push-Location (Join-Path $root 'frontend')
      try {
        npm run test:draft-check
        if ($LASTEXITCODE -ne 0) { throw "Falló test:draft-check" }
      }
      finally {
        Pop-Location
      }
    }
  }

  Write-Host "`n===============================================" -ForegroundColor Green
  Write-Host 'PRE-PUBLICACION APROBADA' -ForegroundColor Green
  Write-Host "Base URL validada: $BaseUrl" -ForegroundColor Green
  if ($IncludeDraftCheck) {
    Write-Host 'Modo reforzado: draft-check incluido' -ForegroundColor Green
  }
  Write-Host "===============================================`n" -ForegroundColor Green
}
catch {
  Write-Host "`nFALLO EN PRE-PUBLICACION: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}
finally {
  Pop-Location -ErrorAction SilentlyContinue
}
