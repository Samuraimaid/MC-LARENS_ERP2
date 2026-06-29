param(
  [switch]$SkipHttpsRebuild,
  [switch]$SkipLabelBridge,
  [switch]$SkipFirewall,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot

function Write-Step {
  param([string]$Message, [string]$Status = "INFO")
  $color = switch ($Status) {
    "OK" { "Green" }
    "WARN" { "Yellow" }
    "FAIL" { "Red" }
    default { "Cyan" }
  }
  Write-Host "[$Status] $Message" -ForegroundColor $color
}

$report = [ordered]@{
  at = (Get-Date).ToString("o")
  lan_ip = $null
  urls = @{}
  checks = @()
  overall_passed = $false
}

function Add-Check {
  param([string]$Name, [bool]$Passed, [string]$Detail)
  $report.checks += [ordered]@{
    name = $Name
    passed = $Passed
    detail = $Detail
  }
}

Push-Location $repoRoot
try {
  Write-Step "Detectando IP LAN"
  $lanIp = & (Join-Path $PSScriptRoot "detect-lan-ip.ps1")
  $report.lan_ip = $lanIp
  $report.urls = [ordered]@{
    local_http = "http://127.0.0.1:3000"
    local_https = "https://127.0.0.1:3443"
    lan_http = "http://${lanIp}:3000"
    lan_https = "https://${lanIp}:3443"
    api = "http://${lanIp}:8001/docs"
  }
  Add-Check -Name "lan_ip" -Passed ($lanIp -ne "127.0.0.1") -Detail "IP detectada: $lanIp"

  Write-Step "Verificando contenedores Docker"
  $required = @("mclarens2-mongodb", "mundo-backend", "mundo-frontend")
  $running = docker ps --format "{{.Names}}"
  $missing = $required | Where-Object { $running -notcontains $_ }
  if ($missing.Count -gt 0) {
    throw "Contenedores faltantes: $($missing -join ', '). Ejecuta: docker compose up -d"
  }
  Add-Check -Name "docker_containers" -Passed $true -Detail ($required -join ", ")

  foreach ($name in $required) {
    $restart = docker inspect $name --format "{{.HostConfig.RestartPolicy.Name}}"
    Add-Check -Name "restart_policy_$name" -Passed ($restart -eq "unless-stopped") -Detail $restart
  }

  if (-not $SkipHttpsRebuild.IsPresent) {
    Write-Step "Regenerando certificado HTTPS para tablets ($lanIp)"
    if ($DryRun) {
      Add-Check -Name "https_rebuild" -Passed $true -Detail "[DryRun] HTTPS_CERT_IPS=127.0.0.1,$lanIp"
    }
    else {
      $env:HTTPS_CERT_IPS = "127.0.0.1,$lanIp"
      $env:HTTPS_CERT_DNS = "localhost"
      docker compose up -d --build frontend
      if ($LASTEXITCODE -ne 0) {
        throw "Falló rebuild de frontend HTTPS"
      }
      Add-Check -Name "https_rebuild" -Passed $true -Detail "Cert incluye $lanIp en :3443"
    }
  }

  if (-not $SkipLabelBridge.IsPresent) {
    Write-Step "Instalando/iniciando puente de impresión de etiquetas"
    if ($DryRun) {
      Add-Check -Name "label_bridge" -Passed $true -Detail "[DryRun] install-label-print-bridge-task.ps1"
    }
    else {
      & (Join-Path $PSScriptRoot "install-label-print-bridge-task.ps1")
      & (Join-Path $PSScriptRoot "start-label-print-bridge.ps1")
      $bridgePort = if ($env:LABEL_BRIDGE_PORT) { [int]$env:LABEL_BRIDGE_PORT } else { 9265 }
      try {
        $status = Invoke-RestMethod -Uri "http://127.0.0.1:$bridgePort/status" -TimeoutSec 5
        Add-Check -Name "label_bridge" -Passed $true -Detail "$($status.message) · $($status.printer_name)"
      }
      catch {
        Add-Check -Name "label_bridge" -Passed $false -Detail "Puente no responde en puerto $bridgePort"
      }
    }
  }

  if (-not $SkipFirewall.IsPresent) {
    Write-Step "Configurando firewall LAN (requiere admin)"
    $isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
      [Security.Principal.WindowsBuiltInRole]::Administrator
    )
    if (-not $isAdmin) {
      Add-Check -Name "firewall" -Passed $false -Detail "Ejecutar como Administrador para abrir puertos 3000/3443/8001"
      Write-Step "Firewall omitido (sin privilegios de admin)" "WARN"
    }
    elseif ($DryRun) {
      Add-Check -Name "firewall" -Passed $true -Detail "[DryRun] reglas MC-Larens-3000/3443/8001"
    }
    else {
      $ports = @(3000, 3443, 8001)
      foreach ($port in $ports) {
        $ruleName = "MC-Larens-$port"
        netsh advfirewall firewall delete rule name="$ruleName" | Out-Null
        netsh advfirewall firewall add rule name="$ruleName" dir=in action=allow protocol=tcp localport=$port remoteip=any profile=any | Out-Null
      }
      Add-Check -Name "firewall" -Passed $true -Detail "Puertos abiertos: $($ports -join ', ')"
    }
  }

  Write-Step "Verificando endpoints locales"
  try {
    $api = Invoke-RestMethod -Uri "http://127.0.0.1:8001/api/" -TimeoutSec 15
    Add-Check -Name "backend_health" -Passed ($null -ne $api.message) -Detail $api.message
  }
  catch {
    Add-Check -Name "backend_health" -Passed $false -Detail $_.Exception.Message
    throw
  }

  try {
    $front = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:3000" -TimeoutSec 15
    Add-Check -Name "frontend_health" -Passed ($front.StatusCode -ge 200 -and $front.StatusCode -lt 400) -Detail "HTTP $($front.StatusCode)"
  }
  catch {
    Add-Check -Name "frontend_health" -Passed $false -Detail $_.Exception.Message
    throw
  }

  $failed = @($report.checks | Where-Object { -not $_.passed })
  $report.overall_passed = ($failed.Count -eq 0)

  Write-Host ""
  Write-Host "=== Infraestructura tienda ===" -ForegroundColor Green
  Write-Host "Tablets KDS (HTTPS): $($report.urls.lan_https)" -ForegroundColor Yellow
  Write-Host "Tablets KDS (HTTP):  $($report.urls.lan_http)" -ForegroundColor Yellow
  Write-Host "API documentación:   $($report.urls.api)" -ForegroundColor Yellow
}
catch {
  $report.overall_passed = $false
  Write-Step $_.Exception.Message "FAIL"
}
finally {
  $outDir = Join-Path $repoRoot "test_reports"
  if (-not (Test-Path $outDir)) {
    New-Item -ItemType Directory -Path $outDir -Force | Out-Null
  }
  $outFile = Join-Path $outDir "store_infrastructure_latest.json"
  $report | ConvertTo-Json -Depth 6 | Set-Content -Path $outFile -Encoding UTF8
  Write-Host "Reporte: $outFile" -ForegroundColor Yellow
  Pop-Location
}

if (-not $report.overall_passed) {
  exit 1
}
exit 0