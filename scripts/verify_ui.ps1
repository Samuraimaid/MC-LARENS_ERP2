Param(
    [string]$BaseUrl = 'http://localhost:3000',
    [string]$Token = 'LE","CH'
)

Write-Output "Verificando base: $BaseUrl"
try {
    $index = Invoke-WebRequest $BaseUrl -UseBasicParsing -ErrorAction Stop
} catch {
    Write-Output "ERROR: No se pudo descargar $BaseUrl : $_"
    exit 2
}

$regex = '/static/js/main\.[^"\s]*\.js'
$match = [regex]::Match($index.Content, $regex)
if (-not $match.Success) {
    Write-Output "No se encontró script main.* en index.html"
    exit 3
}

$bundlePath = $match.Value
$bundleUrl = $BaseUrl.TrimEnd('/') + $bundlePath
Write-Output "Bundle URL: $bundleUrl"

$out = Join-Path $env:TEMP 'frontend_main_bundle.js'
try {
    Invoke-WebRequest $bundleUrl -OutFile $out -UseBasicParsing -ErrorAction Stop
} catch {
    Write-Output "ERROR: No se pudo descargar bundle: $_"
    exit 4
}

$found = Select-String -Path $out -Pattern $Token -SimpleMatch -Quiet
if ($found) {
    Write-Output "Token encontrado en el bundle."
    exit 0
} else {
    Write-Output "Token NO encontrado en el bundle."
    exit 5
}
