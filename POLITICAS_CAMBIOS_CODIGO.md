# Politicas y Reglas para Cambios de Codigo

Actualizado: 2026-04-01

## Objetivo

Este documento define como deben hacerse cambios, correcciones, refactors y nuevas funciones en este repositorio para evitar regresiones como las ya corregidas en frontend, build, Docker, variables de entorno y dependencias.

La meta es permitir mejoras futuras en modulos como Ventas, RRHH, Inventario, Reportes y Autenticacion sin romper la estructura actual ni reintroducir deuda tecnica evitable.

## Principios obligatorios

1. Todo cambio debe respetar la arquitectura actual antes de intentar reescribirla.
2. Los cambios deben ser pequenos, verificables y con alcance acotado.
3. Se corrige la causa raiz, no solo el sintoma visible.
4. No se mezclan en una misma tanda: nuevas funciones, migraciones grandes y fixes urgentes, salvo que sea estrictamente necesario.
5. Ningun cambio se considera terminado si no deja evidencia de validacion.

## Reglas generales de modificacion

1. Antes de editar, identificar el punto real de entrada del flujo afectado.
2. Antes de mover archivos o cambiar contratos, revisar quien los consume.
3. Si un cambio afecta build, runtime, Docker o autenticacion, validar esos flujos explicitamente.
4. Si un cambio afecta un modulo operativo, documentar el cambio y su impacto.
5. Si el cambio introduce una nueva convencion, esa convencion debe quedar escrita en documentacion del repo.

## Estructura que no debe romperse

### Frontend

- El frontend usa Vite como build principal.
- El entry HTML del frontend es `frontend/index.html`.
- La configuracion de Vite vive en `frontend/vite.config.js`.
- Las variables de entorno del frontend deben resolverse a traves de `frontend/src/lib/env.js`.
- Las rutas principales viven en `frontend/src/App.js`.
- Las paginas de rutas deben mantenerse con carga diferida cuando sea razonable.
- El build de salida del frontend debe seguir generandose en `frontend/build/`.

### Backend

- El entrypoint real del backend es `backend/server.py`.
- Las rutas HTTP deben seguir separadas de la logica de negocio siempre que sea posible.
- No introducir accesos directos a base de datos desde componentes frontend ni duplicar reglas de negocio entre frontend y backend sin justificacion.

### Docker y operacion

- El Dockerfile del frontend depende de `npm ci` y del lockfile vigente.
- El build Docker del frontend depende de un `.dockerignore` correcto para no inflar el contexto.
- Las variables `VITE_*` son la fuente principal de configuracion nueva.
- `REACT_APP_*` solo existe como compatibilidad transitoria y no debe ser la primera opcion en cambios nuevos.

## Reglas para frontend

### Variables de entorno

1. No leer `process.env.REACT_APP_*` directamente en componentes nuevos.
2. No usar `import.meta.env` disperso por toda la app.
3. Toda lectura de configuracion debe pasar por `frontend/src/lib/env.js`.
4. Si una variable debe sobrevivir a despliegues antiguos, agregar compatibilidad en `env.js`, no en cada pagina.

### Rutas y code-splitting

1. Las paginas de rutas nuevas deben integrarse desde `frontend/src/App.js` siguiendo el patron de carga diferida ya implementado.
2. No volver a convertir `App.js` en un archivo con imports estaticos de todas las pantallas si no hay una razon fuerte.
3. Si una pantalla crece demasiado, dividirla en subcomponentes y hooks por dominio.

### Cambios en pantallas grandes como Ventas y RRHH

1. No meter toda la logica nueva directamente dentro de la pagina principal.
2. Si se agrega una funcion compleja, extraerla a:
   - componentes de presentacion
   - hooks de negocio
   - utilidades o servicios
3. Mantener separadas estas responsabilidades:
   - carga de datos
   - estado local de UI
   - reglas de negocio
   - formateo visual
4. Si una pantalla supera un nivel alto de complejidad, dividir por secciones funcionales y no por conveniencia temporal.

### UI y estado

1. No duplicar estados derivados si pueden calcularse.
2. No crear efectos que dependan de variables inestables si pueden resolverse con callbacks o utilidades.
3. No introducir nuevas dependencias de estado global sin necesidad real.
4. Evitar codigo muerto, imports no usados y ramas de UI sin validacion.

## Reglas para backend

1. Toda nueva ruta debe tener validacion clara de entrada y salida.
2. No mezclar codigo temporal de debugging con endpoints productivos.
3. Si cambia un contrato API, revisar frontend, scripts y pruebas relacionadas.
4. Si una regla de negocio impacta roles, sucursales o permisos, documentar el cambio y validar los casos operativos.
5. Si se introduce una migracion de datos, debe quedar documentada y ser repetible o claramente descartable.

## Reglas de dependencias

1. No agregar librerias nuevas si el problema puede resolverse con las ya presentes.
2. Toda dependencia nueva debe justificar uno de estos motivos:
   - simplifica codigo complejo de forma clara
   - reduce riesgo operativo
   - elimina mantenimiento manual propenso a fallos
3. No mezclar upgrades mayores con fixes funcionales urgentes.
4. Las actualizaciones deben validarse con build, pruebas y audit cuando aplique.

## Reglas de Docker y build

1. No copiar `node_modules`, builds previos, logs o artefactos innecesarios al contexto Docker.
2. Si el contexto Docker crece de forma fuerte, revisar `.dockerignore` antes de tocar otra cosa.
3. No cambiar rutas de build, nombres de salida o variables de runtime sin actualizar la documentacion operativa.
4. Si un cambio toca `generate-env.js`, tambien debe validarse el comportamiento de `public/env.js`.

## Reglas de documentacion

1. Todo cambio de arquitectura, build, variables, despliegue o convencion debe actualizar documentacion.
2. Los documentos minimos a revisar segun el cambio son:
   - `README.md`
   - `README_FRONTEND_RUN.md`
   - `FRONTEND_MODERNIZATION_STATUS.md`
   - `DEPENDENCY_AUDIT_PLAN.md` cuando el cambio toca dependencias o tooling
   - este archivo cuando cambia la politica de desarrollo
3. Si un cambio operativo afecta soporte o publicacion, revisar tambien `RELEASE.md` e `INSTALACION_LOCAL.md`.

## Checklist obligatorio antes de cerrar un cambio

### Si toca frontend

1. `npm --prefix frontend run lint`
2. `npm --prefix frontend run build`
3. Si toca dependencias: `npm --prefix frontend audit`
4. Si toca Docker o build: `docker compose build frontend`

### Si toca backend

1. Verificar imports o compilacion del backend.
2. Ejecutar pruebas relevantes del modulo tocado.
3. Si toca dependencias: `pip-audit` o equivalente validado en el entorno del repo.

### Si toca documentacion o scripts operativos

1. Confirmar que el documento o script sigue reflejando el flujo real.
2. Confirmar que no contradice otros documentos principales.

## Practicas prohibidas

1. Reintroducir CRA, CRACO o configuracion heredada como solucion rapida.
2. Leer variables de entorno directamente desde paginas nuevas cuando ya existe una capa comun.
3. Hacer fixes visuales que cambien contratos de API sin validarlo extremo a extremo.
4. Dejar codigo comentado, flags temporales sin documentar o scripts rotos en el repo.
5. Corregir builds rompiendo el flujo local, Docker o runtime por separado.
6. Editar una pantalla grande agregando logica improvisada sin extraer piezas reutilizables.

## Como hacer cambios futuros en RRHH y Ventas sin romper la estructura

### Ventas

- Mantener la pagina de ventas como orquestadora, no como deposito de toda la logica.
- Formularios, calculos, validaciones y persistencia de borradores deben vivir en piezas separadas.
- Si una mejora afecta descuentos, aprobaciones, cotizaciones o pagos, validar tambien los flujos relacionados y no solo la pantalla principal.

### RRHH

- Mantener separadas configuraciones, reportes, asistencia, deducciones y acciones administrativas.
- Si una nueva funcion toca politicas horarias o deducciones, validar impacto en backend, UI y documentos operativos.
- No mezclar reglas de asistencia con logica visual sin encapsularlas.

## Tipo de codigo esperado

El codigo nuevo debe ser:

- explicito en sus dependencias
- modular en responsabilidades
- compatible con build local, build Docker y runtime real
- facil de probar o validar
- consistente con las convenciones actuales del repo
- libre de accesos ad hoc a configuracion, rutas o APIs repetidas en muchos puntos

## Criterio de aprobacion tecnica

Un cambio esta bien hecho si cumple estas condiciones al mismo tiempo:

1. Resuelve el problema real.
2. No rompe build, Docker, audit o rutas principales.
3. No duplica patrones que ya fueron centralizados.
4. Deja documentado lo necesario para que otro cambio futuro no revierta la mejora.

## Referencias del repo

- `FRONTEND_MODERNIZATION_STATUS.md`
- `README_FRONTEND_RUN.md`
- `frontend/README.md`
- `DEPENDENCY_AUDIT_PLAN.md`
- `RELEASE.md`
