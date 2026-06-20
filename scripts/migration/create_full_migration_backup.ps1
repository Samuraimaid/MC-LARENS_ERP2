param(
    [string]$OutputRoot = "C:\Users\DELL G5\Desktop",
    [string]$PackagePrefix = "MC-LARENS_ERP2_MIGRATION_PACKAGE",
    [switch]$SkipDocker,
    [switch]$SkipVolumes,
    [switch]$SkipZip,
    [switch]$SkipRepoZip
)

$ErrorActionPreference = "Stop"

function Write-Step {
    param([string]$Message)
    Write-Host "`n=== $Message ===" -ForegroundColor Cyan
}

function Assert-Command {
    param([string]$Name)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Comando requerido no encontrado: $Name"
    }
}

function New-Dir {
    param([string]$Path)
    if (-not (Test-Path $Path)) {
        New-Item -ItemType Directory -Path $Path | Out-Null
    }
}

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$repoName = Split-Path $repoRoot -Leaf

$packageDir = Join-Path $OutputRoot ("{0}_{1}" -f $PackagePrefix, $timestamp)
$repoZip = Join-Path $packageDir ("{0}_repo.zip" -f $repoName)
$repoMirrorDir = Join-Path $packageDir "repo"
$manifestDir = Join-Path $packageDir "manifests"
$dockerDir = Join-Path $packageDir "docker"
$dockerImagesDir = Join-Path $dockerDir "images"
$dockerContainersDir = Join-Path $dockerDir "containers"
$dockerVolumesDir = Join-Path $dockerDir "volumes"
$logsDir = Join-Path $packageDir "logs"
$restoreDir = Join-Path $packageDir "restore"
$docsDir = Join-Path $packageDir "docs"

Write-Step "Preparando estructura del paquete"
New-Dir $packageDir
New-Dir $manifestDir
New-Dir $dockerDir
New-Dir $dockerImagesDir
New-Dir $dockerContainersDir
New-Dir $dockerVolumesDir
New-Dir $logsDir
New-Dir $restoreDir
New-Dir $docsDir
New-Dir $repoMirrorDir

Write-Step "Capturando metadata de git"
Push-Location $repoRoot
try {
    if (Get-Command git -ErrorAction SilentlyContinue) {
        git rev-parse --abbrev-ref HEAD | Out-File -FilePath (Join-Path $manifestDir "git_branch.txt") -Encoding utf8
        git rev-parse HEAD | Out-File -FilePath (Join-Path $manifestDir "git_head.txt") -Encoding utf8
        git status --short --untracked-files=all | Out-File -FilePath (Join-Path $manifestDir "git_status_short.txt") -Encoding utf8
        git status | Out-File -FilePath (Join-Path $manifestDir "git_status_full.txt") -Encoding utf8
        git log --oneline -n 200 | Out-File -FilePath (Join-Path $manifestDir "git_log_200.txt") -Encoding utf8
        git diff | Out-File -FilePath (Join-Path $manifestDir "git_diff_worktree.patch") -Encoding utf8
    } else {
        "git no disponible" | Out-File -FilePath (Join-Path $manifestDir "git_status_full.txt") -Encoding utf8
    }
}
finally {
    Pop-Location
}

Write-Step "Empaquetando repositorio completo"
Assert-Command robocopy
robocopy $repoRoot $repoMirrorDir /MIR /R:1 /W:1 /NFL /NDL /NJH /NJS | Out-Null

if (-not $SkipRepoZip) {
    if (Test-Path $repoZip) {
        Remove-Item $repoZip -Force
    }
    Compress-Archive -LiteralPath $repoMirrorDir -DestinationPath $repoZip -CompressionLevel Optimal
}

if (-not $SkipDocker) {
    Write-Step "Respaldando estado Docker"
    Assert-Command docker

    docker version | Out-File -FilePath (Join-Path $manifestDir "docker_version.txt") -Encoding utf8
    docker info | Out-File -FilePath (Join-Path $manifestDir "docker_info.txt") -Encoding utf8
    docker ps -a --no-trunc | Out-File -FilePath (Join-Path $manifestDir "docker_ps_a.txt") -Encoding utf8
    docker images --digests --no-trunc | Out-File -FilePath (Join-Path $manifestDir "docker_images.txt") -Encoding utf8
    docker volume ls | Out-File -FilePath (Join-Path $manifestDir "docker_volumes.txt") -Encoding utf8
    docker network ls | Out-File -FilePath (Join-Path $manifestDir "docker_networks.txt") -Encoding utf8

    $imageRefs = docker images --format "{{.Repository}}:{{.Tag}}" | Where-Object { $_ -and $_ -ne "<none>:<none>" } | Sort-Object -Unique
    foreach ($imageRef in $imageRefs) {
        $safeName = ($imageRef -replace "[/:]", "__") + ".tar"
        $dest = Join-Path $dockerImagesDir $safeName
        Write-Host "Guardando imagen: $imageRef"
        docker save -o $dest $imageRef
    }

    $containers = docker ps -a --format "{{.Names}}"
    foreach ($containerName in $containers) {
        $safeContainer = ($containerName -replace "[^a-zA-Z0-9_.-]", "_")
        $inspectDest = Join-Path $dockerContainersDir ("{0}_inspect.json" -f $safeContainer)
        $logsDest = Join-Path $dockerContainersDir ("{0}_logs.txt" -f $safeContainer)
        $exportDest = Join-Path $dockerContainersDir ("{0}_filesystem.tar" -f $safeContainer)

        Write-Host "Guardando contenedor: $containerName"
        try {
            docker inspect $containerName | Out-File -FilePath $inspectDest -Encoding utf8
        }
        catch {
            "inspect failed for $containerName : $($_.Exception.Message)" | Out-File -FilePath $inspectDest -Encoding utf8
        }

        try {
            $logsText = (& docker logs $containerName *>&1 | Out-String)
            $logsText | Out-File -FilePath $logsDest -Encoding utf8
        }
        catch {
            "logs failed for $containerName : $($_.Exception.Message)" | Out-File -FilePath $logsDest -Encoding utf8
        }

        try {
            docker export -o $exportDest $containerName
        }
        catch {
            $exportError = Join-Path $dockerContainersDir ("{0}_export_error.txt" -f $safeContainer)
            "export failed for $containerName : $($_.Exception.Message)" | Out-File -FilePath $exportError -Encoding utf8
        }
    }

    if (-not $SkipVolumes) {
        Write-Step "Respaldando volúmenes Docker"
        $volumes = docker volume ls -q
        foreach ($vol in $volumes) {
            $safeVol = ($vol -replace "[^a-zA-Z0-9_.-]", "_")
            Write-Host "Guardando volumen: $vol"
            docker run --rm -v "${vol}:/volume" -v "${dockerVolumesDir}:/backup" alpine sh -c "tar -cf /backup/${safeVol}.tar -C /volume ."
        }
    }
}
else {
    "Docker omitido por parametro -SkipDocker" | Out-File -FilePath (Join-Path $manifestDir "docker_skipped.txt") -Encoding utf8
}

Write-Step "Generando inventario del paquete"
Get-ChildItem -Path $packageDir -Recurse | Select-Object FullName, Length, LastWriteTime | 
    Export-Csv -Path (Join-Path $manifestDir "package_inventory.csv") -NoTypeInformation -Encoding utf8

$summary = @()
$summary += "timestamp=$timestamp"
$summary += "repoRoot=$repoRoot"
$summary += "repoMirrorDir=$repoMirrorDir"
$summary += "repoZip=$repoZip"
$summary += "packageDir=$packageDir"
$summary += "repoZipIncluded=$([bool](-not $SkipRepoZip))"
$summary += "dockerIncluded=$([bool](-not $SkipDocker))"
$summary += "volumesIncluded=$([bool](-not $SkipVolumes))"
$summary | Out-File -FilePath (Join-Path $manifestDir "backup_summary.txt") -Encoding utf8

if (-not $SkipZip) {
    Write-Step "Comprimiendo paquete final"
    $finalZip = "{0}.zip" -f $packageDir
    if (Test-Path $finalZip) {
        Remove-Item $finalZip -Force
    }
    Compress-Archive -LiteralPath $packageDir -DestinationPath $finalZip -CompressionLevel Optimal
    "finalZip=$finalZip" | Out-File -FilePath (Join-Path $manifestDir "final_zip_path.txt") -Encoding utf8
    Write-Host "Paquete final listo: $finalZip" -ForegroundColor Green
}
else {
    Write-Host "Paquete sin compresion final (por -SkipZip): $packageDir" -ForegroundColor Yellow
}

Write-Host "Backup completo finalizado en: $packageDir" -ForegroundColor Green
