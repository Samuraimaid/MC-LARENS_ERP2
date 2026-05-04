param(
    [string]$action = ''
)

function Write-ErrExit($msg){ Write-Host $msg -ForegroundColor Red; exit 1 }

# Configuration
$serviceName = 'backend'
$composeProject = '.'
# default version if not provided in backend/VERSION
$defaultVersion = '0.2.0-beta.0'

function Get-ContainerId(){
    $id = docker compose ps -q $serviceName 2>$null
    if (-not $id){ Write-ErrExit "No se encontró el servicio '$serviceName' (¿docker compose up?)." }
    return $id.Trim()
}

function Ensure-BackupsDir(){
    $scriptPath = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Definition }
    $dir = Join-Path -Path $scriptPath -ChildPath 'backups'
    if (-not (Test-Path $dir)){ New-Item -ItemType Directory -Path $dir | Out-Null }
    return $dir
}

function Backup-ContainerApp($cid){
    $ts = Get-Date -Format 'yyyyMMdd-HHmmss'
    $backupDir = Ensure-BackupsDir
    $remoteTar = "/tmp/backup-$ts.tar"
    Write-Host "Creando backup dentro del contenedor ($remoteTar)..."
    $tarCmd = "tar -C / -czf $remoteTar /app"
    $rc = docker exec $cid sh -c $tarCmd
    if ($LASTEXITCODE -ne 0){
        Write-Host "tar falló, usando fallback docker cp (copiando carpeta /app)" -ForegroundColor Yellow
        $fallbackDir = Join-Path $backupDir "backup-$ts-dir"
        if (Test-Path $fallbackDir){ Remove-Item -Recurse -Force $fallbackDir }
        docker cp "$($cid):/app" $fallbackDir
        return @{ type='dir'; path=$fallbackDir }
    }

    $localTar = Join-Path $backupDir "backup-$ts.tar"
    docker cp "$($cid):$remoteTar" $localTar
    docker exec $cid rm -f $remoteTar
    return @{ type='tar'; path=$localTar }
}

function Build-And-TagImage($version){
    $ts = Get-Date -Format 'yyyyMMdd-HHmmss'
    $tag = "mc-larenserp20-backend:$($version)-$ts"
    Write-Host "Construyendo imagen y etiquetando como $tag ..."
    docker build -t $tag ./backend
    if ($LASTEXITCODE -ne 0){ Write-ErrExit "Error al construir la imagen" }
    # Also tag as latest so docker compose uses it on recreate
    docker tag $tag mc-larenserp20-backend:latest
    return $tag
}

function Copy-Code-To-Container($cid){
    Write-Host "Copiando código local 'backend/' al contenedor ($cid):/app ..."
    # Use docker cp to copy contents of backend/ into /app
    docker cp ./backend/. "$($cid):/app/"
    if ($LASTEXITCODE -ne 0){ Write-ErrExit "Error copiando archivos al contenedor." }
}

function Restart-Service(){
    Write-Host "Reiniciando servicio docker compose $serviceName..."
    docker compose restart $serviceName
    if ($LASTEXITCODE -ne 0){ Write-ErrExit "Error al reiniciar el servicio." }
}

if ($action -ne 'update'){
    Write-Host "Modo interactivo: escribe 'update' para subir cambios al contenedor, o Ctrl+C para salir."
    $input = Read-Host 'Comando'
    if ($input -ne 'update'){ Write-Host 'Abortado (no se escribió "update").'; exit 0 }
}

# Begin update flow
Write-Host "Iniciando flujo de actualización (backup -> build -> copy -> restart)" -ForegroundColor Cyan

$cid = Get-ContainerId
$backupInfo = Backup-ContainerApp $cid
Write-Host "Backup creado: $($backupInfo.path)"

# Determine version
$versionFile = Join-Path -Path './backend' -ChildPath 'VERSION'
if (Test-Path $versionFile){ $version = Get-Content $versionFile -Raw; $version = $version.Trim() } else { $version = $defaultVersion }

$imageTag = Build-And-TagImage $version
Write-Host "Imagen construida: $imageTag"

Copy-Code-To-Container $cid

Restart-Service

Write-Host "Actualización completada. Backup: $($backupInfo.path). Nueva imagen: $imageTag" -ForegroundColor Green
