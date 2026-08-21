Add-Type -AssemblyName System.Drawing

$srcDir = "C:\Users\Xinon\.gemini\antigravity-ide\brain\972af972-50af-44f8-852b-45ccfb6a178b\.user_uploaded"
$dstDir = "c:\ANTIGRAVITY\MC-LARENS_ERP2\frontend\public\vehicles"

$mapping = @{
    "camion_1_cabina.png" = "media_1787010097922.jpg"
    "microbus_techo_alto.png" = "media_1787010097964.jpg"
    "camioneta_cabina_media.png" = "media_1787010097994.jpg"
    "camioneta_1_cabina.png" = "media_1787010098051.jpg"
}

foreach ($destName in $mapping.Keys) {
    $srcFile = Join-Path $srcDir $mapping[$destName]
    $img = [System.Drawing.Bitmap]::FromFile($srcFile)
    
    # Save full image
    $fullDst = Join-Path $dstDir $destName
    $img.Save($fullDst, [System.Drawing.Imaging.ImageFormat]::Png)
    
    # Save clean cropped version (without bottom text label)
    $cropHeight = 930
    $cropRect = New-Object System.Drawing.Rectangle(0, 0, $img.Width, $cropHeight)
    $cropped = $img.Clone($cropRect, $img.PixelFormat)
    $cleanDst = Join-Path $dstDir ("clean_" + $destName)
    $cropped.Save($cleanDst, [System.Drawing.Imaging.ImageFormat]::Png)
    $cropped.Dispose()
    
    $img.Dispose()
    Write-Host "Processed $destName (clean_$destName saved)"
}
