# Antigravity — Promo videos (carga, 1080p, blur/totem) + cierre carruseles · 2026-09-19

Repo: `Samuraimaid/MC-LARENS_ERP2`  
ERP: `https://mclarens-erp-836176703716.us-central1.run.app`  
Windows: **no usar `py`** — `python` / ruta completa / `.ps1`.

---

## Bloque A — Carruseles (URGENTE: push + deploy)

Case verificó GitHub: **`3e732cb5` NO está en `origin/master`**. Master remoto sigue en `5cfa75e9`. El push desde el workshop falló (red/GitHub).

1. En el PC Antigravity: `git status` + `git log -1 --oneline`.
2. Si el commit local existe: `git push origin master` hasta que GitHub muestre el commit.
3. Confirmar: https://github.com/Samuraimaid/MC-LARENS_ERP2/commits/master
4. Cloud Shell: `git pull origin master && ./deploy.sh`
5. **Bundles piloto** (`EXL-SQ6-5C`, `GEN-X112LD`): además del seed, hacer **PUT live** de `bundle_skus` (seed solo no actualiza Mongo). Tag `bundle_pilot_20260919`.
6. Nota de alcance: el commit mencionó **P-5 y P-7**; en el prompt Case estaban **pendientes**. No revertir si ya están; documentar en `memory/chat-log.md` que se adelantaron. No ampliar más P-5/P-7 en este lote.

---

## Bloque B — Videos de publicidad (problema reportado por Xinon)

### Síntomas
- Fallos / mala carga de videos de publicidad (login / fondo / totem / settings).
- Quiere: al subir video muy alto → **transcodificar a máx. 1080p**.
- Videos **horizontales** en pantallas altas/totem: en lugar de franjas negras, rellenar con **blur del mismo video** (estilo Apple/YouTube); si hay videos **totem/vertical** disponibles, preferirlos en orientación portrait.

### Contexto técnico (Case)
- Player: `frontend/src/components/auth/BackgroundPromoVideo.jsx` — hoy `object-cover` (recorta; no letterbox+blur).
- Catálogo/URL: `frontend/src/lib/promoVideos.js` → GCS `mclarens-erp-vehicles/videos/promos/…` (varios archivos HEAD 200 OK).
- API: `GET …/promos/videos` (fallback a lista estática si falla).
- Settings upload: `PromotionalVideosSettingsPanel.jsx`.
- Scripts históricos borraron `totem-1` / `totem-2` de Mongo (`clean_and_sync_promo_videos.py`). Revisar si siguen archivos en GCS o hay que re-subir verticales.
- **Seguridad:** varios `scripts/*promo*` tienen **URI de Atlas hardcodeada**. No pegar secretos en chat-log; migrar a env `MONGO_URL` y rotar credencial si sigue en git history (tarea aparte mínima: dejar de hardcodear en código nuevo).

### B1 — Diagnosticar carga (obligatorio)
1. Listar videos activos (API + Mongo + GCS HEAD).
2. Reportar: 404, CORS, MIME, tamaños >X MB, nombres YTDown enormes, orientation mismatch (solo horizontal en portrait).
3. Mejorar player: onError skip más agresivo, no pantallas negras largas; log título/url; opcional poster.
4. Asegurar `resolveDirectPromoVideoUrl` sin redirects 307 en TV.

### B2 — Upload → máx 1080p (obligatorio)
En el flujo de subida de promos (backend y/o script post-upload):
- Si altura > 1080 (o width > 1920): `ffmpeg` scale `-2:1080` (o `1920:-2` manteniendo aspect), H.264 + AAC, `faststart`.
- Guardar/serve la versión 1080p en GCS; no dejar solo el original 4K en el player.
- Documentar dependencia ffmpeg en workshop/Cloud Run job si aplica.
- Campo metadata: `width`, `height`, `transcoded_1080p: true`.

### B3 — Letterbox blur / totem (obligatorio UX)
En `BackgroundPromoVideo` (y preview settings si existe):

**Portrait / totem viewport + video horizontal (o aspect más ancho que el contenedor):**
1. Preferir playlist `orientation: vertical|totem|portrait` si hay activos.
2. Si solo hay horizontal: layout de **dos capas**:
   - Fondo: mismo `<video>` o canvas mirror con `object-cover` + **blur fuerte** (`filter: blur(…) scale(1.1)`).
   - Frente: video nítido con `object-contain` centrado (se ven franjas, pero rellenas de blur, no negro).
3. Si Xinon aún tiene archivos totem en disco/GCS, re-registrar en `promotional_videos` con `orientation: "vertical"`.

**Landscape viewport:** mantener cover o contain según diseño actual; blur opcional solo si letterbox.

### B4 — QA
- Login / fondo promo en móvil portrait y desktop.
- Subir un clip 4K de prueba → GCS sirve ≤1080p.
- Horizontal en pantalla alta: blur visible, sin barras negras.
- Si hay ≥1 vertical: en portrait se elige vertical primero.
- Smart TV: no se queda en negro > unos segundos.

---

---

## Bloque C — Lightbox de producto: fondo blanco (Xinon 2026-09-19)

**Síntoma:** En catálogo, al ver la foto a full size (overlay fullscreen del Quick View), el fondo es **negro**. En productos oscuros (ej. FOX SHOCKS / Hilux, partes negras del amortiguador) se pierden bordes y detalle para el cliente.

**Cambio (IN SCOPE en el próximo deploy de UI):**
1. Archivo principal: `frontend/src/components/erp/ProductQuickViewDialog.jsx` (overlay fullscreen / lightbox).
2. Fondo del stage: de `bg-black/...` a **blanco** (`bg-white` o `bg-zinc-50`), sin oscurecer la foto.
3. Ajustar contraste de UI encima del fondo claro:
   - Texto SKU/nombre, contador `n/total`, botón ×, flechas prev/next: usar **texto/iconos oscuros** o pills con fondo semitransparente claro + borde, no blanco puro sobre blanco.
   - Thumbnails activos: borde primary visible sobre blanco.
4. Mantener `object-contain` (no recortar).
5. No volver al zoom `scale` dentro del frame.

**QA:** Abrir FOX `987-02-089` (o similar oscuro) → tap foto → full size con fondo blanco; negros del producto distinguibles; controles legibles.

Commit sugerido: `fix(ui): white background for product fullscreen lightbox`.

---

---

## Bloque D — Imágenes faltantes + buscador inventario + Ctrl+K vendedores (Xinon 2026-09-19)

### D1 — Productos sin imagen (ej. DLAA `TY1017-LED`)
**Objetivo:** cuando un producto activo no tiene foto usable (placeholder / 404 / vacío), **buscar imagen en internet**, subir a GCS y PUT `images[]` en live.

**Reglas**
1. No buscar en cada page-load del browser (caro/lento). Pipeline/job (script o endpoint admin) + opcional botón “Reintentar imagen” en gerencia.
2. Fuentes: sitio oficial de la marca si existe; distribuidores conocidos; Google/Bing image search solo con match fuerte de SKU+marca+nombre. Preferir PNG/JPG limpio de producto.
3. Si la imagen trae **marca de agua**: intentar limpieza best-effort (crop de banner, inpaint simple, o preferir otra fuente sin watermark). **No** garantizar magia perfecta; documentar fallos. Preferir fuente limpia a “borrar” agresivo que deforme el producto.
4. Guardar en `gs://mclarens-erp-products/products/{brand}/{sku}/…` y actualizar ERP.
5. Reportar JSON: missing → found → uploaded → put OK/fail. Ejemplo prioritario: `TY1017-LED` (y hermanos TY1017 / TY1017E si aplica LED vs halogen).
6. Tag: `img_web_fill_20260919`.

### D2 — Buscador de productos del módulo Inventario no funciona
**Repro:** rol con acceso a Inventario → buscar producto/stock en esa pantalla → no filtra / no encuentra / error.
**Fix:** diagnosticar `InventoryPage.jsx` (+ API `/api/products` o `/api/inventory` que use). Causas típicas: query no cableado, debounce roto, filtro por bodega vacía, 403, case/SKU normalize. Dejar búsqueda usable por SKU, nombre y marca. QA con gerencia/bodegas.

### D3 — “Buscar Producto / Stock” (Ctrl+K) no debe mandar vendedores a Inventario
**Síntoma:** la acción/atajo **Buscar Producto / Stock** (UI muestra Ctrl+K) hace hipervínculo a **Inventario** (`/inventory` o tab inventario), página **prohibida** para vendedores normales (`ventas`). Xinon quiere que para esos roles vaya al **Catálogo** (`/workbench?tab=catalog` o ruta catálogo del workbench), que es lo que deben usar.

**Fix**
1. Localizar el command palette / menú rápido / deep link que etiqueta “Buscar Producto / Stock” (probables: `SaleForm.jsx`, `MainLayout.jsx`, `WorkbenchPage.jsx`, paneles de atajos).
2. Resolver destino por rol:
   - `ventas`, `jefe_vendedores` (y otros seller-restricted vía `isSellerRole` / `usesRestrictedNavigation` en `roleHome.js`): → **`/workbench?tab=catalog`** (o `tab=catalog&mode=sale-pick` si están en flujo de venta — preferir catalog accesible).
   - Roles con inventario permitido (`gerencia`, `supervisor`, `bodegas`, `jefe_tienda`, etc.): pueden seguir a inventario/stock si aplica.
3. Si el atajo abre un buscador modal: que para vendedores busque en catálogo/productos de venta, **no** navegue a `/inventory`.
4. QA: login PIN ventas → Ctrl+K / esa opción → aterriza en catálogo, sin error de permiso ni pantalla en blanco de inventario.

Commit sugerido: `fix(nav): seller product search goes to catalog not inventory`.

---

## Fuera de alcance
- No wipe catálogo productos.
- No rehacer lightbox/Universal/China scrub.
- No implementar reviews DS18.

## Entregable
1. Push carruseles verificado en GitHub + deploy BUILD_ID.
2. PUT live bundles piloto.
3. Commit videos (transcode + blur UI + diagnóstico).
4. Lightbox producto fondo **blanco** (Bloque C) en el mismo o siguiente commit UI.
4. `memory/chat-log.md` con BUILD_ID, lista de videos rotos arreglados, y si totems volvieron.

Commits sugeridos:
- `fix: push related/FBT carousels + live pilot bundles`
- `feat(promos): 1080p transcode on upload + blur letterbox for horizontal on portrait`
