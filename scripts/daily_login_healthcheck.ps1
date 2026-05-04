param(
  [string]$UserId,
  [string]$UserName = "Xinon",
  [string]$Pin,
  [string]$PinEnvVar = "ERP_LOGIN_PIN",
  [switch]$NonInteractive,
  [string]$ApiBase = "http://127.0.0.1:8001/api",
  [string]$FrontendUrl = "http://127.0.0.1:3000",
  [switch]$CheckFrontend,
  [string]$BackendContainer = "mundo-backend",
  [string]$OutputFile = "test_reports/login_healthcheck_latest.json",
  [string]$HistoryDir = "test_reports/login_healthchecks"
)

$ErrorActionPreference = "Stop"

function Write-Check {
  param([string]$Message)
  Write-Host "[CHECK] $Message" -ForegroundColor Cyan
}

function Write-Ok {
  param([string]$Message)
  Write-Host "[OK] $Message" -ForegroundColor Green
}

function Write-Fail {
  param([string]$Message)
  Write-Host "[FAIL] $Message" -ForegroundColor Red
}

function Add-CheckResult {
  param(
    [string]$Name,
    [bool]$Passed,
    [string]$Detail,
    [hashtable]$Extra = @{}
  )

  $item = [ordered]@{
    name = $Name
    passed = $Passed
    detail = $Detail
  }

  foreach ($k in $Extra.Keys) {
    $item[$k] = $Extra[$k]
  }

  $script:checkResults.Add($item) | Out-Null
}

function Resolve-AbsolutePath {
  param([string]$PathValue)

  if ([System.IO.Path]::IsPathRooted($PathValue)) {
    return $PathValue
  }

  return [System.IO.Path]::GetFullPath((Join-Path (Get-Location) $PathValue))
}

function Assert-DockerContainerRunning {
  param([string]$ContainerName)

  $running = docker ps --format '{{.Names}}'
  if (-not ($running -contains $ContainerName)) {
    throw "El contenedor '$ContainerName' no está corriendo."
  }
}

function Get-ContainerEnvValue {
  param(
    [string]$ContainerName,
    [string]$Key,
    [string]$DefaultValue
  )

  $envLines = docker inspect $ContainerName --format "{{range .Config.Env}}{{println .}}{{end}}"
  $match = $envLines | Where-Object { $_ -like "$Key=*" } | Select-Object -First 1
  if (-not $match) {
    return $DefaultValue
  }

  return ($match -replace "^$Key=", "")
}

$script:checkResults = New-Object System.Collections.ArrayList
$startedAt = [DateTimeOffset]::Now

$resolvedPin = $Pin
if (-not $resolvedPin) {
  $envPin = [Environment]::GetEnvironmentVariable($PinEnvVar)
  if ($envPin) {
    $resolvedPin = $envPin
  }
}

if (-not $resolvedPin -and -not $NonInteractive.IsPresent) {
  $secure = Read-Host "Ingresa PIN de login (8 dígitos)" -AsSecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try {
    $resolvedPin = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  }
  finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
  }
}

if (-not $resolvedPin -or $resolvedPin -notmatch '^\d{8}$') {
  throw "PIN inválido. Usa -Pin (8 dígitos) o define la variable de entorno '$PinEnvVar'."
}

$summary = [ordered]@{
  started_at = $startedAt.ToString("o")
  finished_at = $null
  duration_seconds = $null
  overall_passed = $false
  target = [ordered]@{
    user_id = $null
    user_name = $null
  }
  endpoints = [ordered]@{
    api_base = $ApiBase
    frontend_url = $FrontendUrl
  }
  checks = @()
}

try {
  Write-Check "Health check backend"
  try {
    $health = Invoke-RestMethod -Method Get -Uri "$ApiBase/" -TimeoutSec 15
    if (-not $health.message) {
      throw "Backend no devolvió payload esperado en /api/"
    }

    Write-Ok "Backend responde: $($health.message)"
    Add-CheckResult -Name "backend_health" -Passed $true -Detail "Backend responde correctamente" -Extra @{ status = 200; message = "$($health.message)" }
  }
  catch {
    Write-Fail "Backend no disponible: $($_.Exception.Message)"
    Add-CheckResult -Name "backend_health" -Passed $false -Detail "Backend no disponible" -Extra @{ error = "$($_.Exception.Message)" }
    throw
  }

  if ($CheckFrontend.IsPresent) {
    Write-Check "Health check frontend"
    try {
      $frontResp = Invoke-WebRequest -UseBasicParsing -Method Get -Uri $FrontendUrl -TimeoutSec 15
      $frontStatus = [int]$frontResp.StatusCode

      if ($frontStatus -ge 200 -and $frontStatus -lt 400) {
        Write-Ok "Frontend responde: status=$frontStatus"
        Add-CheckResult -Name "frontend_health" -Passed $true -Detail "Frontend disponible" -Extra @{ status = $frontStatus }
      }
      else {
        throw "Status inesperado: $frontStatus"
      }
    }
    catch {
      Write-Fail "Frontend no disponible: $($_.Exception.Message)"
      Add-CheckResult -Name "frontend_health" -Passed $false -Detail "Frontend no disponible" -Extra @{ error = "$($_.Exception.Message)" }
      throw
    }
  }

  Write-Check "Resolver usuario PIN"
  $users = Invoke-RestMethod -Method Get -Uri "$ApiBase/auth/pin/users" -TimeoutSec 20
  if (-not $users) {
    throw "No se pudieron obtener usuarios PIN"
  }

  $target = $null
  if ($UserId) {
    $target = $users | Where-Object { $_.user_id -eq $UserId } | Select-Object -First 1
  }
  else {
    $target = $users | Where-Object { ("$($_.name)".Trim().ToLower()) -eq $UserName.Trim().ToLower() } | Select-Object -First 1
  }

  if (-not $target) {
    throw "No se encontró usuario objetivo en /auth/pin/users"
  }

  $resolvedUserId = [string]$target.user_id
  $resolvedUserName = [string]$target.name
  $summary.target.user_id = $resolvedUserId
  $summary.target.user_name = $resolvedUserName

  Write-Ok "Usuario objetivo: $resolvedUserName ($resolvedUserId)"
  Add-CheckResult -Name "resolve_user" -Passed $true -Detail "Usuario objetivo resuelto" -Extra @{ user_id = $resolvedUserId; user_name = $resolvedUserName }

  Write-Check "Login PIN"
  $loginBody = @{ user_id = $resolvedUserId; pin = $resolvedPin } | ConvertTo-Json
  try {
    $loginResp = Invoke-WebRequest -UseBasicParsing -Method Post -Uri "$ApiBase/auth/pin/login" -ContentType "application/json" -Body $loginBody -TimeoutSec 20
    $loginStatus = [int]$loginResp.StatusCode

    Write-Ok "Login OK, status=$loginStatus"
    Add-CheckResult -Name "login_pin" -Passed $true -Detail "Login exitoso" -Extra @{ status = $loginStatus }
  }
  catch {
    Write-Fail "Login falló: $($_.Exception.Message)"
    Add-CheckResult -Name "login_pin" -Passed $false -Detail "Login falló" -Extra @{ error = "$($_.Exception.Message)" }
    throw
  }

  Write-Check "Estado lockout en DB activa"
  try {
    Assert-DockerContainerRunning -ContainerName $BackendContainer

    $dbName = Get-ContainerEnvValue -ContainerName $BackendContainer -Key "DB_NAME" -DefaultValue "mundo_accesorios_erp"
    $tmpPy = Join-Path $PSScriptRoot "_tmp_lockout_check.py"

    $pyCode = @'
import json
import os
from pymongo import MongoClient

mongo_url = os.environ.get("MONGO_URL", "mongodb://mongodb:27017")
db_name = os.environ.get("DB_NAME", "mundo_accesorios_erp")
user_id = os.environ.get("TARGET_USER_ID", "").strip()

client = MongoClient(mongo_url, serverSelectionTimeoutMS=5000)
doc = client[db_name].users.find_one(
    {"user_id": user_id},
    {
        "_id": 0,
        "user_id": 1,
        "name": 1,
        "failed_pin_attempts": 1,
        "pin_lockout_until": 1,
        "is_active": 1,
    },
)
print(json.dumps(doc or {"ok": False, "error": "user_not_found", "user_id": user_id}, ensure_ascii=False))
'@

    Set-Content -Path $tmpPy -Value $pyCode -Encoding UTF8

    try {
      docker cp $tmpPy "$BackendContainer`:/tmp/_tmp_lockout_check.py" | Out-Null
      $cmd = "docker exec -e MONGO_URL=mongodb://mongodb:27017 -e DB_NAME=$dbName -e TARGET_USER_ID=$resolvedUserId $BackendContainer python /tmp/_tmp_lockout_check.py"
      $lockoutRaw = Invoke-Expression $cmd
      $lockoutObj = $lockoutRaw | ConvertFrom-Json

      if ($lockoutObj.error) {
        throw "No se encontró el usuario en DB para lockout check"
      }

      $attempts = [int]($lockoutObj.failed_pin_attempts | ForEach-Object { if ($_ -eq $null) { 0 } else { $_ } })
      $until = $lockoutObj.pin_lockout_until
      if ($null -eq $until -or "$until" -eq "") {
        $until = "null"
      }

      Write-Ok ("Lockout status => failed_pin_attempts={0}, pin_lockout_until={1}" -f $attempts, $until)
      Add-CheckResult -Name "lockout_status" -Passed $true -Detail "Lockout consultado" -Extra @{ failed_pin_attempts = $attempts; pin_lockout_until = "$until"; db_name = $dbName }
    }
    finally {
      Remove-Item $tmpPy -ErrorAction SilentlyContinue
      try {
        docker exec $BackendContainer rm -f /tmp/_tmp_lockout_check.py | Out-Null
      }
      catch {
      }
    }
  }
  catch {
    Write-Fail "No se pudo verificar lockout: $($_.Exception.Message)"
    Add-CheckResult -Name "lockout_status" -Passed $false -Detail "Error verificando lockout" -Extra @{ error = "$($_.Exception.Message)" }
    throw
  }

  $summary.overall_passed = $true
  Write-Host "`nAutoverificación diaria: PASS" -ForegroundColor Green
}
catch {
  $summary.overall_passed = $false
  Write-Host "`nAutoverificación diaria: FAIL" -ForegroundColor Red
  Write-Host $_.Exception.Message -ForegroundColor Red
}
finally {
  $finishedAt = [DateTimeOffset]::Now
  $summary.finished_at = $finishedAt.ToString("o")
  $summary.duration_seconds = [math]::Round(($finishedAt - $startedAt).TotalSeconds, 2)
  $summary.checks = @($script:checkResults)

  $outputFull = Resolve-AbsolutePath -PathValue $OutputFile
  $outputDir = [System.IO.Path]::GetDirectoryName($outputFull)
  if ($outputDir -and -not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
  }

  $historyFull = Resolve-AbsolutePath -PathValue $HistoryDir
  if (-not (Test-Path $historyFull)) {
    New-Item -ItemType Directory -Path $historyFull -Force | Out-Null
  }

  $stamp = (Get-Date).ToString("yyyyMMdd_HHmmss")
  $historyFile = Join-Path $historyFull ("login_healthcheck_{0}.json" -f $stamp)

  $json = $summary | ConvertTo-Json -Depth 8
  Set-Content -Path $outputFull -Value $json -Encoding UTF8
  Set-Content -Path $historyFile -Value $json -Encoding UTF8

  Write-Host "Reporte: $outputFull" -ForegroundColor Yellow
  Write-Host "Histórico: $historyFile" -ForegroundColor Yellow
}

if (-not $summary.overall_passed) {
  exit 1
}

exit 0
