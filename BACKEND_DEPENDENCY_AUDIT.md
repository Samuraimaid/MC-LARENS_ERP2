# PHASE 5.2B-A - BACKEND DEPENDENCY AUDIT

## Alcance
Auditoria de dependencias reales del backend enfocada en reproducibilidad.

## Fuentes de evidencia
- temporary_cleanup_validation/phase5_2b/backend_import_audit.json
- temporary_cleanup_validation/phase5_2b/robust_dependency_integrity.json
- temporary_cleanup_validation/phase5_2b/installed_packages_snapshot.json

## Hallazgos principales
1. Archivos Python analizados (sin tests): 32.
2. Imports totales detectados: 37.
3. Imports de stdlib: 20.
4. Imports first-party: 1 (backend).
5. Imports third-party reales en runtime: 16.
6. Paquetes runtime mapeados: 15.

## Third-party runtime imports detectados
- apscheduler
- bcrypt
- bson
- emergentintegrations
- fastapi
- httpx
- motor
- openpyxl
- pandas
- pydantic
- pymongo
- pytz
- reportlab
- requests
- sendgrid
- starlette

## Dependencias faltantes reales
1. emergentintegrations aparece en imports, pero no esta declarada ni instalada.
2. El resto de imports runtime mapeados si aparecen en requirements.txt e instalados localmente.

## Dependencias implicitas y supuestos ocultos
1. emergentintegrations se trata como dependencia opcional historica (comentada en requirements), pero el codigo la importa en runtime.
2. Si un import opcional no esta protegido por try/except o feature flag, deja de ser opcional en terminos de regenerabilidad.

## Conclusiones de auditoria
1. El problema no es solo bcrypt: el riesgo estructural es la brecha entre opcion declarada y uso real de imports.
2. Existe mezcla de dependencias de runtime y toolchain en un mismo requirements.txt, lo que aumenta complejidad y drift.
3. Se requiere separar capas de dependencias y formalizar una politica de optional imports.
