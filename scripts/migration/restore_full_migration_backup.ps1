param(
    [Parameter(Mandatory = $true)]
    [string]$PackagePath,
    [string]$RestoreRoot = "C:\Users\DELL G5\Desktop\MC-LARENS_ERP2_RESTORED",
    [switch]$SkipDocker,
    [switch]$SkipRepoRestore,
    [switch]$SkipVolumeRestore
)

$ErrorActionPreference = "Stop"

function Write-Step {
    param([string]$Message)
    Write-Host "`n=== $Message ===" -ForegroundColor Cyan
}

function New-Dir {
    param([string]$Path)
    if (-not (Test-Path $Path)) {
        New-Item -ItemType Directory -Path $Path | Out-Null
    }
}

function Resolve-PackageDir {
    param([string]$InputPath)

    if (-not (Test-Path $InputPath)) {
        throw "No existe la ruta indicada: $InputPath"
    }

    $item = Get-Item $InputPath
    if ($item.PSIsContainer) {
        return $item.FullName
    }

    $expandDir = Join-Path $env:TEMP ("mc_larens_restore_" + (Get-Date -Format "yyyyMMdd_HHmmss"))
    New-Dir $expandDir
    Expand-Archive -LiteralPath $item.FullName -DestinationPath $expandDir -Force

    $children = Get-ChildItem -Path $expandDir -Directory
    if ($children.Count -eq 1) {
        return $children[0].FullName
    }

    return $expandDir
}

$packageDir = Resolve-PackageDir -InputPath $PackagePath
Write-Host "Paquete detectado en: $packageDir" -ForegroundColor Green

$repoZip = Get-ChildItem -Path $packageDir -Filter "*_repo.zip" -File | Select-Object -First 1
$dockerImagesDir = Join-Path $packageDir "docker\images"
$dockerContainersDir = Join-Path $packageDir "docker\containers"
$dockerVolumesDir = Join-Path $packageDir "docker\volumes"

if (-not $SkipRepoRestore) {
    if (-not $repoZip) {
        throw "No se encontro el zip del repositorio dentro del paquete"
    }

    Write-Step "Restaurando repositorio"
    New-Dir $RestoreRoot
    Expand-Archive -LiteralPath $repoZip.FullName -DestinationPath $RestoreRoot -Force
    Write-Host "Repositorio restaurado en: $RestoreRoot" -ForegroundColor Green
}

if (-not $SkipDocker) {
    Write-Step "Restaurando imagenes Docker"
    if (Test-Path $dockerImagesDir) {
        $imageTars = Get-ChildItem -Path $dockerImagesDir -Filter "*.tar" -File
        foreach ($tar in $imageTars) {
            Write-Host "Cargando imagen: $($tar.Name)"
            docker load -i $tar.FullName
        }
    }

    Write-Step "Importando snapshots de contenedores"
    if (Test-Path $dockerContainersDir) {
        $containerTars = Get-ChildItem -Path $dockerContainersDir -Filter "*_filesystem.tar" -File
        foreach ($ct in $containerTars) {
            $imageName = ((Split-Path $ct.BaseName -Leaf) -replace "_filesystem$", "")
            $tag = "restored/{0}:snapshot" -f $imageName.ToLower()
            Write-Host "Importando contenedor como imagen: $tag"
            docker import $ct.FullName $tag | Out-Null
        }
    }

    if (-not $SkipVolumeRestore) {
        Write-Step "Restaurando volumenes Docker"
        if (Test-Path $dockerVolumesDir) {
            $volumeTars = Get-ChildItem -Path $dockerVolumesDir -Filter "*.tar" -File
            foreach ($vt in $volumeTars) {
                $volumeName = $vt.BaseName
                Write-Host "Restaurando volumen: $volumeName"
                docker volume create $volumeName | Out-Null
                docker run --rm -v "${volumeName}:/volume" -v "${dockerVolumesDir}:/backup" alpine sh -c "cd /volume ; tar -xf /backup/$($vt.Name)"
            }
        }
    }
}

Write-Step "Resultado"
Write-Host "Restauracion finalizada." -ForegroundColor Green
Write-Host "1) Revisa manifests y docs dentro del paquete para pasos de validacion."
Write-Host "2) Si usas docker compose, entra al repo restaurado y ejecuta: docker compose up -d --build"
