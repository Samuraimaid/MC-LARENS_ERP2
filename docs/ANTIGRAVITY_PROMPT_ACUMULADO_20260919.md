# Antigravity — Prompt acumulado (Case → workshop) · 2026-09-19

Repo: `Samuraimaid/MC-LARENS_ERP2`  
ERP live: `https://mclarens-erp-836176703716.us-central1.run.app`  
Zona: America/Guatemala  

**Modo:** un solo ciclo merge → implementaciones nuevas → build → deploy Cloud Run.  
**No rehacer** trabajo de datos que Case ya aplicó en live (ver “Ya hecho por Case”), salvo la limpieza de procedencia China (ítem nuevo abajo).

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
| Prompt acumulado docs | PR #15 / este archivo |

---

## Orden de ejecución (obligatorio)

### 1) Merge PRs abiertos (UI ya lista en ramas)

Mergear a `master` en este orden (resolver conflictos mínimos si aparecen):

1. **PR #13** — Build badge muestra deploy id real (no `0.2.0-beta.0` pegado)  
   https://github.com/Samuraimaid/MC-LARENS_ERP2/pull/13  
   Branch: `fix/build-badge-shows-deploy-id`

2. **PR #14** — Quick View / ojito: base de imagen proporcional + lightbox  
   https://github.com/Samuraimaid/MC-LARENS_ERP2/pull/14  
   Branch: `fix/product-quickview-image-aspect-20260918`  
   Archivo: `frontend/src/components/erp/ProductQuickViewDialog.jsx`  

3. **PR #12** (docs, opcional) — prompt ProductThumb versionado  
   https://github.com/Samuraimaid/MC-LARENS_ERP2/pull/12  

4. **PR #15** (docs) — este prompt acumulado  
   https://github.com/Samuraimaid/MC-LARENS_ERP2/pull/15  

Tras merges de #13/#14: `git pull` y preparar deploy **después** de los ítems 2–4 de este prompt (o deploy intermedio + segundo deploy; preferible un solo deploy al final).

---

### 2) Quick View: foto a tamaño completo + carrusel (REFORZAR / completar PR #14)

**Contexto (Xinon, capturas 2026-09-19):**  
En detalle de producto (ej. DLAA `NS2822-LED`), al tocar la foto hoy se hace un **zoom pequeño dentro del mismo cuadro** (`scale` / hover-zoom). Se pierden los bordes y no se ve el detalle. Quiere:

1. Al **tocar/clic** la imagen principal del Quick View → abrir **vista a tamaño completo** (overlay/lightbox a pantalla completa o casi full viewport).
2. En esa vista: **carrusel** con todas las `images[]` del producto.
3. Botones **anterior / siguiente** visibles al **hover** (desktop) y usables en touch (siempre visibles o zona tappable en móvil).
4. Contador tipo `n / total` en la vista ampliada.
5. Cerrar con tap fuera, botón ×, o Escape.
6. **Eliminar** el zoom-in interno dentro del frame (`scale-105` / `scale-150` / hover scale que recorta). La miniatura del detalle puede quedar con `object-contain` sin scale al hover, o hover solo de opacidad en controles.

**Archivos:**  
- `frontend/src/components/erp/ProductQuickViewDialog.jsx` (principal)  
- Revisar que `ProductImageHoverZoom.jsx` no interfiera dentro del dialog (el hover preview flotante es OK en listado; en detalle manda el lightbox).

**QA**
- Abrir DLAA NS2822-LED → tocar foto → fullscreen, se ve el kit completo sin recorte de bordes.
- Avanzar/retroceder por las 6 fotos; thumbnails del dialog pueden sincronizar índice.
- Móvil + desktop.

Commit sugerido: `fix(ui): fullscreen product image carousel in Quick View`.

---

### 3) UI: badge “Universal” (datos ya en live)

**Problema:** productos con `compatibility.is_universal: true` (y a veces `compatibilidad_texto`) siguen mostrando **“Sin datos de compatibilidad”**.

**Fix**
1. Compat presente si `compatibility.is_universal === true` **o** hay `compatibilidad_texto`.
2. Card: badge **Universal** (o texto de `compatibilidad_texto`).
3. Sale-pick: `is_universal` pasa filtro de vehículo.
4. Quick View: mismo criterio si muestra el bloque de compatibilidad.

**Archivos:** `frontend/src/pages/CatalogPage.jsx` (+ Quick View).  
Commit: `fix(ui): show Universal compatibility badge when is_universal`.

---

### 4) Quitar procedencia “China” de todo el catálogo (datos + defensa UI)

**Motivo comercial:** los clientes asocian “hecho en China” / “Lugar de origen: … China” con baja calidad. Hay que **eliminar esa información** de cualquier producto.

**Ejemplo live:** DLAA `NS2822-LED` / `prod_dlaa_ns2822-led`  
Descripción empieza con:  
`Detalles rápidos Lugar de origen: Guangdong, China …`

**Alcance de limpieza (case-insensitive), en campos de texto de producto:**
- `description`, `descripcion`, `name` / `nombre` (solo si el origen está embebido; no borrar el nombre del producto)
- `compatibilidad_texto`, `notes`, `specs`, `attributes` / fichas si existen como string
- Frases / patrones típicos a eliminar o reescribir quitando el origen:
  - `Lugar de origen: … China`
  - `Origen: … China`
  - `Made in China` / `Hecho en China` / `Fabricado en China`
  - `Guangdong, China` / `…, China`
  - Mencionar solo `China` como país de origen en bloques “Detalles rápidos”
- No inventar otro país de origen. Si al quitar la frase queda basura (`Detalles rápidos` solo), limpiar puntuación/espacios dobles.

**Implementación preferida (dos capas):**

**A) Datos (obligatorio)**  
Script o job one-shot autenticado (PIN gerencia / mismo patrón Case) que:
1. `GET /api/products?limit=10000`
2. Detecte matches de procedencia China
3. `PUT /api/products/{id}` con el texto limpio (merge del producto completo)
4. Tag: `scrub_china_origin_20260919`
5. Reporte JSON: `docs/` o `scripts/reports/SCRUB_CHINA_ORIGIN_20260919.json` con `attempted/ok/fail` + sample before/after

**B) UI (recomendado, defensa)**  
Helper `sanitizeProductCopy(text)` usado al **mostrar** description en Catalog / Quick View / SaleForm, que strippea los mismos patrones por si queda algún registro viejo. No sustituye el scrub de datos.

**QA**
- Buscar en live “China” / “Guangdong” en descriptions de activos → 0 (o solo falsos positivos legítimos, documentarlos).
- Abrir `NS2822-LED`: la descripción ya no menciona China ni lugar de origen chino.
- Spot-check 10 SKUs DLAA / Auxbeam / imports.

Commit sugerido: `chore(catalog): scrub China origin from product copy (+ display sanitize)`.

---

### 5) (Opcional / P1) Catálogo search & limit

Solo si 1–4 ya están desplegados y estables. Ver `docs/ANTIGRAVITY_MASTER.md` — solo lo que aún falle en live.

---

## Fuera de alcance

- No wipe/rebuild de marcas.
- No re-subir imágenes DS18/FOX.
- No cambios de precios ni stock.
- No P0 seguridad/AuthZ en este lote.

---

## Entregable al cerrar

1. PRs #13 y #14 mergeados; ítems 2–4 en `master`.  
2. Un deploy Cloud Run con BUILD_ID nuevo.  
3. Checklist PASS/FAIL:
   - Badge de build correcto  
   - Quick View: tap foto → fullscreen + carrusel + flechas hover  
   - Badge Universal en LITTLE TREES / universales  
   - 0 procedencia China en descriptions (sample + búsqueda)  
4. Nota en `memory/chat-log.md` con BUILD_ID y resultados.

Cuando termines, avisa a Xinon con el BUILD_ID y el checklist.
