# Escanea la LAN buscando nodos ERP y detecta si existe Casa Matriz (branch_main).
param(
    [string]$NetPrefix = "192.168.1",
    [string]$SelfIp = ""
)

$matrizIp = ""
$matrizNodeId = ""
$matrizNodeType = ""
$sucursalCount = 0
$bodegaCount = 0

function Test-ErpProfile {
    param([string]$Ip)
    foreach ($port in @(8001, 3000)) {
        try {
            $uri = "http://${Ip}:${port}/api/server-appliance/profile"
            $response = Invoke-WebRequest -Uri $uri -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
            $profile = $response.Content | ConvertFrom-Json
            return [PSCustomObject]@{
                Ip       = $Ip
                Port     = $port
                NodeId   = [string]$profile.node_id
                NodeType = [string]$profile.node_type
                NodeName = [string]$profile.node_name
            }
        }
        catch {
            continue
        }
    }
    return $null
}

foreach ($hostId in 2..60) {
    $ip = "$NetPrefix.$hostId"
    if ($SelfIp -and $ip -eq $SelfIp) { continue }
    $node = Test-ErpProfile -Ip $ip
    if (-not $node) { continue }

    $isMatriz = ($node.NodeType -eq "CASA_MATRIZ") -or ($node.NodeId -eq "branch_main")
    if ($isMatriz) {
        $matrizIp = $node.Ip
        $matrizNodeId = $node.NodeId
        $matrizNodeType = $node.NodeType
        continue
    }
    if ($node.NodeType -eq "BODEGA_PURA") {
        $bodegaCount++
        continue
    }
    if ($node.NodeType -eq "SUCURSAL") {
        $sucursalCount++
    }
}

if ($matrizIp) {
    Write-Output "MATRIZ|$matrizIp|$matrizNodeId|$matrizNodeType|$sucursalCount|$bodegaCount"
}
else {
    Write-Output "NONE|0|0|0|$sucursalCount|$bodegaCount"
}