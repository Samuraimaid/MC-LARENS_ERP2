param(
  [Parameter(Mandatory = $true)]
  [string]$Instruction,
  [string]$BaseUrl = "http://127.0.0.1:8001",
  [switch]$IncludeDraftCheck
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Path $PSScriptRoot -Parent

if ($Instruction -match '(?i)\bbuild\b') {
  Write-Host "Keyword 'build' detectada. Ejecutando gate obligatorio de pre-publicacion..." -ForegroundColor Cyan
  $gateScript = Join-Path $PSScriptRoot 'pre_publish_gate.ps1'

  if (-not (Test-Path $gateScript)) {
    throw "No se encontro el script obligatorio: $gateScript"
  }

  Push-Location $root
  try {
    if ($IncludeDraftCheck) {
      & $gateScript -BaseUrl $BaseUrl -IncludeDraftCheck
    }
    else {
      & $gateScript -BaseUrl $BaseUrl
    }

    if ($LASTEXITCODE -ne 0) {
      throw "El gate de pre-publicacion fallo (exit code $LASTEXITCODE)."
    }
  }
  finally {
    Pop-Location
  }
}
else {
  Write-Host "La instruccion no contiene la keyword 'build'. Gate no ejecutado." -ForegroundColor Yellow
}
