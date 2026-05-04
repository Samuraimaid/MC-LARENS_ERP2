param(
  [string]$FrontendHost = "http://localhost:3000",
  [string]$BackendHost = "http://localhost:8001",
  [string]$Pin = "010190"
)

Write-Host "1) Prueba: host -> frontend (nginx proxy)"
$body = @{ pin = $Pin } | ConvertTo-Json
try {
  $r = Invoke-RestMethod -Uri "$FrontendHost/api/auth/pin/login" -Method POST -ContentType "application/json" -Body $body -TimeoutSec 30
  Write-Host "Respuesta (frontend proxy):"
  $r | ConvertTo-Json -Depth 5
} catch {
  Write-Host "ERROR host->frontend:`n" $_.Exception.Message
}

Write-Host "`n2) Prueba: host -> backend directo"
try {
  $r2 = Invoke-RestMethod -Uri "$BackendHost/api/auth/pin/login" -Method POST -ContentType "application/json" -Body $body -TimeoutSec 30
  Write-Host "Respuesta (backend directo):"
  $r2 | ConvertTo-Json -Depth 5
} catch {
  Write-Host "ERROR host->backend:`n" $_.Exception.Message
}

Write-Host "`n3) Prueba: desde dentro del contenedor frontend (wget)"
# crear temp file con el body
$temp = Join-Path $env:TEMP 'mc_larens_body.json'
Set-Content -Path $temp -Value $body -Encoding UTF8

# copiar al contenedor y usar wget para POST
docker cp $temp mundo-frontend:/tmp/body.json | Out-Null
$dockerCmd = 'wget --header="Content-Type: application/json" --post-file=/tmp/body.json -O - http://127.0.0.1/api/auth/pin/login'
Write-Host "Ejecutando en container: $dockerCmd"
# Ejecutar via sh -c para que wget interprete bien los parámetros
docker exec mundo-frontend sh -c $dockerCmd

Write-Host "`nFin de las pruebas."
