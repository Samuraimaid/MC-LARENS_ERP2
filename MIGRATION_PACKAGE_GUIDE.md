# Paquete Unico de Migracion de Equipo

Este documento define un flujo completo para mover este proyecto a otro equipo sin perder:
- codigo y estado git actual
- imagenes Docker
- contenedores Docker
- volumenes Docker
- trazabilidad de estado (hecho, medio terminado, pendiente)

## Archivos clave agregados

- `scripts/migration/create_full_migration_backup.ps1`
- `scripts/migration/restore_full_migration_backup.ps1`
- `scripts/migration/bootstrap_workstation.ps1`
- `MIGRATION_PACKAGE_GUIDE.md` (este archivo)

## 1) Crear backup completo (equipo actual)

Desde la raiz del repo:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\migration\create_full_migration_backup.ps1
```

Salida esperada:
- carpeta en Desktop con nombre `MC-LARENS_ERP2_MIGRATION_PACKAGE_YYYYMMDD_HHMMSS`
- zip final de esa carpeta
- inventario y manifiestos en subcarpeta `manifests`

Opciones utiles:

```powershell
# omitir docker (si solo quieres codigo + git)
powershell -ExecutionPolicy Bypass -File .\scripts\migration\create_full_migration_backup.ps1 -SkipDocker

# incluir docker pero omitir volumenes (mas rapido)
powershell -ExecutionPolicy Bypass -File .\scripts\migration\create_full_migration_backup.ps1 -SkipVolumes
```

## 2) Restaurar backup (equipo nuevo)

Copia el zip generado al equipo nuevo y ejecuta:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\migration\restore_full_migration_backup.ps1 -PackagePath "C:\ruta\MC-LARENS_ERP2_MIGRATION_PACKAGE_YYYYMMDD_HHMMSS.zip"
```

Esto hace:
- restaura repositorio desde zip interno
- carga imagenes Docker
- importa snapshots de contenedores como imagenes `restored/<name>:snapshot`
- restaura volumenes Docker (si no usas `-SkipVolumeRestore`)

## 3) Reinstalar dependencias para continuar trabajo

Comando recomendado (equipo nuevo):

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\migration\bootstrap_workstation.ps1 -InstallSystemTools
```

Sin instalar herramientas del sistema (si ya tienes Docker/Node/Python):

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\migration\bootstrap_workstation.ps1
```

## 4) Estado del proceso (hecho / medio terminado / falta)

### Hecho
- Limpieza de artefactos temporales y venvs generados en validaciones previas
- Conservacion de evidencia oficial de validacion de Phase 6B
- Integrations domain extraction preservado
- Toolkit completo de migracion creado (backup, restore, bootstrap)

### Medio terminado
- Existen cambios de Phase 5 no relacionados aun en working tree (reportes y archivos de backend/frontend ya identificados)
- Existen documentos de analisis no rastreados que requieren clasificacion final por commit objetivo

### Falta por hacer
- Ejecutar el backup final en frio (idealmente con servicios estables y sin cargas paralelas)
- Verificar restauracion en un equipo limpio (prueba de humo)
- Separar commits: Phase 5 residual vs Phase 6B milestone
- Cerrar pendientes del checklist operativo de estabilizacion

## 5) Recomendacion operativa

Para migracion segura:
1. Ejecutar backup con Docker activo y estable
2. Validar checksum/tamano de archivos `.tar` y `.zip`
3. Restaurar en una maquina limpia
4. Ejecutar bootstrap
5. Levantar stack con `docker compose up -d --build`
6. Validar endpoints criticos y login

## 6) Referencias de contexto

- `temporary_cleanup_validation/phase6b/CLEANUP_AUDIT_6B.md`
- `BACKUP_INSTRUCTIONS.md`
- `INTEGRATIONS_ROLLBACK_PLAN.md`
- `INTEGRATIONS_PARITY_REPORT.md`
