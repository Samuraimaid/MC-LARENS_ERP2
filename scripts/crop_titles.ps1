Add-Type -AssemblyName System.Drawing

$files = Get-ChildItem -Path "c:\ANTIGRAVITY\MC-LARENS_ERP2\backend\data\blueprints_cleaned\toyota" -Filter "*.png" | Select-Object -First 10

foreach ($file in $files) {
    $img = [System.Drawing.Bitmap]::FromFile($file.FullName)
    Write-Host "File: $($file.Name) - Size: $($img.Width) x $($img.Height)"
    
    # Let's crop the top title header area (e.g. top 40px, left 300px)
    $titleRect = New-Object System.Drawing.Rectangle(0, 0, [Math]::Min(350, $img.Width), [Math]::Min(35, $img.Height))
    $titleBmp = $img.Clone($titleRect, $img.PixelFormat)
    
    $destTitle = "c:\ANTIGRAVITY\MC-LARENS_ERP2\backend\data\blueprints_cleaned\toyota\sample_title_" + $file.Name
    $titleBmp.Save($destTitle, [System.Drawing.Imaging.ImageFormat]::Png)
    $titleBmp.Dispose()
    $img.Dispose()
}

Write-Host "Sample title headers cropped."
