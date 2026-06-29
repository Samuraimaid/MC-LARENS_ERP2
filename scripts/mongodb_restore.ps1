param(
  [string]$ArchivePath,
  [switch]$UseLatest,
  [switch]$Force,
  [string]$MongoContainer = "mclarens2-mongodb",
  [string]$BackendContainer = "mundo-backend",
  [string]$BackupDir = "backups/mongodb"
)

$ErrorActionPreference = "Stop"

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

$repoRoot = Resolve-AbsolutePath (Join-Path $PSScriptRoot "..")
Push-Location $repoRoot

try {
  $running = docker ps --format "{{.Names}}"
  if (-not ($running -contains $MongoContainer)) {
    throw "El contenedor '$MongoContainer' no está corriendo."
  }

  $resolvedArchive = $null
  if ($UseLatest.IsPresent) {
    $backupRoot = Resolve-AbsolutePath $BackupDir
    $latest = Get-ChildItem -Path $backupRoot -Filter "mongodb_*.archive.gz" -File |
      Sort-Object LastWriteTime -Descending |
      Select-Object -First 1
    if (-not $latest) {
      throw "No hay respaldos en $backupRoot"
    }
    $resolvedArchive = $latest.FullName
  }
  else {
    if (-not $ArchivePath) {
      throw "Indica -ArchivePath o -UseLatest."
    }
    $resolvedArchive = Resolve-AbsolutePath $ArchivePath
  }

  if (-not (Test-Path $resolvedArchive)) {
    throw "No existe el archivo: $resolvedArchive"
  }

  $bytes = (Get-Item $resolvedArchive).Length
  if ($bytes -lt 512) {
    throw "Archivo de respaldo inválido ($bytes bytes)."
  }

  $dbName = Get-ContainerEnvValue -ContainerName $BackendContainer -Key "DB_NAME" -DefaultValue "mc-larens2_mundo_accesorios_erp"

  Write-Host "Restaurar '$dbName' desde:" -ForegroundColor Yellow
  Write-Host "  $resolvedArchive ($bytes bytes)" -ForegroundColor Yellow
  Write-Host "ADVERTENCIA: esto reemplazará la base actual (--drop)." -ForegroundColor Red

  if (-not $Force.IsPresent) {
    $confirm = Read-Host "Escribe RESTAURAR para continuar"
    if ($confirm -ne "RESTAURAR") {
      Write-Host "Cancelado." -ForegroundColor Yellow
      exit 0
    }
  }

  $containerArchive = "/tmp/restore.archive.gz"
  docker cp $resolvedArchive "${MongoContainer}:${containerArchive}"

  $restoreCmd = "mongorestore --archive=$containerArchive --gzip --drop --nsInclude=${dbName}.*"
  docker exec $MongoContainer sh -c $restoreCmd
  if ($LASTEXITCODE -ne 0) {
    throw "mongorestore falló con código $LASTEXITCODE"
  }

  docker exec $MongoContainer rm -f $containerArchive | Out-Null

  Write-Host "[OK] Restauración completada para $dbName" -ForegroundColor Green
}
finally {
  Pop-Location
}