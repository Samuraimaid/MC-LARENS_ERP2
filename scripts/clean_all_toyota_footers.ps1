Add-Type -AssemblyName System.Drawing

$sourceDir = "c:\ANTIGRAVITY\MC-LARENS_ERP2\backend\data\blueprints_raw\toyota"
$cleanDir = "c:\ANTIGRAVITY\MC-LARENS_ERP2\backend\data\blueprints_cleaned\toyota"

if (-not (Test-Path $cleanDir)) {
    New-Item -ItemType Directory -Path $cleanDir -Force | Out-Null
}

$files = Get-ChildItem -Path $sourceDir -Filter "*.png"
Write-Host "Iniciando limpieza de pie de página para $($files.Count) imágenes..."

$processed = 0
foreach ($file in $files) {
    try {
        $img = [System.Drawing.Bitmap]::FromFile($file.FullName)
        
        # Detect exact bottom banner height: find the horizontal line above footer (around 25-32 px from bottom)
        $bannerHeight = 30
        for ($y = $img.Height - 15; $y -ge [Math]::Max(0, $img.Height - 40); $y--) {
            $darkCount = 0
            for ($x = 10; $x -lt $img.Width - 10; $x += 10) {
                $c = $img.GetPixel($x, $y)
                if ($c.R -lt 200 -and $c.G -lt 200 -and $c.B -lt 200) {
                    $darkCount++
                }
            }
            if ($darkCount -gt 25) {
                # Line divider found
                $bannerHeight = $img.Height - $y + 1
                break
            }
        }

        $newHeight = [Math]::Max(50, $img.Height - $bannerHeight)
        $rect = New-Object System.Drawing.Rectangle(0, 0, $img.Width, $newHeight)
        $cropped = $img.Clone($rect, $img.PixelFormat)

        $destPath = Join-Path $cleanDir $file.Name
        $cropped.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)

        $cropped.Dispose()
        $img.Dispose()
        $processed++
    } catch {
        Write-Warning "Error procesando $($file.Name): $_"
    }
}

Write-Host "Listo! Se limpiaron y guardaron $($processed) imágenes sin pie de página en $cleanDir"
