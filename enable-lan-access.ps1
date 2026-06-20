# Enable LAN access to Docker containers via PortProxy
# Run as: powershell -ExecutionPolicy Bypass -File enable-lan-access.ps1

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "MC-Larens: Enable LAN Access (PortProxy)" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Check if running as admin
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "❌ ERROR: This script must be run as Administrator!" -ForegroundColor Red
    Write-Host "`nTo run as admin:" -ForegroundColor Yellow
    Write-Host '  1. Open PowerShell as Administrator (search "PowerShell" in Start Menu)'
    Write-Host '  2. Run: powershell -ExecutionPolicy Bypass -File enable-lan-access.ps1'
    Write-Host ""
    exit 1
}

Write-Host "✓ Running as Administrator`n" -ForegroundColor Green

Write-Host "This will enable:"
Write-Host "  • Frontend: http://192.168.1.12:3000" -ForegroundColor Yellow
Write-Host "  • Backend:  http://192.168.1.12:8001`n" -ForegroundColor Yellow

Write-Host "[1/3] Adding PortProxy rule for port 3000..."
netsh interface portproxy add v4tov4 listenport=3000 listenaddress=0.0.0.0 connectport=3000 connectaddress=127.0.0.1 2>$null
if ($LASTEXITCODE -eq 0 -or $LASTEXITCODE -eq 5) {
    Write-Host "✓ Port 3000 configured`n" -ForegroundColor Green
} else {
    Write-Host "⚠ Warning configuring port 3000`n" -ForegroundColor Yellow
}

Write-Host "[2/3] Adding PortProxy rule for port 8001..."
netsh interface portproxy add v4tov4 listenport=8001 listenaddress=0.0.0.0 connectport=8001 connectaddress=127.0.0.1 2>$null
if ($LASTEXITCODE -eq 0 -or $LASTEXITCODE -eq 5) {
    Write-Host "✓ Port 8001 configured`n" -ForegroundColor Green
} else {
    Write-Host "⚠ Warning configuring port 8001`n" -ForegroundColor Yellow
}

Write-Host "[3/3] Verifying configuration...`n"
netsh interface portproxy show all

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "✓ LAN Access Enabled!" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Green

Write-Host "Now try accessing from other devices on your network:" -ForegroundColor Cyan
Write-Host "  • Frontend: http://192.168.1.12:3000" -ForegroundColor Yellow
Write-Host "  • Backend:  http://192.168.1.12:8001`n" -ForegroundColor Yellow

Write-Host "To remove these rules later, run:" -ForegroundColor Gray
Write-Host "  netsh interface portproxy delete v4tov4 listenport=3000 listenaddress=0.0.0.0" -ForegroundColor Gray
Write-Host "  netsh interface portproxy delete v4tov4 listenport=8001 listenaddress=0.0.0.0" -ForegroundColor Gray
