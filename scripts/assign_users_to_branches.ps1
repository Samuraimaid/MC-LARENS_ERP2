param(
  [Parameter(Mandatory = $true)]
  [string]$CsvPath,
  [string]$ApiBase = "http://127.0.0.1:8001/api",
  [Parameter(Mandatory = $true)]
  [string]$SessionCookie,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $CsvPath)) {
  throw "No existe el archivo CSV: $CsvPath"
}

$rows = Import-Csv -Path $CsvPath
if (-not $rows -or $rows.Count -eq 0) {
  throw "CSV vacío: $CsvPath"
}

$headers = @{ "Cookie" = "session_id=$SessionCookie" }

foreach ($row in $rows) {
  $userId = "$($row.user_id)".Trim()
  if (-not $userId) {
    Write-Warning "Fila omitida: user_id vacío"
    continue
  }

  $payload = @{
    role = "$($row.role)".Trim().ToLower()
    branch_id = if ("$($row.branch_id)".Trim()) { "$($row.branch_id)".Trim() } else { $null }
    warehouse_id = if ("$($row.warehouse_id)".Trim()) { "$($row.warehouse_id)".Trim() } else { $null }
  }

  if ($DryRun) {
    Write-Host "[DryRun] PUT $ApiBase/users/$userId/role -> $($payload | ConvertTo-Json -Compress)" -ForegroundColor Yellow
    continue
  }

  try {
    $null = Invoke-RestMethod -Method Put -Uri "$ApiBase/users/$userId/role" -Headers $headers -ContentType "application/json" -Body ($payload | ConvertTo-Json)
    Write-Host "OK user_id=$userId role=$($payload.role) branch=$($payload.branch_id) warehouse=$($payload.warehouse_id)" -ForegroundColor Green
  }
  catch {
    Write-Host "ERROR user_id=$userId -> $($_.Exception.Message)" -ForegroundColor Red
  }
}
