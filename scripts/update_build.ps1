<#
PowerShell helper: builds the frontend and serves it on localhost:3001
Usage: .\scripts\update_build.ps1 [-BackendUrl "http://127.0.0.1:8002"] [-Port 3001] [-NoServe]

This script will:
 - set runtime env vars used by the frontend build
 - run `npm run build` inside `frontend`
 - ensure `frontend/build/env.js` contains the runtime API base (with /api)
 - stop any existing static server on the chosen port
 - start `npx serve -s build -l <port>` in `frontend` (unless -NoServe)
 - append an entry to `scripts/build_history.json` with metadata

Note: This script assumes Node/npm is installed and `npx.cmd` is available on PATH.
#>

param(
    [string]$BackendUrl = "http://127.0.0.1:8002",
    [int]$Port = 3001,
    [switch]$NoServe
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$frontendPath = Resolve-Path (Join-Path $scriptDir '..\frontend')
Push-Location -LiteralPath $frontendPath.Path
try {
    Write-Host "Using frontend dir: $((Get-Location).Path)"

    # Set build env vars for this PowerShell session
    $buildId = (Get-Date).ToString('yyyyMMdd-HHmmss')
    $env:VITE_BACKEND_URL = $BackendUrl
    $env:VITE_APP_BUILD_ID = $buildId
    $env:VITE_APP_BUILD_TIME = (Get-Date).ToString('o')
    $env:REACT_APP_BACKEND_URL = $env:VITE_BACKEND_URL
    $env:REACT_APP_BUILD_ID = $env:VITE_APP_BUILD_ID
    $env:REACT_APP_BUILD_TIME = $env:VITE_APP_BUILD_TIME

    Write-Host "Building frontend with VITE_BACKEND_URL=$env:VITE_BACKEND_URL"

    # Run the build (use npm.cmd for Windows)
    $npmCmd = "npm.cmd"
    $buildArgs = @("run", "build")

    $proc = Start-Process -FilePath $npmCmd -ArgumentList $buildArgs -NoNewWindow -Wait -PassThru
    if ($proc.ExitCode -ne 0) {
        throw "npm build failed with exit code $($proc.ExitCode)"
    }

    # Ensure build/env.js exists and contains the full API base (with /api)
    $envFile = Join-Path -Path (Get-Location) -ChildPath "build\env.js"
    $apiBase = $BackendUrl.TrimEnd('/') + "/api"
    $envContent = "// This file is auto-generated at build time`nwindow.__API_BASE__ = '$apiBase';`nwindow.__BUILD_TIME__ = '$($env:VITE_APP_BUILD_TIME)';`nwindow.__BUILD_ID__ = '$($env:VITE_APP_BUILD_ID)';`nwindow.__BUILD_VERSION__ = '$((Get-Content package.json | ConvertFrom-Json).version)';`n"
    Set-Content -LiteralPath $envFile -Value $envContent -Encoding UTF8
    Write-Host "Wrote runtime env to $envFile"

    # Stop any process listening on the port
    $listeners = netstat -ano | findstr ":$Port"
    if ($listeners) {
        $lines = $listeners -split "`n"
        foreach ($l in $lines) {
            $parts = $l -split '\s+' | Where-Object { $_ -ne '' }
            if ($parts.Length -ge 5) {
                $targetPid = $parts[-1]
                try {
                    Write-Host "Stopping PID $targetPid listening on port $Port"
                    Stop-Process -Id $targetPid -Force -ErrorAction SilentlyContinue
                } catch {
                    Write-Warning ("Failed to stop PID {0}: {1}" -f $targetPid, $_.Exception.Message)
                }
            }
        }
    }

    if (-not $NoServe) {
        # Start serve via npx.cmd in background
        $serveCmd = "npx.cmd"
        $serveArgs = @("serve", "-s", "build", "-l", "$Port")
        Write-Host "Starting static server: $serveCmd $($serveArgs -join ' ') (working dir: $(Get-Location))"
        Start-Process -FilePath $serveCmd -ArgumentList $serveArgs -WorkingDirectory (Get-Location) -NoNewWindow -PassThru | Out-Null
    }

    # Record build history
    $historyFile = Resolve-Path "..\scripts\build_history.json" | Select-Object -ExpandProperty Path
    if (-not (Test-Path $historyFile)) {
        New-Item -Path $historyFile -ItemType File -Value "[]" | Out-Null
    }
    $entry = [PSCustomObject]@{
        id = $buildId
        time = (Get-Date).ToString('o')
        backend = $BackendUrl
        port = $Port
        served = -not $NoServe
    }
    $json = Get-Content $historyFile -Raw | ConvertFrom-Json
    if ($json -ne $null) {
        $arr = @($json)
    } else {
        $arr = @()
    }
    $arr += $entry
    $arr | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $historyFile -Encoding UTF8
    Write-Host "Recorded build $buildId to $historyFile"

    Write-Host "Update build completed. Visit http://localhost:$Port to verify."
} finally {
    Pop-Location
}
