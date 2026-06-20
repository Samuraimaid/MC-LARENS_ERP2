# PHASE 5.2B-F - DEPENDENCY LOCK STRATEGY

## Objetivo
Convertir el backend en deterministic y reproducible, eliminando variabilidad de resolucion.

## Principios
1. Una sola fuente de verdad por entorno.
2. Separacion estricta de capas: runtime, dev, test.
3. Locks compilados y versionados en git.
4. Validacion clean-room obligatoria antes de aprobar cambios de dependencias.

## Estructura propuesta
1. backend/requirements/runtime.in
   - Solo dependencias directas de runtime.
2. backend/requirements/dev.in
   - Incluye runtime.in + lint/type/dev tools.
3. backend/requirements/test.in
   - Incluye runtime.in + pytest y utilidades de prueba.
4. backend/requirements/runtime.txt
5. backend/requirements/dev.txt
6. backend/requirements/test.txt

Los archivos .txt deben ser locks compilados, con versiones exactas y hash-checking cuando aplique.

## Flujo de locking recomendado
1. Editar solo archivos .in.
2. Compilar locks con herramienta determinista (pip-tools o equivalente).
3. Ejecutar validacion local en venv limpio con install desde lock.
4. Ejecutar validacion clean-room automatizada.
5. Ejecutar build Docker con el lock de runtime.
6. Publicar evidencia de hashes y diff de lock en PR.

## Politica para dependencias opcionales
1. Si una dependencia es opcional, su import debe estar protegido por try/except.
2. Debe existir flag de feature para activar su uso.
3. Debe documentarse en una seccion Optional Integrations del runtime.
4. Si el import es hard en startup, deja de ser opcional y pasa a runtime obligatorio.

## Docker alignment
1. Docker debe consumir lock de runtime dedicado, no un archivo ambiguo.
2. La imagen de produccion no debe instalar tooling de desarrollo.
3. El lock utilizado por Docker debe ser el mismo validado en clean-room de runtime.

## Gate de aprobacion
Se considera lock strategy aplicada solo si:
1. Hay locks separados por capa.
2. Clean-room backend import pasa 2 corridas consecutivas.
3. Docker build usa lock runtime y pasa.
4. No hay imports runtime no declarados.
