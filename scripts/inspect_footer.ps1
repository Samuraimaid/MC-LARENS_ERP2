Add-Type -AssemblyName System.Drawing

$rawPath = "c:\ANTIGRAVITY\MC-LARENS_ERP2\backend\data\blueprints_raw\toyota\TOYOTA (1).png"
$img = [System.Drawing.Bitmap]::FromFile($rawPath)

Write-Host "Image size: $($img.Width) x $($img.Height)"

# Inspect bottom rows
for ($y = $img.Height - 1; $y -ge $img.Height - 35; $y--) {
    $c = $img.GetPixel([int]($img.Width / 2), $y)
    $r = $c.R
    $g = $c.G
    $b = $c.B
    Write-Host "Row ${y} - R=${r} G=${g} B=${b}"
}

$img.Dispose()
