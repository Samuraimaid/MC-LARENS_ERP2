$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$lanIp = & (Join-Path $PSScriptRoot 'detect-lan-ip.ps1')
$certIps = "127.0.0.1,$lanIp"

Write-Host "Regenerando HTTPS con IP local: $lanIp"

Push-Location $root
try {
  $env:HTTPS_CERT_IPS = $certIps
  $env:HTTPS_CERT_DNS = "localhost"
  docker compose up -d --build frontend
} finally {
  Pop-Location
}