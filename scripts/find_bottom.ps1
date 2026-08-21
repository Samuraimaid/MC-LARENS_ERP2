Add-Type -AssemblyName System.Drawing

$rawPath = "c:\ANTIGRAVITY\MC-LARENS_ERP2\backend\data\blueprints_raw\toyota\TOYOTA (1).png"
$img = [System.Drawing.Bitmap]::FromFile($rawPath)

Write-Host "Image size: $($img.Width) x $($img.Height)"

for ($y = $img.Height - 1; $y -ge 0; $y--) {
    $hasNonWhite = $false
    for ($x = 0; $x -lt $img.Width; $x++) {
        $c = $img.GetPixel($x, $y)
        if ($c.R -lt 250 -or $c.G -lt 250 -or $c.B -lt 250) {
            $hasNonWhite = $true
            break
        }
    }
    if ($hasNonWhite) {
        Write-Host "Bottom-most non-white pixel is at Y = $y (Height: $($img.Height))"
        break
    }
}

$img.Dispose()
