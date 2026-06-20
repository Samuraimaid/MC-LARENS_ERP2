param(
    [switch]$InstallSystemTools,
    [switch]$SkipDocker,
    [switch]$SkipBackend,
    [switch]$SkipFrontend,
    [string]$PythonExe = "python",
    [switch]$UseNpmInstall
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path

function Write-Step {
    param([string]$Message)
    Write-Host "`n=== $Message ===" -ForegroundColor Cyan
}

function Test-Command {
    param([string]$Name)
    return ($null -ne (Get-Command $Name -ErrorAction SilentlyContinue))
}

function Install-Choco-Package {
    param([string]$PackageName)
    if (-not (Test-Command "choco")) {
        Write-Host "Instalando Chocolatey..." -ForegroundColor Yellow
        Set-ExecutionPolicy Bypass -Scope Process -Force
        [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
        Invoke-Expression ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
    }
    choco install $PackageName -y
}

if ($InstallSystemTools) {
    Write-Step "Instalando herramientas base del sistema"

    if (-not (Test-Command "git")) { Install-Choco-Package "git" }
    if (-not (Test-Command "node")) { Install-Choco-Package "nodejs-lts" }
    if (-not (Test-Command "python")) { Install-Choco-Package "python311" }

    if (-not $SkipDocker) {
        if (-not (Test-Command "docker")) {
            Install-Choco-Package "docker-desktop"
        }
    }
}

Set-Location $repoRoot

if (-not $SkipBackend) {
    Write-Step "Preparando backend"
    $venvPath = Join-Path $repoRoot ".venv"
    if (-not (Test-Path $venvPath)) {
        & $PythonExe -m venv $venvPath
    }

    & (Join-Path $venvPath "Scripts\python.exe") -m pip install --upgrade pip
    & (Join-Path $venvPath "Scripts\python.exe") -m pip install -r (Join-Path $repoRoot "backend\requirements.txt")

    if (Test-Path (Join-Path $repoRoot "backend\requirements\dev.txt")) {
        & (Join-Path $venvPath "Scripts\python.exe") -m pip install -r (Join-Path $repoRoot "backend\requirements\dev.txt")
    }
}

if (-not $SkipFrontend) {
    Write-Step "Preparando frontend"
    Push-Location (Join-Path $repoRoot "frontend")
    try {
        if ($UseNpmInstall) {
            npm install
        }
        else {
            npm ci
        }

        if (Test-Path (Join-Path $repoRoot "frontend\playwright.config.js")) {
            npx playwright install --with-deps chromium
        }
    }
    finally {
        Pop-Location
    }
}

if (-not $SkipDocker) {
    Write-Step "Verificando Docker"
    if (Test-Command "docker") {
        docker version
    }
    else {
        Write-Host "Docker no disponible en PATH. Instala Docker Desktop o ejecuta con -SkipDocker" -ForegroundColor Yellow
    }
}

Write-Step "Bootstrap completado"
Write-Host "Repositorio listo para continuar trabajo en nuevo equipo." -ForegroundColor Green
