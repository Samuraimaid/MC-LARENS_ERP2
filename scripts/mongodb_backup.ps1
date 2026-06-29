param(
  [string]$MongoContainer = "mclarens2-mongodb",
  [string]$BackendContainer = "mundo-backend",
  [string]$BackupDir = "backups/mongodb",
  [int]$RetentionDays = 14,
  [string]$OutputFile = "test_reports/mongodb_backup_latest.json"
)

$ErrorActionPreference = "Stop"

function Write-Step {
  param([string]$Message)
  Write-Host "[BACKUP] $Message" -ForegroundColor Cyan
}

function Resolve-AbsolutePath {
  param([string]$PathValue)
  if ([System.IO.Path]::IsPathRooted($PathValue)) {
    return $PathValue
  }
  return [System.IO.Path]::GetFullPath((Join-Path (Get-Location) $PathValue))
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

$repoRoot = Resolve-AbsolutePath "."
if ($PSScriptRoot) {
  $repoRoot = Resolve-AbsolutePath (Join-Path $PSScriptRoot "..")
}

Push-Location $repoRoot
$startedAt = [DateTimeOffset]::Now
$stamp = (Get-Date).ToString("yyyyMMdd_HHmmss")
$summary = [ordered]@{
  started_at = $startedAt.ToString("o")
  finished_at = $null
  duration_seconds = $null
  overall_passed = $false
  mongo_container = $MongoContainer
  backend_container = $BackendContainer
  backup_file = $null
  backup_bytes = 0
  db_name = $null
  retention_days = $RetentionDays
  pruned_files = @()
  error = $null
}

try {
  Write-Step "Verificando contenedor MongoDB"
  $running = docker ps --format "{{.Names}}"
  if (-not ($running -contains $MongoContainer)) {
    throw "El contenedor '$MongoContainer' no está corriendo."
  }

  $dbName = Get-ContainerEnvValue -ContainerName $BackendContainer -Key "DB_NAME" -DefaultValue "mc-larens2_mundo_accesorios_erp"
  $summary.db_name = $dbName

  $backupRoot = Resolve-AbsolutePath $BackupDir
  if (-not (Test-Path $backupRoot)) {
    New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
  }

  $archiveName = "mongodb_{0}_{1}.archive.gz" -f $dbName, $stamp
  $archivePath = Join-Path $backupRoot $archiveName
  $summary.backup_file = $archivePath

  Write-Step "Ejecutando mongodump ($dbName)"
  $containerArchive = "/tmp/mongodb_backup.archive.gz"
  docker exec $MongoContainer mongodump --db=$dbName --archive=$containerArchive --gzip
  if ($LASTEXITCODE -ne 0) {
    throw "mongodump falló con código $LASTEXITCODE"
  }
  docker cp "${MongoContainer}:${containerArchive}" $archivePath
  if ($LASTEXITCODE -ne 0) {
    throw "docker cp del respaldo falló"
  }
  docker exec $MongoContainer rm -f $containerArchive | Out-Null

  if (-not (Test-Path $archivePath)) {
    throw "No se generó el archivo de respaldo."
  }

  $bytes = (Get-Item $archivePath).Length
  $summary.backup_bytes = $bytes
  if ($bytes -lt 512) {
    throw "El respaldo es demasiado pequeño ($bytes bytes). Posible corrupción."
  }

  Write-Step "Verificando integridad del archivo"
  $header = Get-Content -Path $archivePath -Encoding Byte -TotalCount 2
  if ($header[0] -ne 0x1F -or $header[1] -ne 0x8B) {
    throw "El archivo no parece ser gzip válido."
  }

  $manifestPath = Join-Path $backupRoot ("manifest_{0}.json" -f $stamp)
  $manifest = [ordered]@{
    created_at = $startedAt.ToString("o")
    db_name = $dbName
    archive = $archiveName
    bytes = $bytes
    mongo_container = $MongoContainer
    verified = $true
  }
  $manifest | ConvertTo-Json -Depth 4 | Set-Content -Path $manifestPath -Encoding UTF8

  Write-Step "Aplicando retención ($RetentionDays días)"
  $cutoff = (Get-Date).AddDays(-1 * $RetentionDays)
  $pruned = @()
  Get-ChildItem -Path $backupRoot -Filter "mongodb_*.archive.gz" -File | ForEach-Object {
    if ($_.LastWriteTime -lt $cutoff) {
      Remove-Item $_.FullName -Force
      $pruned += $_.Name
    }
  }
  $summary.pruned_files = $pruned

  $summary.overall_passed = $true
  Write-Host "[OK] Respaldo MongoDB: $archivePath ($bytes bytes)" -ForegroundColor Green
}
catch {
  $summary.overall_passed = $false
  $summary.error = $_.Exception.Message
  Write-Host "[FAIL] $($_.Exception.Message)" -ForegroundColor Red
}
finally {
  $finishedAt = [DateTimeOffset]::Now
  $summary.finished_at = $finishedAt.ToString("o")
  $summary.duration_seconds = [math]::Round(($finishedAt - $startedAt).TotalSeconds, 2)

  $outputFull = Resolve-AbsolutePath $OutputFile
  $outputDir = [System.IO.Path]::GetDirectoryName($outputFull)
  if ($outputDir -and -not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
  }
  $summary | ConvertTo-Json -Depth 6 | Set-Content -Path $outputFull -Encoding UTF8
  Write-Host "Reporte: $outputFull" -ForegroundColor Yellow
  Pop-Location
}

if (-not $summary.overall_passed) {
  exit 1
}
exit 0