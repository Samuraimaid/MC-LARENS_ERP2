# PHASE 5.2B-C - ENVIRONMENT DRIFT ANALYSIS

## Fuentes
- temporary_cleanup_validation/phase5_2b/installed_packages_snapshot.json
- temporary_cleanup_validation/phase5_2b/dependency_gap_analysis.json
- temporary_cleanup_validation/phase5_2b/cleanroom_regenerability_test.json

## Evidencia de drift
1. Paquetes instalados localmente no declarados: 11.
   - annotated-doc, cfgv, colorama, distlib, et-xmlfile, identify, nodeenv, pip, setuptools, tzlocal, virtualenv.
2. Parte de estos paquetes son transitivos o tooling de entorno, no dependencias directas de runtime.
3. La presencia de paquetes no declarados en el entorno local puede ocultar faltantes reales.

## Evidencia de inconsistencia historica
1. En ejecuciones previas se observó ModuleNotFoundError para bcrypt durante import probe.
2. En ejecuciones posteriores, con reconstruccion de entorno, bcrypt aparece instalado.
3. Esto indica sensibilidad al estado del entorno (drift temporal o ejecucion con venv incorrecto).

## Drift por resolucion
1. Se observaron episodios de backtracking largo de pip y conflicto de resolucion en fases previas.
2. Sin lock determinista, el conjunto final de versiones puede variar entre corridas.

## Diagnostico
1. El backend depende de una disciplina de entorno no codificada (que venv se activa, cuando se reinstala, como se fija resolver).
2. La reproducibilidad no puede considerarse garantizada mientras el proceso dependa del estado historico de la maquina.

## Recomendacion de control de drift
1. Definir un flujo canonico unico de bootstrap backend.
2. Separar requirements por capa (runtime/dev/test) y lockear versions compiladas.
3. Validar siempre con clean-room y artefactos de evidencia antes de aprobar cambios.
