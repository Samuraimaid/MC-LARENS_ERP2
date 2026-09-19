# Antigravity — Prompt acumulado (Case → workshop) · 2026-09-19

Repo: `Samuraimaid/MC-LARENS_ERP2`  
ERP live: `https://mclarens-erp-836176703716.us-central1.run.app`  
Zona: America/Guatemala  

**Modo:** un solo ciclo merge → build → `./deploy.sh` (o el deploy habitual a Cloud Run).  
**No rehacer** trabajo de datos que Case ya aplicó en live (ver “Ya hecho por Case”).

---

## Ya hecho por Case (NO repetir)

| Área | Estado |
|------|--------|
| DS18 galerías oficiales → GCS + PUT `images[]` | Live |
| DS18 descontinuados fuera de PDF | Soft-delete + tag `ds18_discontinued_no_pdf_gallery_20260918` |
| DS18 copy ES (nombre/desc) | Live, tag `ds18_copy_es_20260918` |
| FOX SHOCKS extensiones / URLs GCS | Live: ~626/631 OK; tag `fox_img_fix_20260918` |
| PR-2 ProductThumb + `productImage.js` | Ya en `master` (`f0b28cd1`) |
| PR-3 rewrite extensiones (FOX/KEKO/…) | Datos live ya corregidos |
| Compat `is_universal` en productos (LITTLE TREES, etc.) | **Datos** live; **UI** pendiente (abajo) |

---

## Orden de ejecución (obligatorio)

### 1) Merge PRs abiertos (UI ya lista en ramas)

Mergear a `master` en este orden (resolver conflictos mínimos si aparecen):

1. **PR #13** — Build badge muestra deploy id real (no `0.2.0-beta.0` pegado)  
   https://github.com/Samuraimaid/MC-LARENS_ERP2/pull/13  
   Branch: `fix/build-badge-shows-deploy-id`

2. **PR #14** — Quick View / ojito: imagen proporcional (no se deforma)  
   https://github.com/Samuraimaid/MC-LARENS_ERP2/pull/14  
   Branch: `fix/product-quickview-image-aspect-20260918`  
   Archivo: `frontend/src/components/erp/ProductQuickViewDialog.jsx`  
   - Sintoma: listado OK; al abrir ojito la foto se agranda y se desproporciona.  
   - Fix ya en la rama: `object-contain` intrínseco + lightbox fullscreen (sin `scale-150`) + fallback `/uploads/`→GCS.

3. **PR #12** (docs, opcional) — prompt ProductThumb versionado  
   https://github.com/Samuraimaid/MC-LARENS_ERP2/pull/12  
   Solo docs; merge si no estorba.

Tras merges: `git pull origin master` y **deploy** a Cloud Run.

**QA post-deploy #13+#14**
- Badge del ERP muestra `BUILD …` con id/fecha del deploy actual (no beta vieja).
- Catálogo → Auxbeam u otro con foto → ojito: imagen centrada y proporcional.
- Tap en la foto → lightbox a pantalla completa sin estirar.
- Miniaturas / flechas de galería siguen OK.

---

### 2) UI: badge “Universal” (datos ya en live)

**Problema:** productos con `compatibility.is_universal: true` (y a veces `compatibilidad_texto`) siguen mostrando **“Sin datos de compatibilidad”** en cards.

**Causa:** `hasStructuredCompatibility` en `CatalogPage.jsx` solo mira brands/models/vehicle_types/años — ignora `is_universal` y `compatibilidad_texto`.

**Fix**
1. Compat presente si `compatibility.is_universal === true` **o** hay `compatibilidad_texto`.
2. Card: badge **Universal** (o el texto de `compatibilidad_texto`) en lugar de “Sin datos…”.
3. Sale-pick / filtro vehículo: `is_universal` **debe pasar** el filtro (`isProductCompatibleWithVehicle` → true).
4. Revisar Quick View si muestra el mismo bloque de compatibilidad.

**Archivos:** `frontend/src/pages/CatalogPage.jsx` (+ Quick View si aplica).  
**Detalle:** `docs/` o handoff Case `ANTIGRAVITY_COMPAT_UNIVERSAL_UI_20260918.md`.

**QA:** LITTLE TREES / ambientadores universales → badge Universal; en venta con vehículo seleccionado siguen apareciendo.

Commit sugerido: `fix(ui): show Universal compatibility badge when is_universal`.

---

### 3) (Opcional / P1 si hay tiempo) Catálogo search & limit

Solo si el ciclo anterior ya está desplegado y estable:

- Revisar búsqueda/limit/paginación del catálogo (chips, lag con catálogos grandes).
- No tocar backend de auth ni PINs en este prompt.
- Referencia histórica: `docs/ANTIGRAVITY_MASTER.md` / `ANTIGRAVITY_APLICAR_TODO.md` secciones P0 search — **solo lo que aún falle en live**.

---

## Fuera de alcance de este prompt

- No wipe/rebuild de marcas.
- No re-subir imágenes DS18/FOX (Case ya lo hizo).
- No cambios de precios ni stock demo.
- No P0 seguridad/AuthZ en este lote (otro prompt aparte si Xinon lo pide).

---

## Entregable al cerrar

1. PRs #13 y #14 mergeados + deploy live verificado (badge + ojito).  
2. Commit/PR del badge Universal + smoke en catálogo/ventas.  
3. Nota corta en `memory/chat-log.md` (Antigravity) con BUILD_ID desplegado y checklist PASS/FAIL.

Cuando termines, avisa a Xinon con el BUILD_ID nuevo y los 3 checks de QA.
