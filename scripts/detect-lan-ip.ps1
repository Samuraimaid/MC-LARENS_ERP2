$ip = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
  Where-Object {
    $_.IPAddress -notlike '127.*' -and
    $_.IPAddress -notlike '169.254.*' -and
    $_.PrefixOrigin -in @('Dhcp', 'Manual')
  } |
  Sort-Object -Property InterfaceMetric |
  Select-Object -First 1 -ExpandProperty IPAddress

if (-not $ip) {
  Write-Output '127.0.0.1'
  exit 0
}

Write-Output $ip