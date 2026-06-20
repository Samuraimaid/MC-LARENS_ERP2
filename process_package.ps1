
$source = Get-ChildItem -Path "C:\Users\DELL G5\Desktop" -Filter "MC-LARENS_ERP2_MIGRATION_PACKAGE_*" -Directory | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $source) { Write-Host "ERROR: No source package found."; exit; }
$dest = $source.FullName + "_NO_IMAGES"
if (Test-Path $dest) { Remove-Item -Recurse -Force $dest }
$null = New-Item -ItemType Directory -Path $dest -Force

$dirsToCopy = @("repo", "docker\containers", "manifests", "docs", "logs", "restore")
foreach ($dir in $dirsToCopy) {
    $srcDir = Join-Path $source.FullName $dir
    $dstDir = Join-Path $dest $dir
    if (Test-Path $srcDir) {
        robocopy $srcDir $dstDir /E /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
    }
}

$zipPath = "$dest.zip"
if (Test-Path $zipPath) { Remove-Item $zipPath }
Compress-Archive -Path "$dest\*" -DestinationPath $zipPath -Force

$zipFile = Get-Item $zipPath
$repoPath = Join-Path $dest "repo"
$repoFiles = (Get-ChildItem -Path $repoPath -File -Recurse -ErrorAction SilentlyContinue).Count
$containerPath = Join-Path $dest "docker\containers"
$containerTars = (Get-ChildItem -Path $containerPath -Filter "*_filesystem.tar" -ErrorAction SilentlyContinue).Count
$noImages = -not (Test-Path (Join-Path $dest "docker\images"))

Write-Host "--- RESULTS ---"
Write-Host "ORIGIN_PATH: $($source.FullName)"
Write-Host "DEST_PATH: $dest"
Write-Host "ZIP_PATH: $zipPath"
Write-Host "ZIP_EXISTS: $($zipFile -ne $null)"
Write-Host "ZIP_SIZE_MB: $([math]::Round($zipFile.Length / 1MB, 2))"
Write-Host "REPO_FILE_COUNT: $repoFiles"
Write-Host "CONTAINER_TAR_COUNT: $containerTars"
Write-Host "NO_IMAGES_CHECK: $noImages"

