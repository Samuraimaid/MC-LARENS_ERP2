Add-Type -AssemblyName System.Drawing

$files = Get-ChildItem -Path "c:\ANTIGRAVITY\MC-LARENS_ERP2\backend\data\blueprints_raw\toyota" -Filter "*.png" | Select-Object -First 5

foreach ($file in $files) {
    $img = [System.Drawing.Bitmap]::FromFile($file.FullName)
    Write-Host "File: $($file.Name) - Size: $($img.Width) x $($img.Height)"
    
    # Check bottom 40 rows for colored/dark pixels
    $bannerTop = $img.Height
    for ($y = $img.Height - 1; $y -ge $img.Height - 45; $y--) {
        $darkCount = 0
        for ($x = 0; $x -lt $img.Width; $x += 5) {
            $c = $img.GetPixel($x, $y)
            if ($c.R -lt 240 -or $c.G -lt 240 -or $c.B -lt 240) {
                $darkCount++
            }
        }
        if ($darkCount -gt 5) {
            $bannerTop = $y
        }
    }
    Write-Host "  Detected banner starts around Y = $bannerTop (cuts bottom $($img.Height - $bannerTop) px)"
    $img.Dispose()
}
