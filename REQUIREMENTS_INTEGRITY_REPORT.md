# PHASE 5.2B-B - REQUIREMENTS INTEGRITY REPORT

## Fuentes
- temporary_cleanup_validation/phase5_2b/requirements_diff_summary.json
- temporary_cleanup_validation/phase5_2b/robust_dependency_integrity.json
- temporary_cleanup_validation/phase5_2b/installed_packages_snapshot.json

## Estado actual de archivos de dependencias
1. backend/requirements.txt: 130 paquetes.
2. backend/requirements.local.txt: 128 paquetes.
3. backend/requirements.prod.txt: 69 paquetes.
4. Ningun par de archivos es equivalente.

## Diferencias criticas
1. requirements.txt vs requirements.local.txt:
- txt_minus_local: jq, openpyxl.
- local_minus_txt: vacio.

2. requirements.txt vs requirements.prod.txt:
- 61 paquetes estan en txt y no estan en prod.
- 0 paquetes estan en prod y no estan en txt.

## Integridad import vs declaration
1. Imports runtime no declarados: emergentintegrations.
2. Imports runtime no instalados: emergentintegrations.
3. Declarados pero no importados en runtime core (sin tests): 116.

## Interpretacion
1. requirements.txt combina runtime, integraciones opcionales y tooling (lint/test/type-check), creando ruido en regeneracion.
2. requirements.prod.txt es un subconjunto fuerte de txt, pero no existe una especificacion formal de que capa debe usar cada entorno.
3. La dependencia opcional emergentintegrations no tiene contrato tecnico explicito (import guard + flag + doc), generando riesgo de fallo segun entorno.

## Riesgos
1. Version drift entre local/prod por falta de lock consolidado.
2. Reproducibilidad inconsistente por mezcla de objetivos en un solo archivo de requirements.
3. Falsos positivos de salud por ambientes historicos con paquetes preinstalados.
