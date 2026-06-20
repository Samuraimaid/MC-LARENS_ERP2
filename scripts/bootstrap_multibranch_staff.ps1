param(
  [string]$ApiBase = "http://127.0.0.1:8001/api",
  [Parameter(Mandatory = $true)]
  [string]$SessionCookie,
  [switch]$RunSeed,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$headers = @{ "Cookie" = "session_id=$SessionCookie" }

if ($RunSeed) {
  if ($DryRun) {
    Write-Host "[DryRun] POST $ApiBase/seed" -ForegroundColor Yellow
  } else {
    $seed = Invoke-RestMethod -Method Post -Uri "$ApiBase/seed" -Headers $headers
    Write-Host "Seed ejecutado: $($seed.message)" -ForegroundColor Green
  }
}

$profiles = @(
  @{ name = "Gerente Central"; role = "gerencia"; branch_id = "branch_main"; pin = "1101"; login_pin = "11012026" },
  @{ name = "RRHH Central"; role = "recursos_humanos"; branch_id = "branch_main"; pin = "1102"; login_pin = "11022026" },
  @{ name = "Supervisor Central"; role = "supervisor"; branch_id = "branch_main"; pin = "1103"; login_pin = "11032026" },
  @{ name = "Vendedor Central"; role = "ventas"; branch_id = "branch_main"; pin = "1104"; login_pin = "11042026" },
  @{ name = "Bodega Central"; role = "bodegas"; branch_id = "branch_main"; pin = "1105"; login_pin = "11052026" },
  @{ name = "Conductor Central"; role = "transporte"; branch_id = "branch_main"; pin = "1106"; login_pin = "11062026" },
  @{ name = "Instalador Central"; role = "instalaciones"; branch_id = "branch_main"; pin = "1107"; login_pin = "11072026" },
  @{ name = "Polarizador Central"; role = "polarizador"; branch_id = "branch_main"; pin = "1108"; login_pin = "11082026" },

  @{ name = "Gerente TopCar Calvario"; role = "gerencia"; branch_id = "branch_north"; pin = "1201"; login_pin = "12012026" },
  @{ name = "RRHH TopCar Calvario"; role = "recursos_humanos"; branch_id = "branch_north"; pin = "1202"; login_pin = "12022026" },
  @{ name = "Supervisor TopCar Calvario"; role = "supervisor"; branch_id = "branch_north"; pin = "1203"; login_pin = "12032026" },
  @{ name = "Vendedor TopCar Calvario"; role = "ventas"; branch_id = "branch_north"; pin = "1204"; login_pin = "12042026" },
  @{ name = "Bodega TopCar Calvario"; role = "bodegas"; branch_id = "branch_north"; pin = "1205"; login_pin = "12052026" },
  @{ name = "Conductor TopCar Calvario"; role = "transporte"; branch_id = "branch_north"; pin = "1206"; login_pin = "12062026" },

  @{ name = "Gerente TopCar La Tigre"; role = "gerencia"; branch_id = "branch_south"; pin = "1301"; login_pin = "13012026" },
  @{ name = "RRHH TopCar La Tigre"; role = "recursos_humanos"; branch_id = "branch_south"; pin = "1302"; login_pin = "13022026" },
  @{ name = "Supervisor TopCar La Tigre"; role = "supervisor"; branch_id = "branch_south"; pin = "1303"; login_pin = "13032026" },
  @{ name = "Vendedor TopCar La Tigre"; role = "ventas"; branch_id = "branch_south"; pin = "1304"; login_pin = "13042026" },
  @{ name = "Bodega TopCar La Tigre"; role = "bodegas"; branch_id = "branch_south"; pin = "1305"; login_pin = "13052026" },
  @{ name = "Conductor TopCar La Tigre"; role = "transporte"; branch_id = "branch_south"; pin = "1306"; login_pin = "13062026" }
)

foreach ($p in $profiles) {
  if ($DryRun) {
    Write-Host "[DryRun] Crear $($p.name) role=$($p.role) branch=$($p.branch_id)" -ForegroundColor Yellow
    continue
  }

  try {
    $payload = $p | ConvertTo-Json
    $created = Invoke-RestMethod -Method Post -Uri "$ApiBase/users/pin" -Headers $headers -ContentType "application/json" -Body $payload
    Write-Host "OK creado: $($created.user_id) - $($p.name)" -ForegroundColor Green
  }
  catch {
    Write-Host "WARN $($p.name): $($_.Exception.Message)" -ForegroundColor Yellow
  }
}

Write-Host "Bootstrap finalizado." -ForegroundColor Cyan
