# ==============================================================================
# 🏎️ MC-LARENS ERP 2.0 - SCRIPT DE CREACION DE BUNDLE LOCAL DE RESPALDO
# ==============================================================================
# Genera un archivo autónomo .bundle con el 100% del historial, código y ramas de Git.
# Este archivo puede guardarse en Google Drive, OneDrive, SSD externo o enviarse por correo.

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$bundleFileName = "mclarens_erp_backup_$timestamp.bundle"
$latestFileName = "mclarens_erp_git_backup.bundle"

Write-Host "📦 Generando respaldo maestro de Git ($bundleFileName)..." -ForegroundColor Cyan
git bundle create $bundleFileName --all

if ($LASTEXITCODE -eq 0) {
    Copy-Item $bundleFileName $latestFileName -Force
    $sizeMB = [math]::Round((Get-Item $bundleFileName).Length / 1MB, 2)
    Write-Host "✅ ¡Respaldo creado con éxito! ($sizeMB MB)" -ForegroundColor Green
    Write-Host "📍 Archivo generado: $bundleFileName" -ForegroundColor Yellow
    Write-Host "📍 Enlace maestro: $latestFileName" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "💡 Cómo restaurar en otro equipo si GitHub no está disponible:" -ForegroundColor Cyan
    Write-Host "   git clone $latestFileName MC-LARENS_ERP2" -ForegroundColor White
} else {
    Write-Host "❌ Error al generar el Git Bundle." -ForegroundColor Red
}
