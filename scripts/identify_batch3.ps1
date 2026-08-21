Add-Type -AssemblyName System.Drawing

$files = @(
    "media_1787010210264.jpg",
    "media_1787010210310.jpg",
    "media_1787010210353.jpg",
    "media_1787010210383.jpg",
    "media_1787010210478.jpg"
)
$dir = "C:\Users\Xinon\.gemini\antigravity-ide\brain\972af972-50af-44f8-852b-45ccfb6a178b\.user_uploaded"

foreach ($f in $files) {
    $full = Join-Path $dir $f
    $img = [System.Drawing.Bitmap]::FromFile($full)
    $blackCount = 0
    $minX = 9999
    $maxX = 0
    for ($y = 940; $y -lt 1010; $y += 2) {
        for ($x = 0; $x -lt 764; $x += 2) {
            $c = $img.GetPixel($x, $y)
            if ($c.R -lt 50 -and $c.G -lt 50 -and $c.B -lt 50) {
                $blackCount++
                if ($x -lt $minX) { $minX = $x }
                if ($x -gt $maxX) { $maxX = $x }
            }
        }
    }
    Write-Host "$f : blackCount=$blackCount, text width=$($maxX - $minX) (minX=$minX, maxX=$maxX)"
    $img.Dispose()
}
