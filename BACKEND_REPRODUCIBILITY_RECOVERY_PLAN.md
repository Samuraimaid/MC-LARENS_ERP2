# PHASE 5.2B-G - BACKEND REPRODUCIBILITY RECOVERY PLAN

## Objetivo
Recuperar reproducibilidad real del backend: reproducible, deterministic, portable y recoverable.

## Estado de partida
1. Hallazgo inicial: ModuleNotFoundError bcrypt en ejecuciones previas.
2. Hallazgo estructural: optional import emergentintegrations sin contrato fuerte.
3. Hallazgo de configuracion: divergence entre requirements.txt, requirements.local.txt y requirements.prod.txt.

## Plan de recuperacion por etapas

### Etapa 1 - Normalizacion de contrato de dependencias
1. Definir y aprobar la lista de dependencias directas runtime.
2. Catalogar dependencias opcionales y su feature flag.
3. Eliminar ambiguedad entre local/prod/dev mediante capas separadas.

Entregables:
- matriz de clasificacion runtime/dev/test/optional.

### Etapa 2 - Refactor de imports opcionales
1. Revisar imports de integraciones opcionales (ejemplo: emergentintegrations).
2. Aplicar guardas explicitas (try/except ImportError).
3. Añadir mensajes de degradacion controlada y fallback seguro.

Entregables:
- reporte de imports opcionales protegidos.

### Etapa 3 - Lock determinista
1. Introducir estructura de locks por capa descrita en DEPENDENCY_LOCK_STRATEGY.md.
2. Compilar y versionar locks.
3. Registrar hash y diff de lock en PR.

Entregables:
- runtime.txt, dev.txt, test.txt lockeados.

### Etapa 4 - Validacion clean-room obligatoria
1. Crear venv limpio fuera de .venv historico.
2. Instalar exclusivamente lock runtime.
3. Ejecutar import probe backend.server y smoke basico de arranque.
4. Repetir corrida para verificar estabilidad.

Entregables:
- evidencia JSON de 2 corridas exitosas consecutivas.

### Etapa 5 - Alineacion Docker
1. Ajustar Dockerfile para consumir lock runtime final.
2. Ejecutar docker compose build --no-cache.
3. Verificar que no instala dependencias de dev/test.

Entregables:
- reporte de build con lock runtime.

### Etapa 6 - Gate final de reproducibilidad
1. imported_runtime_not_declared = 0.
2. imported_runtime_not_installed = 0.
3. clean-room pass en 2 corridas.
4. docker pass con lock runtime.
5. no drift de lock sin PR aprobado.

## Riesgos y mitigaciones
1. Riesgo: regresion funcional por refactor de imports opcionales.
   - Mitigacion: activar por flags y validar endpoints criticos de runtime contract.
2. Riesgo: aumento de tiempo de build por pipeline de locks.
   - Mitigacion: cache de wheelhouse y jobs separados por capa.
3. Riesgo: confundir dependencias transversales con runtime core.
   - Mitigacion: matriz de ownership por modulo y capa.

## Rollback
1. Mantener branch de recovery separado.
2. Si falla etapa, revertir solo cambios de la etapa actual.
3. Conservar artefactos de auditoria en temporary_cleanup_validation para trazabilidad.

## Validaciones minimas obligatorias
1. Import probe backend.server en clean-room.
2. Login PIN smoke (auth/session) para proteger contrato critico.
3. Draft/Sales/Quotations smoke basico de payload contract.
4. Docker build reproducido en limpio.

## Criterio de cierre
Esta fase se considera cerrada solo cuando el backend pueda recrearse desde cero sin ayudas manuales, con resultado consistente en local y Docker, y con evidencia versionada.
