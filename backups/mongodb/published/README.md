# Respaldo MongoDB publicado en GitHub

Copia versionada del dump de la base de datos ERP para restauración en otra máquina.

## Archivo actual

| Campo | Valor |
|-------|-------|
| Base de datos | `mc-larens2_mundo_accesorios_erp` |
| Archivo | `mongodb_mc-larens2_mundo_accesorios_erp_20260629_151558.archive.gz` |
| Fecha | 2026-06-29 15:15:58 (-06:00) |
| Tamaño | ~303 KB |
| Verificado | Sí (`mongodump` + integridad gzip) |

Metadatos completos: `manifest.json`.

## Restaurar (Docker)

1. Clonar el repo y levantar MongoDB:

```powershell
docker compose up -d mongodb
```

2. Restaurar el archivo publicado:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\mongodb_restore.ps1 `
  -ArchivePath .\backups\mongodb\published\mongodb_mc-larens2_mundo_accesorios_erp_20260629_151558.archive.gz `
  -Force
```

3. Levantar backend y frontend:

```powershell
docker compose up -d backend frontend
```

## Actualizar este respaldo

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\mongodb_backup.ps1
```

Luego copiar el `.archive.gz` y `manifest.json` nuevos a `backups/mongodb/published/` y hacer commit + push.