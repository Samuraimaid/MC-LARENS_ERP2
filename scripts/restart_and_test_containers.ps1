# Restart and test Docker containers for Mc-Larens ERP
# Usage: open PowerShell in the repo root and run:
#   powershell -ExecutionPolicy Bypass -File .\scripts\restart_and_test_containers.ps1

param(
    [string]$HostIp = '127.0.0.1',
    [int]$FrontendPort = 3000,
    [int]$BackendPort = 8001,
    [int]$LegacyBackendPort = 8002,
    [string]$Pin = '010190'
)

$ErrorActionPreference = 'Stop'

Write-Host "=== Saving last 200 log lines for core containers ==="
$containers = @('mundo-backend','mundo-frontend','mundo-mongodb')
foreach ($name in $containers) {
    $id = docker ps -q --filter "name=$name"
    if ($id) {
        $logDir = Split-Path -Path $PSScriptRoot -Parent
        $logFile = Join-Path -Path $logDir -ChildPath ("{0}.logs.txt" -f $name)
        Write-Host ("Saving logs for {0} -> {1}" -f $name, $logFile)
        try {
            # Capture both stdout and stderr from docker logs without letting a non-zero exit stop the script
            $logOutput = & docker logs --tail 200 $id 2>&1
            if ($logOutput) {
                $logOutput | Out-File -FilePath $logFile -Encoding utf8
            } else {
                Write-Host ("No logs returned for {0}" -f $name)
            }
        } catch {
            Write-Host ("Failed to save logs for {0}: {1}" -f $name, $_.Exception.Message)
            if ($logOutput) { $logOutput | Out-File -FilePath $logFile -Encoding utf8 }
        }
    } else {
        Write-Host ("Container {0} not found; skipping logs" -f $name)
    }
}

Write-Host "`n=== Stopping containers (if running) ==="
foreach ($name in $containers) {
    try {
        docker stop $name | Out-Null
        Write-Host ("{0} stopped" -f $name)
    } catch {
        Write-Host ("{0}: not running or could not stop" -f $name)
    }
}

Start-Sleep -Seconds 2

Write-Host "`n=== Starting containers ==="
foreach ($name in $containers) {
    try {
        docker start $name | Out-Null
        Write-Host ("{0} started" -f $name)
    } catch {
        Write-Host ("Failed to start {0}" -f $name)
    }
}

Start-Sleep -Seconds 3

Write-Host "`n=== Current containers ==="
# Use single quotes for the format string to avoid PowerShell parsing braces
docker ps --format 'table {{.ID}}\t{{.Names}}\t{{.Status}}\t{{.Ports}}'

# Test PIN login via frontend proxy first, then backend direct.
$frontendUrl = "http://${HostIp}:${FrontendPort}/api/auth/pin/login"
$backendUrl = "http://${HostIp}:${BackendPort}/api/auth/pin/login"
$legacyBackendUrl = "http://${HostIp}:${LegacyBackendPort}/api/auth/pin/login"
$origin = "http://${HostIp}:${FrontendPort}"
$pinBody = "{\"pin\":\"${Pin}\"}"

# Prefer curl.exe if available; call via Start-Process to avoid PowerShell parsing issues
if (Get-Command curl.exe -ErrorAction SilentlyContinue) {
    Write-Host "`n=== Using curl.exe to POST to frontend proxy (3000) ==="
    $curlArgs = @('-i','-X','POST','-H','Content-Type: application/json','-H',"Origin: $origin",'--cookie-jar','cookies.txt','--data',$pinBody,$frontendUrl)
    # Call curl.exe directly and capture both stdout and stderr into a single file.
    # Temporarily relax error action to avoid native command output raising a terminating error.
    $prevEAP = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $curlOutput = & 'curl.exe' @curlArgs 2>&1
        if ($curlOutput) { $curlOutput | Out-File -FilePath 'frontend_login_response.txt' -Encoding utf8 }
        else { Write-Host "curl produced no output for frontend" }
    } catch {
        Write-Host "curl frontend invocation failed: $($_.Exception.Message)"
        if ($curlOutput) { $curlOutput | Out-File -FilePath 'frontend_login_response.txt' -Encoding utf8 }
    } finally {
        $ErrorActionPreference = $prevEAP
    }
    Get-Content frontend_login_response.txt | Select-Object -First 200 | ForEach-Object { Write-Host $_ }

    # If response looks unauthorized or no Set-Cookie, try backend directly
    $frontendText = Get-Content frontend_login_response.txt -Raw -ErrorAction SilentlyContinue
    if (-not ($frontendText -and ($frontendText -match 'Set-Cookie'))) {
        Write-Host ("No Set-Cookie in frontend response - trying backend directo ({0})" -f $BackendPort)
        $curlArgs2 = @('-i','-X','POST','-H','Content-Type: application/json','-H',"Origin: $origin",'--cookie-jar','cookies_backend.txt','--data',$pinBody,$backendUrl)
        $prevEAP = $ErrorActionPreference
        $ErrorActionPreference = 'Continue'
        try {
            $curlOutput2 = & 'curl.exe' @curlArgs2 2>&1
            if ($curlOutput2) { $curlOutput2 | Out-File -FilePath 'backend_login_response.txt' -Encoding utf8 }
            else { Write-Host "curl produced no output for backend" }
        } catch {
            Write-Host "curl backend invocation failed: $($_.Exception.Message)"
            if ($curlOutput2) { $curlOutput2 | Out-File -FilePath 'backend_login_response.txt' -Encoding utf8 }
        } finally {
            $ErrorActionPreference = $prevEAP
        }
        Get-Content backend_login_response.txt | Select-Object -First 200 | ForEach-Object { Write-Host $_ }

        $backendText = Get-Content backend_login_response.txt -Raw -ErrorAction SilentlyContinue
        if (-not ($backendText -and ($backendText -match 'Set-Cookie'))) {
            Write-Host ("Sin Set-Cookie en backend {0}; probando puerto legacy {1}" -f $BackendPort, $LegacyBackendPort)
            $curlArgs3 = @('-i','-X','POST','-H','Content-Type: application/json','-H',"Origin: $origin",'--cookie-jar','cookies_backend_legacy.txt','--data',$pinBody,$legacyBackendUrl)
            $prevEAP = $ErrorActionPreference
            $ErrorActionPreference = 'Continue'
            try {
                $curlOutput3 = & 'curl.exe' @curlArgs3 2>&1
                if ($curlOutput3) { $curlOutput3 | Out-File -FilePath 'backend_login_response_legacy.txt' -Encoding utf8 }
            } catch {
                Write-Host "curl legacy backend invocation failed: $($_.Exception.Message)"
            } finally {
                $ErrorActionPreference = $prevEAP
            }
        }
    }

    # If backend returned JSON decode error or 422, try PowerShell POST (proper JSON) which preserves cookies
    if ($frontendText -and ($frontendText -match 'JSON decode error|422 Unprocessable Entity')) {
        Write-Host "Frontend returned JSON error; retrying with Invoke-RestMethod to ensure valid JSON body and capture cookies"
        try {
            $headers = @{ Origin = $origin }
            $session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
            $bodyObj = @{ pin = $Pin }
            [void](Invoke-RestMethod -Uri $frontendUrl -Method Post -Headers $headers -ContentType 'application/json' -Body ($bodyObj | ConvertTo-Json -Depth 5) -WebSession $session -ErrorAction Stop)
            Write-Host "Invoke-RestMethod frontend: OK"
            $session.Cookies | ForEach-Object { Write-Host ("Cookie: {0} = {1} (Domain={2})" -f $_.Name,$_.Value,$_.Domain) }
            # Save cookies to a simple file for inspection
            $session.Cookies | ForEach-Object { "{0}`t{1}`t{2}" -f $_.Name,$_.Value,$_.Domain } | Out-File -FilePath 'cookies_invoke_frontend.txt' -Encoding utf8
        } catch {
            Write-Host "Invoke-RestMethod frontend attempt failed: $($_.Exception.Message)"
        }
    }

    Write-Host "`nSaved cookie files: cookies.txt (frontend) cookies_backend.txt (backend)"
} else {
    Write-Host "curl.exe not found. Using PowerShell Invoke-RestMethod fallback (no cookiejar)."
    $headers = @{ Origin = $origin }
    $json = $pinBody | ConvertFrom-Json
    try {
        $session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
        [void](Invoke-RestMethod -Uri $frontendUrl -Method Post -Headers $headers -ContentType 'application/json' -Body ($json | ConvertTo-Json -Depth 5) -WebSession $session)
        Write-Host "Status: OK (frontend)"
        $session.Cookies | ForEach-Object { Write-Host ("Cookie: {0} = {1} (Domain={2}" -f $_.Name,$_.Value,$_.Domain) }
    } catch {
        Write-Host "Frontend request failed, trying backend directly"
        try {
            $session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
            [void](Invoke-RestMethod -Uri $backendUrl -Method Post -Headers $headers -ContentType 'application/json' -Body ($json | ConvertTo-Json -Depth 5) -WebSession $session)
            Write-Host "Status: OK (backend)"
            $session.Cookies | ForEach-Object { Write-Host ("Cookie: {0} = {1} (Domain={2}" -f $_.Name,$_.Value,$_.Domain) }
        } catch {
            Write-Host "Both requests failed: $($_.Exception.Message)"
        }
    }
}

Write-Host "`n=== If login failed, check the saved logs: backend.logs.txt frontend.logs.txt mongodb.logs.txt ==="
Write-Host "Script finished."
