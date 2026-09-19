# Estándar UX — Buscador ERP (Catálogo y pantallas afines)

**Fecha:** 2026-09-19  
**Owner:** Xinon · **Autor:** Case  
**Referencia implementada:** PR [#25](https://github.com/Samuraimaid/MC-LARENS_ERP2/pull/25) → merge `831ef673` en `master`  
**Archivo de referencia:** `frontend/src/pages/CatalogPage.jsx`  
**Relacionado:** `docs/GUIA_BUSQUEDA_PRODUCTOS_RAPIDA.md` (plan API/debounce/payload — sigue vigente), `docs/ANTIGRAVITY_MASTER.md`

---

## 1. Qué se entregó en Catálogo (PR #25)

Patrón de buscador en **Catálogo** (ya en master; requiere `./deploy.sh` + hard refresh):

| # | Capacidad | Comportamiento |
|---|-----------|----------------|
| 1 | Pegar SKU/texto | `onChange` + `onInput` + `onPaste` → `applySearchValue` (pegar filtra al instante) |
| 2 | Barra sticky | Toolbar sticky (`sticky top-0 z-30` + blur) al scrollear la grilla |
| 3 | Filtros colapsables | Categoría / subcategoría / tipo / vehículo + “Permanecer en catálogo” detrás de toggle **Filtros** (cerrados por defecto) |
| 4 | Limpiar | Botón **Limpiar** resetea búsqueda + todos los filtros |
| 5 | QR / código de barras | Reutiliza `ProductBarcodeScannerDialog` (mismo que Ventas). El código escaneado va al campo de búsqueda |
| 6 | Autocomplete | Dropdown ~10 sugerencias (SKU / nombre / marca) con `ProductThumb`; click → busca + Quick View; Enter con 1 match → Quick View |
| 7 | Scroll infinito | `IntersectionObserver` sobre sentinel; chunks de +30 (`visibleCount`) |
| 8 | FAB subir | Botón flotante tras scroll → `scrollTo(0)` + focus al input |

**No reinventar el escáner:** siempre `frontend/src/components/erp/ProductBarcodeScannerDialog.jsx` (`open`, `onOpenChange`, `onScan`).

---

## 2. Estándar a replicar (cuando el smoke de Catálogo sea OK)

Xinon (2026-09-19): *si da buenos resultados, el mismo estilo en todos los endpoints del ERP que lo requieran.*

### Principios

1. **Misma sensación:** sticky + pegar fiable + limpiar + filtros no invasivos + (si aplica) escáner / autocomplete / infinite o “cargar más” automático.
2. **Un solo escáner de producto:** `ProductBarcodeScannerDialog`.
3. **Preferir componente compartido** (siguiente lote Antigravity/Case): extraer algo tipo `ErpProductSearchBar` / `ErpListSearchBar` desde el patrón de `CatalogPage` en lugar de copiar/pegar JSX en cada página.
4. **No romper CRITICAL:** SaleForm submission, drafts, caja, auth — cambios de buscador solo en UI de búsqueda/listado.
5. **Backend search API** (`GUIA_BUSQUEDA…` pasos 2–4) sigue siendo el camino para catálogos grandes; este estándar FE es **independiente** y puede vivir con filtro en memoria mientras tanto.

### Capas del estándar

| Capa | Obligatorio en pickers de producto | Obligatorio en listados (ventas, clientes, etc.) |
|------|-------------------------------------|--------------------------------------------------|
| Pegar fiable (`onInput`/`onPaste`) | Sí | Sí |
| Sticky toolbar | Sí (si la lista scrollea) | Sí (si la lista scrollea) |
| Limpiar búsqueda (+ filtros si hay) | Sí | Sí |
| Filtros colapsables | Sí si hay ≥2 filtros | Sí si hay ≥2 filtros |
| Escáner barcode/QR | Sí | Solo si el dominio es producto/SKU |
| Autocomplete con thumb | Sí (recomendado) | Opcional (filas de texto suelen bastar) |
| Infinite scroll / sentinel | Sí en grids largos | Sí en tablas/listas largas |
| FAB volver arriba | Sí en pantallas largas | Sí en pantallas largas |

---

## 3. Inventario de pantallas (rollout)

### Tier A — Pickers / listas de **producto** (prioridad alta)

| Pantalla | Archivo | Estado | Notas |
|----------|---------|--------|-------|
| Catálogo | `CatalogPage.jsx` | **Hecho** (PR #25) | Referencia canónica |
| Ventas — Paso 3 productos | `components/sales/SaleForm.jsx` | Parcial | Ya tiene escáner + clear X; falta sticky unificado, paste, autocomplete estilo Catálogo, infinite alineado |
| Inventario | `InventoryPage.jsx` | Pendiente | Buscador + filtros siempre visibles; “Cargar más”; diálogos “Buscar producto/SKU” |
| Transferencias / movimientos con SKU | `ProductTransfersPage.jsx` y diálogos de stock | Pendiente | Auditar pickers al implementar |
| Promociones (si eligen productos) | `PromotionsPage.jsx` | Pendiente | Solo si hay picker de SKU |

### Tier B — Listados de **documentos / entidades** (mismo estilo sticky/limpiar/pegar; sin barcode de producto salvo que aplique)

| Pantalla | Archivo | Estado |
|----------|---------|--------|
| Ventas (facturas/clientes) | `SalesPage.jsx` | Pendiente |
| Cotizaciones | `QuotationsPage.jsx` | Pendiente |
| Clientes | `CustomersPage.jsx` | Pendiente |
| Vehículos | `VehiclesPage.jsx` | Parcial (ya tiene filtros toggle) — alinear sticky/paste/clear |
| Entregas | `DeliveriesPage.jsx` | Pendiente |
| Órdenes de trabajo | `WorkOrdersPage.jsx` | Pendiente |
| Polarizados / tint | `TintOrdersPage.jsx` | Pendiente |
| Devoluciones / Garantías | `ReturnsPage.jsx`, `WarrantiesPage.jsx` | Pendiente |
| Búsqueda universal | `UniversalSearchPage.jsx` → `UniversalSearchPanel` | Auditar y alinear |

### Fuera de alcance inmediato

- Login / PIN / kiosko attendance  
- KDS operativo (salvo que el usuario pida buscar órdenes con el mismo patrón)  
- Páginas sin listado filtrable

---

## 4. Orden de implementación sugerido (post-smoke Catálogo)

1. Extraer componente compartido desde `CatalogPage` (props: `value`, `onChange`, `suggestions?`, `filtersSlot?`, `onScan?`, `sticky`).
2. **SaleForm** Paso 3 — adoptar componente (mantener add-to-cart / compatibles / CRITICAL intactos).
3. **InventoryPage** — toolbar sticky + escáner + limpiar + infinite.
4. Tier B en lotes pequeños (una pantalla o familia por PR).
5. En paralelo (Antigravity): pasos API de `GUIA_BUSQUEDA_PRODUCTOS_RAPIDA.md` (#11 en master).

**Formato de trabajo Antigravity:** lotes pequeños secuenciales (UI por pantalla), no un solo PR gigante. Preferir prompt lote pegable (antes/después + smoke).

---

## 5. Smoke checklist (Catálogo live post-deploy)

- [ ] Pegar un SKU filtra de inmediato  
- [ ] Barra sticky al scrollear  
- [ ] Filtros empiezan cerrados; toggle funciona  
- [ ] Limpiar resetea todo  
- [ ] Escáner abre dialog existente; scan llena búsqueda  
- [ ] Autocomplete click abre Quick View  
- [ ] Infinite scroll carga +30  
- [ ] FAB vuelve arriba y enfoca el input  

---

## 6. Historial breve

| Fecha | Cambio |
|-------|--------|
| 2026-09-19 | PR #25 implementa el patrón en Catálogo; este doc fija el estándar y el rollout ERP-wide |
| 2026-09-12 | `GUIA_BUSQUEDA_PRODUCTOS_RAPIDA.md` — diagnóstico payload 11 MB + plan API (sigue abierto) |
