# Politicas y Reglas para Cambios de Codigo

Actualizado: 2026-06-27

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

## Politica de rutas y roles (post-login)

### Fuente unica de verdad

Toda decision de **a donde aterriza un usuario al iniciar sesion** y si usa **UI restringida (sin sidebar)** debe vivir en:

- `frontend/src/lib/roleHome.js`

No duplicar condiciones del tipo `role === "cajero" ? "/cashier" : "/workbench"` en `LoginPage`, `AuthCallback`, `MainLayout` u otras pantallas.

### Tres conceptos que NO deben mezclarse

| Funcion | Significado | Ejemplo |
|---------|-------------|---------|
| `getRoleHomePath(role)` | Ruta inicial post-login | `gerencia` → `/workbench`, `cajero` → `/cashier` |
| `isCashierKioskRole(role)` | Kiosko dedicado de caja (sin sidebar, forzar `/cashier`) | Solo `cajero` |
| `canAccessCashier(role)` | Permiso para operar modulo Caja (API + menu) | `gerencia`, `supervisor`, `programador`, `cajero` |

`isCashierRole()` es alias de `isCashierKioskRole()` por compatibilidad historica.

### Incidente documentado: Xinon (gerencia) entraba a Caja sin sidebar

**Fecha:** 2026-06-27

**Sintoma:** El usuario Xinon (`role=gerencia`) iniciaba sesion y aterrizaba en `/cashier` sin sidebar, como si fuera cajero dedicado.

**Causa raiz:** En un cambio de politicas de facturacion/caja, `isCashierRole()` se redefinio como `canAccessCashier()`. Eso hizo que gerencia/supervisor/programador fueran tratados como kiosko de cajero en `MainLayout` (ocultar sidebar + redireccion forzada a `/cashier`).

**Correccion:**

1. Restaurar `isCashierKioskRole()` = solo `cajero`.
2. Mantener `canAccessCashier()` para permisos de API y menu lateral.
3. Centralizar redirect post-login en `getRoleHomePath()` desde `LoginPage` y `AuthCallback`.
4. Agregar pruebas en `frontend/src/lib/roleHome.test.js`.

**Como evitar regresiones:**

1. Si el cambio toca permisos de Caja, preguntar: ¿afecta **acceso al modulo** o **modo kiosko dedicado**?
2. Ejecutar `npm --prefix frontend run test -- roleHome` antes de cerrar el cambio.
3. Validar manualmente login con al menos: `gerencia` (Xinon), `cajero`, `ventas`, `instalaciones`.
4. No reutilizar `isCashierRole` para chequear permisos de API; usar `canAccessCashier`.

### Matriz de aterrizaje esperada (resumen)

| Rol | Home | Sidebar | Puede abrir Caja |
|-----|------|---------|------------------|
| cajero | `/cashier` | Oculto (kiosko) | Si |
| ventas / jefe_vendedores | `/workbench` | Oculto (vendedor) | No |
| jefe_tienda | `/dispatch` | Oculto (vendedor) | No |
| gerencia / supervisor / programador | `/workbench` | Visible | Si (como modulo) |
| instalaciones / electrico / polarizador | `/technician` | Standalone | No |
| recursos_humanos | `/human-resources` | Visible | No |
| bodegas / jefe_tienda | `/dispatch` | Visible | No |

La matriz completa exportada vive en `ROLE_HOME_MATRIX` dentro de `roleHome.js`.

### Incidente documentado: TOTAL_MISMATCH al enviar factura a caja (NIO + edicion de precio supervisor)

**Fecha:** 2026-06-27

**Sintoma:** El vendedor, tras retomar un borrador liberado por gerencia con precios editados, presiona **Enviar Factura a Caja** y recibe error HTTP 409 `TOTAL_MISMATCH` (o toast generico). La factura no llega a caja.

**Flujo de reproduccion:**

1. Vendedor crea borrador: cliente + vehiculo + productos.
2. Gerencia abre borrador, edita precios de linea, libera restricciones.
3. Vendedor retoma borrador y envia a caja con moneda **NIO** (default operativo).

**Causa raiz (dos capas):**

1. **Moneda:** `create_sale` armaba el subtotal de liquidacion en **USD** (precios de catalogo en dolares), pero el frontend enviaba `total_amount` en **cordobas** (`currency: NIO`). `_finalize_create_sale_settlement` comparaba ambos sin conversion (ej. esperado `253.57` vs enviado `9255.49`).
2. **Retencion IR:** Tras corregir moneda, clientes empresa con subtotal ≥ C$1000 seguian fallando porque el backend aplicaba retencion 2% aunque `apply_retention=false` en el payload del vendedor (ej. esperado `23592.14` vs enviado `24009.7`).

**Correccion:**

1. En `backend/server.py` → `create_sale`: convertir `subtotal` a moneda de venta antes de liquidacion cuando `currency === "NIO"` (`subtotal * exchange_rate`).
2. En `backend/server.py` → `_finalize_create_sale_settlement`: usar perfil `exento` y sin hint de retencion cuando `apply_retention=false`, alineado con `SaleForm`.
3. En `frontend/src/pages/SalesPage.jsx` → `createSaleWithPayload`: reenviar `currency`, `exchange_rate`, `applied_discounts`, `apply_retention`, `retention_rate`, `total_amount` desde el payload de `SaleForm` (paridad con `computeSaleTotals`).
4. Mejorar mensaje de error en UI cuando `detail.error === "TOTAL_MISMATCH"`.

**Verificacion obligatoria antes de cerrar cambios en ventas/caja:**

```bash
# Prueba viva (host → API Docker)
python backend/scripts/live_supervisor_price_sale_test.py

# Regresion automatizada
docker exec mundo-backend python -m pytest backend/tests/test_sales_billing_parity.py -v
```

Resultado esperado: status 200 al crear venta + factura visible en `GET /api/caja/facturas?tab=cotizacion` (campo `rows`).

**Verificado en vivo (2026-06-27):** `live_supervisor_price_sale_test.py` → venta `INV-20260627-0003` creada con status 200 y visible en pestaña cotizacion de caja.

**Como evitar regresiones:**

1. Toda validacion de `total_amount` en backend debe usar la **misma moneda** que envia `SaleForm` (`currency` + `exchange_rate`).
2. No comparar totales NIO del frontend contra subtotales USD del backend sin conversion.
3. Mantener alineados `saleTotals.js` (frontend), `create_sale` (backend) y `live_supervisor_price_sale_test.py`.
4. Tras editar precios de supervisor, probar envio a caja como rol `ventas`, no solo como gerencia.

### Fase 1 implementada: voucher con codigo de barras + escaneo en caja + impresora POS 80mm

**Fecha:** 2026-06-27

**Objetivo:** Evitar confusion por clientes homonimos y acelerar caja con escaneo directo del voucher.

**Implementacion:**

1. Voucher termico 80mm con **Code128** del numero completo `INV-YYYYMMDD-####`.
2. Impresion centralizada via puente `scripts/pos_voucher_print_bridge.py` (puerto **9266**) hacia impresora POS en red compartida para todos los vendedores.
3. API `POST /api/print/seller-voucher/{sale_id}/pos` (ventas) y fallback `GET .../preview-pdf`.
4. Caja: campo **Escanear voucher** + `GET /api/caja/facturas/lookup?code=INV-...` abre **dialogo de cobro** directamente.

**Operacion impresora POS (Windows):**

1. Instalar impresora 80mm en red con nombre Windows (ej. `POS-80 Voucher`).
2. Alinear `POS_VOUCHER_PRINTER_NAME` en `docker-compose.yml` con ese nombre.
3. En la PC de ventas/caja: `powershell -File scripts/start-pos-voucher-print-bridge.ps1`
4. Copiar token `backend/data/pos-voucher-bridge-token.txt` al volumen Docker del backend.

**Verificacion:**

```bash
docker exec mundo-backend python -m pytest backend/tests/test_seller_voucher_barcode.py -v
```

### Fase 2 implementada: plan de cobro obligatorio vendedor → caja

**Fecha:** 2026-06-27

**Implementacion:**

1. `SaleForm` + `PaymentPlanEditor`: el vendedor captura líneas de cobro (método, moneda, monto) con TC sistema de solo lectura.
2. Validación **sin tolerancia** en backend (`planned_payment_plan.py` + `create_sale`).
3. Caja precarga el plan y **bloquea** montos/métodos; tarjeta solo completa banco/tipo/transacción/referencia.
4. Desviaciones → `PAYMENT_PLAN_MISMATCH`; vendedor/cajero usan `POST /api/sales/{sale_id}/requests/edit`.
5. Gerencia/supervisor actualiza plan con `PATCH /api/sales/{sale_id}/payment-plan`.
6. Crédito: usa `credit_days` del cliente; sin plazo/límite aprobado no se envía a crédito.

**Verificacion:**

```bash
docker exec mundo-backend python -m pytest backend/tests/test_planned_payment_plan.py -v
docker exec mundo-backend python -m pytest backend/tests/test_sales_billing_parity.py -v
```

### Correccion formulario ventas/cotizaciones — gerencia, descuentos y plan de cobro

**Fecha:** 2026-06-29

**Síntomas reportados:**

1. Gerencia no podía escribir más de 2 dígitos al editar precios de línea.
2. Descuento global no permitía borrar el cero (obligaba a escribir con cero a la izquierda).
3. Montos del desglose final visualmente desalineados.
4. Plan de cobro definido por gerencia no persistía al liberar el borrador; el vendedor no veía proporciones ni podía ajustar montos.
5. Botones **Guardar y Limpiar** / **Limpiar** no liberaban el borrador para el vendedor en perfil gerencia/supervisor.

**Causas raíz:**

1. `useEffect` del editor de precios dependía de `priceEditorAmount` y hacía `select()` en cada tecla, truncando la escritura.
2. Input `type="number"` con `value` numérico y normalización inmediata en `onChange` (`applyGlobalDiscountChange`).
3. Filas del desglose con `flex justify-between` y `ErpRollingCurrency` animado sin ancho fijo en la columna de montos.
4. `setPaymentPlanLines` no llamaba `persistDraftSnapshot`; el borrador no restauraba `paymentPlanLines` al cargar desde `localStorage`/servidor.
5. `PaymentPlanEditor` quedaba totalmente `disabled` con `sellerParamsLocked`, ocultando proporciones y bloqueando ajustes de montos del vendedor.
6. `handleSaveAndClearSale` / `handleSaveAndClearQuote` guardaban pero no invocaban `releaseServerDraft` para borradores ajenos ya modificados por supervisión.
7. Backend no consideraba cambios de `paymentPlanLines` / `planned_payment_plan` como cambio significativo de supervisión (`supervisor_changed`).

**Correcciones aplicadas:**

1. `SaleForm.jsx`: editor de precio con `type="text"` + `inputMode="decimal"`; foco solo al abrir el diálogo.
2. `SaleForm.jsx`: descuento global con estado borrador (`globalDiscountDraft`) y commit en `onBlur`.
3. `SaleForm.jsx`: componente `SaleTotalsBreakdownRow` con grid de dos columnas alineadas a la derecha.
4. `SaleForm.jsx`: `handlePaymentPlanLinesChange` persiste snapshot; restauración de plan al cargar borrador; auto-sync no pisa planes restaurados.
5. `PaymentPlanEditor.jsx`: `structureLocked` para método/moneda; montos editables por vendedor liberado; muestra `% del total` por línea.
6. `supervisorDraftRelease.js` + `SalesPage.jsx` / `QuotationsPage.jsx`: liberación automática en **Guardar y Limpiar** cuando aplica.
7. `backend/server.py`: `_normalize_payment_plan_snapshot` en `_draft_has_meaningful_supervisor_change`.

**Verificación obligatoria:**

```bash
docker exec mundo-backend python backend/scripts/live_supervisor_draft_form_test.py
docker exec mundo-backend python backend/scripts/live_e2e_runner.py
```

**Cómo evitar regresiones:**

1. Inputs monetarios editables: texto libre en `onChange`, normalizar en `onBlur` (mismo patrón que `PaymentPlanEditor`).
2. No incluir el valor del input en dependencias de `useEffect` que hagan `focus()`/`select()`.
3. Todo cambio de plan de cobro debe pasar por persistencia de borrador (`paymentPlanLines` + `planned_payment_plan`).
4. Probar siempre flujo gerencia → liberar → vendedor con plan mixto y descuento global > 2%.

### Corrección envío a caja tras liberación (vendedor)

**Fecha:** 2026-06-29

**Síntoma:** Al pulsar **Enviar Factura a Caja**, el vendedor veía toast tipo *"El plan debe sumar C$ … (actual: C$ …)"* o *TOTAL_MISMATCH* en borradores liberados por gerencia.

**Causas raíz:**

1. El plan guardado por gerencia quedaba con montos de un total anterior; al enviar, `validatePlanAgainstTotal` fallaba antes de llegar al API.
2. Pago **mixto cash+transfer** con descuento global: el frontend aplicaba descuento pero el backend trataba `payment_method=mixed` como no elegible (`_is_discount_allowed("mixed")` → false).
3. Borradores liberados con descuento >2%: el total del formulario no honraba el descuento aprobado por supervisión cuando el método bloqueaba promociones en UI.

**Correcciones:**

1. `buildPlanLinesForSubmit` + `rescalePlanLinesToTotal`: al enviar, reconcilia el plan con el total actual (mixto conserva proporciones si el borrador está liberado).
2. `computeSaleTotals({ supervisorDiscountPreapproved: true })` cuando `sellerReleasedRestricted && globalDiscount > 0`.
3. Backend `_payment_methods_allow_discounts` + `supervisor_discount_preapproved` en `_finalize_create_sale_settlement`.

**Verificación:**

```bash
docker exec mundo-backend python backend/scripts/live_supervisor_draft_form_test.py
cd frontend && npm test -- --run src/lib/plannedPaymentPlan.test.js src/lib/saleTotals.test.js
```

### Politica de cobro acordada (referencia operativa)

Reglas acordadas con operacion:

1. **Plan de pago obligatorio** al enviar factura a caja (metodo, moneda, montos, tasa sistema). Sin tolerancia de desviacion entre lo facturado y lo calculado por el sistema.
2. Si el cliente cambia condiciones en caja, **no se ajusta en caja**: vendedor o cajero solicitan edicion; solo **gerencia/supervisor** modifica la factura.
3. En pago mixto con tarjeta: vendedor declara **monto** por linea de tarjeta; cajero documenta banco, tipo, transaccion y referencia.
4. Facturas a **credito**: gerencia/supervisor fijan dias de credito, techo y articulos segun perfil aprobado del cliente.

---

### Politica de Assets Multimedia y Despliegues Ligeros en Cloud Run

**Actualizado:** 2026-09-04

1. **Almacenamiento Desacoplado en Google Cloud Storage CDN**:
   - Todos los recursos multimedia pesados (videos promocionales `.mp4`, colecciones masivas de planos `.png` > 8,000 archivos, modelos 3D y reportes pesados) **deben servirse exclusivamente vía CDN de GCS** (`https://storage.googleapis.com/mclarens-erp-vehicles/...`).
   - **Queda estrictamente prohibido** empaquetar carpetas multimedia locales (`frontend/public/videos/`, `backend/data/blueprints_raw/`, etc.) dentro de la imagen Docker de Cloud Run.
2. **Blindaje de `.gcloudignore` y `.dockerignore`**:
   - `.gcloudignore` y `.dockerignore` deben excluir de forma permanente:
     `frontend/public/videos/`, `backend/data/blueprints_raw/`, `frontend/public/vehicles/models/`, `*.mp4`, `*.xlsx` y volcados de depuración del root (`/ERP_TREE.txt`, etc.).
   - **Garantía de inclusión**: Siempre deben incluirse explícitamente `!frontend/index.html` y `!backend/requirements.txt` para que el compilador Vite y Docker dispongan de los puntos de entrada necesarios.
   - El archivo `.tgz` subido por `gcloud builds submit` **no debe superar los 35 MB**.

---

### Politica de Clasificacion Vehicular y Compatibilidad de Polarizados (Transito Nicaragua)

**Actualizado:** 2026-09-04

1. **Mapeo Canónico Obligatorio**:
   El sistema debe respetar la clasificación vehicular de las tarjetas de circulación de la Policía Nacional de Nicaragua / Tránsito:
   - `AUTOMÓVIL / AUTOMOVIL / TURISMO / SEDAN` → `sedan` → Producto: `POL-SED-COM` (Polarizado Completo Sedán / Automóvil).
   - `HATCHBACK / COMPACTO` → `hatchback` → Producto: `POL-HB-COM` (Polarizado Completo Hatchback / Compacto).
   - `CAMIONETA + ST/WAGON, STATION, RURAL, CERRADA, JEEP, TODO TERRENO` → `suv` → Producto: `POL-SUV-COM` (Polarizado Completo SUV / Station Wagon).
   - `CAMIONETA + D/CABINA, D/C, CABINA SENCILLA, CABINA Y MEDIA, PICKUP, TINA` → `pickup` → Producto: `POL-PCK-COM` (Polarizado Completo Camioneta Pickup).
   - `MICROBUS / MICROBÚS / VAN / PANEL / TECHO ALTO` → `van` → Producto: `POL-VAN-COM` (Polarizado Completo Microbús / Van).
   - `CAMIÓN / CAMION / CABEZAL / TRACTO / FURGÓN` → `truck` → Producto: `POL-TRK-COM` (Polarizado Completo Camión / Cabezal).
   - `MOTOCICLETA / MOTO / ATV / CUADRICICLO` → `moto` → Excluido de polarizados completos automotrices.
2. **Prohibición de Fallbacks Erróneos**:
   - Ningún modelo SUV (ej. BMW X1–X7, Audi Q3–Q8, Mercedes GLC/GLE, Toyota RAV4, Tucson, CR-V) puede clasificarse como `sedan` ni ofrecer polarizados de sedán en el Carrito de Ventas.
3. **Contenedores y Popovers de Zoom**:
   - Todo elemento flotante o popover de vista previa (como `Vista Ampliada 100%`) debe utilizar centrado responsivo (`sm:left-1/2 sm:-translate-x-1/2 sm:max-w-[calc(100vw-2rem)]`) e imagen contenida (`object-contain`) para garantizar que nunca se recorte en bordes de pantalla.

---

## Referencias del repo

- `FRONTEND_MODERNIZATION_STATUS.md`
- `README_FRONTEND_RUN.md`
- `frontend/README.md`
- `DEPENDENCY_AUDIT_PLAN.md`
- `RELEASE.md`
