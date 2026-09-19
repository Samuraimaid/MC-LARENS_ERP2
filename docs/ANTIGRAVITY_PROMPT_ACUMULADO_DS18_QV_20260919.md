# Antigravity — LOTE DS18 ficha completa + Quick View full + fotos PDF · 2026-09-19

Repo: `Samuraimaid/MC-LARENS_ERP2`  
ERP live: `https://mclarens-erp-836176703716.us-central1.run.app`  
Auth API: `POST /api/auth/pin/login` `{"pin":"01011990"}` → `Bearer session_token`  
GCS imágenes: `gs://mclarens-erp-products` / `products/ds18/{SKU}/`  
Windows: **no usar `py`** — `python` o ruta completa / `.ps1`.

Xinon pidió que **esta carga pesada la haga Antigravity** (no Case). Case solo deja este prompt + piloto.

Referencia UI oficial (3 bloques desplegables):  
https://ds18.com/products/ds18-zr1000-1d-class-d-1-channel-monoblock-amplifier-1000-watts-rms-1-ohm

---

## Prioridad

| # | Tarea | Tipo |
|---|--------|------|
| P0 | Quick View casi fullscreen + galería centrada (sin foto en esquina / scroll) | Frontend |
| P0 | 3 acordeones ES (Características / Ficha+PDF / Descripción) | Frontend |
| P1 | Enriquecer **todos** los DS18 activos desde ds18.com → ES + link PDF | Datos/scripts en workshop |
| P1 | Reemplazar fotos mal cortadas del PDF por galería oficial ds18.com | Datos/GCS |

---

## P0 — UI Quick View (`ProductQuickViewDialog.jsx`)

### A) Modal ancho/alto
Xinon autorizó pantalla completa si hace falta.
- Hoy: `max-w-4xl max-h-[92vh]` → **insuficiente**.
- Objetivo: casi `100vw` / `100dvh` (o `min(100vw-1rem, 1400px)` × `min(100dvh-1rem, 960px)`), scroll en el body, 2 columnas desktop (galería | info).

### B) Galería (bug live)
Síntoma: imagen abajo-derecha + scrollbar; a veces “Sin imagen”.
- Stage `relative aspect-[4/3] overflow-hidden` + wrapper `absolute inset-0 flex items-center justify-center`.
- `img`: `object-contain object-center`, **sin** scroll en el stage.
- Flechas solo si ≥2 imágenes válidas.
- Lightbox: fondo **blanco** + mismo centrado.

Smoke layout: `A-CTK-52633`, `No-especificado` (pinitos; Case ya arregló URL `.png`→`.jpg`), `ZR1000.1D`.

### C) Tres acordeones (como ds18.com)

| Acordeón | Título ES | Datos |
|----------|-----------|--------|
| 1 | Características principales | `features[]` si existe; si no, bullets tras “Características principales:” en `description` |
| 2 | Ficha técnica y manual | `specs` object (grid) + botón **Descargar manual (PDF)** |
| 3 | Descripción del producto | overview (resto de `description`) |

**PDF:** ítems en `media[]` con `type === "document"` (o url `.pdf`). Abrir en pestaña nueva. Si no hay, ocultar botón.

**API (Case verificó):**
- `description` + `specs` + `media` **sí** se guardan.
- `features`, `manual_url`, `documents` top-level **NO** persisten hoy → UI debe leer media/document + description/specs. Opcional: extender modelo para `features: string[]`.

Piloto live ya hecho por Case en **ZR1000.1D** (`product_5ee83a00a2b8`): description larga ES, ~39 specs, `media` document con PDF Spanglish ZR amp. Usar ese SKU para smoke UI.

---

## P1 — Datos: enriquecer todo DS18 (PESADO → Antigravity)

### Listado de productos
`GET /api/products?brand=DS18&page=N` **NO pagina** (siempre los mismos ~100, empieza en DX2).  
Usar **`skip`**: `GET /api/products?brand=DS18&limit=100&skip=0|100|200|…` hasta vaciar. Deduplicar por `product_id`.  
Lista de apoyo en repo/docs o GCS si existe: rebuild PDF ~1100–1200 activos (no 3000).

### Por cada SKU activo DS18
1. Resolver URL producto en ds18.com (search por SKU / handle).
2. Scrape:
   - Key Features (bullets)
   - Technical Data (tablas SPECS/AUDIO/FEATURES/MEASUREMENT)
   - Product Overview (prosa)
   - PDF: parsear `manualFile` o links `.pdf` en la página (cdn.shopify / ds18.com/cdn/shop/files/…)
3. Traducir a español claro (unidades Ω, W, Hz, mm se mantienen). **No inventar** specs.
4. `PUT /api/products/{id}`:
   - `description` = overview ES + bloque “Características principales:” con bullets
   - `specs` = dict claves en español
   - `media` = galería existente + `{type:"document", title:"Manual del producto (PDF)", url, filename}` (merge, no borrar fotos)
   - tags: `ds18_detail_blocks_es_20260919` (+ `ds18_manual_pdf` si hay PDF)
5. Checkpoint cada 50 SKUs. Tag para reanudar.
6. Reporte JSON: total / enriched / no_page / no_pdf / errors.

Ejemplo PDF ZR1000:  
`https://ds18.com/cdn/shop/files/ZR_AMP_SPANGLISH_MANUAL_WEB_V1_2_1_fd85a0c9-f259-46ac-94b9-ef2f78b5200e.pdf?v=…`

---

## P1 — Fotos mal cortadas del PDF

Xinon: productos con capturas del catálogo PDF mal recortadas.

1. Auditar primaries DS18: sospechosos = path tipo pdf/scan, aspect raro, texto de página, producto a medias, o no están bajo `products/ds18/{SKU}/01.jpg`.
2. Reemplazar con galería limpia de ds18.com → subir GCS `products/ds18/{SKU}/` → PUT `images` / `image_url` / `media`.
3. Tag `ds18_pdf_crop_fix_20260919`.
4. Reporte before/after. Si no hay web oficial, listar en `unfixed`.

---

## Deploy
1. Commit UI + scripts (si aplica) + este doc en `docs/`.
2. Push + `./deploy.sh` (Cloud Shell / workshop).
3. Hard refresh; verificar `__BUILD_ID__`.
4. Smoke: ZR1000.1D (3 bloques + PDF), 2–3 SKUs más, layout galería, 1 foto que antes estaba cortada.
5. Nota corta en `memory/chat-log.md`.

## Fuera de alcance
- PIN sync (`ENABLE_CANONICAL_PIN_SYNC` off).
- Soft-delete masivo.
- Otras marcas (FOX, LITTLE TREES) salvo smoke layout.

## Notas Case
- PR docs layout previo: https://github.com/Samuraimaid/MC-LARENS_ERP2/pull/19 (fusionar criterios de galería aquí).
- Pinitos live: URL corregida `.jpg` (dato OK; UI layout sigue pendiente de este lote).