# MC-LARENS ERP — Alerta sonora de hardware (bocina de placa madre)
param(
    [string]$ApiBase = "http://127.0.0.1:8001/api",
    [int]$PollSeconds = 10
)

$ErrorActionPreference = "SilentlyContinue"
Add-Type -AssemblyName System.Windows.Forms

function Invoke-MotherboardBeep([int]$Count = 5) {
    for ($i = 0; $i -lt $Count; $i++) {
        [console]::Beep(1400, 450)
        Start-Sleep -Milliseconds 180
        [console]::Beep(900, 450)
        Start-Sleep -Milliseconds 220
    }
}

$lastBeepAt = [datetime]::MinValue

while ($true) {
    try {
        $alerts = Invoke-RestMethod -Uri "$ApiBase/server-appliance/alerts" -TimeoutSec 5
        if ($alerts.beep_required -eq $true) {
            $now = Get-Date
            if (($now - $lastBeepAt).TotalSeconds -ge 60) {
                Invoke-MotherboardBeep
                $lastBeepAt = $now
                Invoke-RestMethod -Method Post -Uri "$ApiBase/server-appliance/alerts/ack-beep" -TimeoutSec 5 | Out-Null
            }
        }
    }
    catch {
        # Si el backend no responde, emitir un beep corto cada 2 minutos
        $now = Get-Date
        if (($now - $lastBeepAt).TotalSeconds -ge 120) {
            [console]::Beep(600, 700)
            $lastBeepAt = $now
        }
    }
    Start-Sleep -Seconds $PollSeconds
}