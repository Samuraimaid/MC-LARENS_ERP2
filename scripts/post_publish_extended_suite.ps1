param(
  [string]$FrontendBase = "http://127.0.0.1:3000",
  [string]$BackendBase = "http://127.0.0.1:8001"
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Path $PSScriptRoot -Parent
$frontendPath = Join-Path $root 'frontend'
$releasePath = Join-Path $root 'RELEASE.md'

function Add-PostPublishReleaseLog {
  param(
    [string]$Status,
    [string]$Detail
  )

  $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
  $header = '## Registro automático post-publicación'
  $line = "- $timestamp | estado=$Status | detalle=$Detail"

  if (-not (Test-Path $releasePath)) {
    Set-Content -Path $releasePath -Value "$header`n`n$line`n" -Encoding UTF8
    return
  }

  $content = Get-Content -Path $releasePath -Raw
  if ($content -notmatch [regex]::Escape($header)) {
    Add-Content -Path $releasePath -Value "`n---`n`n$header`n`n$line" -Encoding UTF8
    return
  }

  Add-Content -Path $releasePath -Value $line -Encoding UTF8
}

if (-not (Test-Path $frontendPath)) {
  throw "No se encontró carpeta frontend en: $frontendPath"
}

 $runStatus = 'FAIL'
 $runDetail = 'Ejecución incompleta.'

Push-Location $frontendPath
try {
  $env:FRONTEND_BASE = $FrontendBase
  $env:BASE_URL = $FrontendBase
  $env:BACKEND_BASE = $BackendBase
  $env:BACKEND_URL = $BackendBase

  npx playwright test `
    e2e/login.spec.js `
    e2e/create_customer.spec.js `
    e2e/kiosk_ui_smoke.spec.js `
    e2e/login_ui_interaction.spec.js `
    e2e/capture_login_console.spec.js `
    e2e/login_reset_button_visual.spec.js `
    tests/pin_login.spec.js `
    --workers=1 `
    --reporter=list

  if ($LASTEXITCODE -ne 0) {
    throw "Suite extendida post-publicación falló (exit code $LASTEXITCODE)."
  }

  node .\scripts\verify_topcar_branding.js

  if ($LASTEXITCODE -ne 0) {
    throw "Verificación de branding TopCar falló (exit code $LASTEXITCODE)."
  }

  node .\scripts\verify_mundo_branding.js

  if ($LASTEXITCODE -ne 0) {
    throw "Verificación de branding Mundo falló (exit code $LASTEXITCODE)."
  }

  $runStatus = 'OK'
  $runDetail = 'Suite Playwright + branding TopCar y Mundo completadas.'
}
catch {
  $runDetail = $_.Exception.Message
  throw
}
finally {
  Pop-Location
  Add-PostPublishReleaseLog -Status $runStatus -Detail $runDetail
}

Write-Host "`nSuite extendida post-publicación: OK" -ForegroundColor Green