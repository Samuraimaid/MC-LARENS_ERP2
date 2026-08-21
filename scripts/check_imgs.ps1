Add-Type -AssemblyName System.Drawing

$files = @(
    "media_1787009700529.jpg",
    "media_1787009700553.jpg",
    "media_1787009700612.jpg",
    "media_1787009700651.jpg",
    "media_1787009700670.jpg"
)
$dir = "C:\Users\Xinon\.gemini\antigravity-ide\brain\972af972-50af-44f8-852b-45ccfb6a178b\.user_uploaded"

foreach ($f in $files) {
    $full = Join-Path $dir $f
    $img = [System.Drawing.Image]::FromFile($full)
    Write-Host "$f : $($img.Width) x $($img.Height)"
    $img.Dispose()
}
