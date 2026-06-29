# Inicia el puente de impresión POS 80mm para vouchers de venta.
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$python = Join-Path $root "venv\Scripts\python.exe"
if (-not (Test-Path $python)) {
  $python = "python"
}
$env:POS_BRIDGE_HOST = "0.0.0.0"
$env:POS_BRIDGE_PORT = "9266"
if (-not $env:POS_VOUCHER_PRINTER_NAME) {
  $env:POS_VOUCHER_PRINTER_NAME = "POS-80 Voucher"
}
& $python (Join-Path $root "scripts\pos_voucher_print_bridge.py")