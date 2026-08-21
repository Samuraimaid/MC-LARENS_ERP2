Add-Type -AssemblyName System.Drawing

$srcDir = "C:\Users\Xinon\.gemini\antigravity-ide\brain\972af972-50af-44f8-852b-45ccfb6a178b\.user_uploaded"
$dstDir = "c:\ANTIGRAVITY\MC-LARENS_ERP2\frontend\public\vehicles"

if (!(Test-Path $dstDir)) {
    New-Item -ItemType Directory -Path $dstDir -Force
}

$mapping = @{
    "sedan.png" = "media_1787009700670.jpg"
    "suv.png" = "media_1787009700651.jpg"
    "station_wagon.png" = "media_1787009700612.jpg"
    "microbus_pasajeros.png" = "media_1787009700553.jpg"
    "microbus_carga.png" = "media_1787009700529.jpg"
}

foreach ($destName in $mapping.Keys) {
    $srcFile = Join-Path $srcDir $mapping[$destName]
    $img = [System.Drawing.Bitmap]::FromFile($srcFile)
    
    # Save full image
    $fullDst = Join-Path $dstDir $destName
    $img.Save($fullDst, [System.Drawing.Imaging.ImageFormat]::Png)
    
    # Save clean cropped version (without bottom text label)
    # The vehicle is in bounds y=20 to y=920
    $cropHeight = 930
    $cropRect = New-Object System.Drawing.Rectangle(0, 0, $img.Width, $cropHeight)
    $cropped = $img.Clone($cropRect, $img.PixelFormat)
    $cleanDst = Join-Path $dstDir ("clean_" + $destName)
    $cropped.Save($cleanDst, [System.Drawing.Imaging.ImageFormat]::Png)
    $cropped.Dispose()
    
    $img.Dispose()
    Write-Host "Processed $destName (clean_$destName saved)"
}
