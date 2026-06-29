param(
  [string]$ApiBase = "http://127.0.0.1:8001/api",
  [string]$FrontendBase = "http://127.0.0.1:3000",
  [string]$PinEnvVar = "ERP_LOGIN_PIN",
  [string]$OutputFile = "test_reports/daily_go_live_smoke_latest.json",
  [switch]$SkipBrowser,
  [switch]$SkipPlaywrightE2E
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$frontendDir = Join-Path $repoRoot "frontend"

function Invoke-SmokeStep {
  param(
    [string]$Name,
    [scriptblock]$Action
  )
  Write-Host "`n=== $Name ===" -ForegroundColor Cyan
  & $Action
  if ($LASTEXITCODE -ne 0) {
    throw "Paso falló: $Name (exit $LASTEXITCODE)"
  }
  Write-Host "OK: $Name" -ForegroundColor Green
}

$startedAt = [DateTimeOffset]::Now
$steps = New-Object System.Collections.ArrayList

Push-Location $repoRoot
try {
  Invoke-SmokeStep -Name "Login healthcheck" -Action {
    $args = @(
      "-ExecutionPolicy", "Bypass",
      "-File", (Join-Path $PSScriptRoot "daily_login_healthcheck.ps1"),
      "-ApiBase", $ApiBase,
      "-FrontendUrl", $FrontendBase,
      "-PinEnvVar", $PinEnvVar,
      "-CheckFrontend",
      "-NonInteractive"
    )
    powershell @args
  }
  $steps.Add([ordered]@{ step = "login_healthcheck"; passed = $true }) | Out-Null

  Invoke-SmokeStep -Name "Validación funcional (RRHH, reportes, polarizados, rendimiento)" -Action {
    python (Join-Path $repoRoot "backend\scripts\go_live_validation_suite.py")
  }
  $steps.Add([ordered]@{ step = "go_live_validation"; passed = $true }) | Out-Null

  Invoke-SmokeStep -Name "Unit tests críticos backend" -Action {
    docker exec mundo-backend python -m pytest -q `
      backend/tests/test_attendance_status.py `
      backend/tests/test_payroll_periods.py `
      backend/tests/test_dispatch_purge.py
  }
  $steps.Add([ordered]@{ step = "backend_unit_tests"; passed = $true }) | Out-Null

  if (-not $SkipBrowser.IsPresent) {
    Push-Location $frontendDir
    try {
      Invoke-SmokeStep -Name "Smoke navegador (rutas ops)" -Action {
        node scripts/live_ops_pages_check.mjs
      }
      $steps.Add([ordered]@{ step = "live_ops_pages"; passed = $true }) | Out-Null

      Invoke-SmokeStep -Name "Smoke navegador (rutas críticas)" -Action {
        node scripts/live_go_live_smoke.mjs
      }
      $steps.Add([ordered]@{ step = "live_go_live_smoke"; passed = $true }) | Out-Null

      if (-not $SkipPlaywrightE2E.IsPresent) {
        Invoke-SmokeStep -Name "Playwright ops (purge + semáforo)" -Action {
          npm run test:e2e:ops
        }
        $steps.Add([ordered]@{ step = "playwright_ops"; passed = $true }) | Out-Null
      }
    }
    finally {
      Pop-Location
    }
  }

  $summary = [ordered]@{
    started_at = $startedAt.ToString("o")
    finished_at = (Get-Date).ToString("o")
    overall_passed = $true
    steps = @($steps)
  }
}
catch {
  $summary = [ordered]@{
    started_at = $startedAt.ToString("o")
    finished_at = (Get-Date).ToString("o")
    overall_passed = $false
    error = $_.Exception.Message
    steps = @($steps)
  }
  Write-Host "`nSmoke diario: FAIL" -ForegroundColor Red
  Write-Host $_.Exception.Message -ForegroundColor Red
}
finally {
  $outFull = if ([System.IO.Path]::IsPathRooted($OutputFile)) { $OutputFile } else { Join-Path $repoRoot $OutputFile }
  $outDir = [System.IO.Path]::GetDirectoryName($outFull)
  if ($outDir -and -not (Test-Path $outDir)) {
    New-Item -ItemType Directory -Path $outDir -Force | Out-Null
  }
  $summary | ConvertTo-Json -Depth 6 | Set-Content -Path $outFull -Encoding UTF8
  Write-Host "Reporte: $outFull" -ForegroundColor Yellow
  Pop-Location
}

if (-not $summary.overall_passed) {
  exit 1
}

Write-Host "`nSmoke diario: PASS" -ForegroundColor Green
exit 0