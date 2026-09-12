# Reporte de daños — Catálogo, imágenes y búsqueda (ERP live)

**Fecha:** 2026-09-12  
**Repo:** https://github.com/Samuraimaid/MC-LARENS_ERP2  
**Live:** https://mclarens-erp-836176703716.us-central1.run.app  
**QA API:** login gerencia vía `POST /api/auth/pin/login` + `GET /api/products`  
**Comparado contra:** carpetas `catalogos/*` en `master` + scripts `scripts/build_unified_product_seeds.py`, `scripts/download_and_rename_catalog_images.py`

> No incluye secretos/PINs. Validación UI en navegador en paralelo; hallazgos abajo son medibles por API.

---

## Resumen ejecutivo

| # | Daño | Severidad | Evidencia |
|---|------|-----------|-----------|
| D1 | **Imágenes rotas masivas** | **P0 UX/ops** | ~**82%** 404 en muestra n=120 de rutas `/uploads/products/…` |
| D2 | **Búsqueda lenta / UI se traba** | **P0 perf** | `GET /api/products` devuelve **3657** productos ≈ **11.4 MB**; `?limit=20` **no filtra**; FE filtra en cliente (`CatalogPage` / `SalesPage`) |
| D3 | **Huecos de catálogo vs repo** | **P1 datos** | Auxbeam **194** en repo vs **177** live (−17). Conteos DLAA repo (142) ≠ live (970) → semillas mezcladas / histórico |
| D4 | **Política de media incumplida** | **P1** | Seeds apuntan a GCS `mclarens-erp-products`, pero Mongo guarda paths relativos `/uploads/products/{SKU}_main.*` que **no existen** en el contenedor Cloud Run ni (muestra) en el bucket |
| D5 | **OpenAPI roto** | P2 | `GET /openapi.json` → **500** (dificulta QA/automatización) |

---

## 1. Qué hay en live vs qué hay en GitHub

### 1.1 Productos en Mongo (live) — 3657

Marcas principales (API):

| Marca live | Cantidad | Carpeta repo `catalogos/` | README repo |
|------------|----------|---------------------------|-------------|
| DLAA | 970 | `dlaa/` | 142 scrape Shopify (live tiene mucho más: p.ej. halogenos OEM) |
| DS18 | 819 | `ds18_2021/` | 820 |
| FOX SHOCKS | 631 | `Fox/` | 632 |
| AFN 4X4 | 220 | `AFN/` | 220 |
| KEKO | 212 | `KEKO/` | 212 |
| Meguiar's | 210 | `Meguiars/` | 210 |
| Auxbeam | **177** | `auxbeam_driving_light/` | **194** ← **faltan ~17** |
| Pioneer | 158 | `Pioneer/` | 157 |
| Marcas Fernández Sera (ABRO, GOLDEN SUPREME, FORMULA 1, …) | ~distribuidas | `Fernandez_Sera/` | 201 |

**Conclusión productos:** casi todos los catálogos Grok **sí están importados** a Mongo. El problema “no muestra todos” es más bien:

1. **Imágenes rotas** → parece que “faltan” productos nuevos.
2. **Búsqueda/filtros lentos** → sensación de catálogo incompleto o trabado.
3. **Auxbeam −17** es un hueco real de datos.

### 1.2 Imágenes

Campo `images[0]` en live:

- **3626 / 3657** paths relativos tipo `/uploads/products/{SKU}_main.jpg` (o `dlaa_halogens/…`)
- **26** placeholders Unsplash
- **5** sin imagen (servicios)

Muestreo GET (Range) n=120 sobre host live:

- **404: 98 (81.7%)** → extrapola ≈ **~2960** thumbs rotas
- **206 OK: 22** — en la muestra **solo DLAA** bajo `/uploads/products/dlaa_halogens/…` (y `Content-Length: 65` en varios: revisar si son archivos reales o stubs)

Los mismos filenames en  
`https://storage.googleapis.com/mclarens-erp-products/products/{file}`  
también devolvieron **404** en la muestra de fallidos → **no se subió el binario** (ni a uploads del deploy ni al bucket).

Scripts del repo esperan:

1. `build_unified_product_seeds.py` → URLs GCS `…/mclarens-erp-products/products/{SKU}_main.ext`
2. `download_and_rename_catalog_images.py` → copia a `frontend/public/uploads/products/`

En producción Cloud Run el FS del contenedor es **efímero**: subir solo a `frontend/public/uploads` en build **sin** meter los ~GB de fotos en la imagen Docker, o sin sync a GCS, deja paths huérfanos.

Ejemplos 404 (live):

- `/uploads/products/G191700-01_main.jpg` (Meguiar's)
- `/uploads/products/DMH-AP6850BT_main.jpg` (Pioneer)
- `/uploads/products/77725468_main.jpg` (Auxbeam)
- `/uploads/products/FHSANL_main.jpg` (DS18)
- `/uploads/products/883-06-230_main.jpg` (FOX)
- `/uploads/products/A-PW-400_main.png` (ABRO / Fernández Sera)

---

## 2. Por qué la búsqueda “se laguea”

### Evidencia código + API

1. `CatalogPage.jsx` carga **todo**:
   ```js
   axios.get(`${API}/products`, { withCredentials: true })
   ```
2. Filtra en memoria en cada tecla (`useMemo` sobre `products.filter` con `includes` en name/sku/brand/category/subcategory) — **sin debounce**.
3. `SalesPage.jsx` igual: carga `/api/products` completo; `filteredProducts` hace `.filter(...).slice(0, 30)` en cliente.
4. Backend: `GET /api/products?limit=20` **sigue devolviendo 3657 ítems / 11.4 MB** (~2.5–3.2 s en QA). No hay `/api/products/search?q=` (404).

Eso explica freeze al tipear: cada keystroke re-filtra miles de objetos + re-render de grid con `<img>` 404.

Detalle de mitigación: ver `docs/GUIA_BUSQUEDA_PRODUCTOS_RAPIDA.md`.

---

## 3. Qué se puede corregir y cómo (para Antigravity)

### P0-A — Restaurar imágenes (orden recomendado)

1. **Inventario de rotas**  
   Script: para cada producto, HEAD/GET `images[0]`; exportar CSV `sku,brand,path,status`.
2. **Fuente de verdad binaria**  
   Preferir archivos en `catalogos/<marca>/imagenes/` + URLs CDN del JSON (`imagen_fuente_url` / Shopify).  
   Correr (o rehacer) `download_and_rename_catalog_images.py` → `{SKU}_main` / `{SKU}_add_NN`.
3. **Subir a GCS** (alineado a `POLITICAS_CAMBIOS_CODIGO.md` / seeds):  
   `gs://mclarens-erp-products/products/`  
   No depender del disco del contenedor Cloud Run.
4. **Reescribir Mongo**  
   `images: ["https://storage.googleapis.com/mclarens-erp-products/products/{SKU}_main.jpg", …]`  
   Batch por marca (empezar Meguiar's, Pioneer, Auxbeam, Fernández Sera — los “nuevos” que Xinon ve rotos).
5. **Placeholder FE**  
   Si `onError` en `<img>`, mostrar silueta / iniciales marca (evita icono roto aunque falte archivo).
6. **CI/check**  
   Post-import: fallar deploy o job si tasa 404 imágenes > umbral (p.ej. 2%).

**Done cuando:** muestreo ≥95% 200 en thumbs de marcas importadas Grok; catálogo visualmente completo en `/catalog`.

### P0-B — Búsqueda usable (ver guía)

1. Backend: `GET /api/products?q=&limit=&cursor=` + proyección liviana (sin specs/description largas en listado).
2. Índice Mongo texto o campos indexados `sku`, `name`, `brand`.
3. FE: debounce 200–300 ms; **no** hidratar 11 MB al montar Catalog/Sales.
4. Respetar `limit` (hoy ignorado = bug).

### P1 — Datos Auxbeam −17

Diff `catalogos/auxbeam_driving_light/catalogo.json` SKUs vs live `brand=Auxbeam`; importar faltantes + imágenes.

### P1 — Clarificar DLAA 142 vs 970

Documentar origen de los ~800 extra (halogens OEM). No borrar a ciegas; solo unificar esquema de `images[]`.

### P2 — `/openapi.json` 500

Reparar generación OpenAPI (rompe tooling QA).

---

## 4. Qué NO es el problema principal

- No es (solo) “faltó push a GitHub”: Fox/KEKO/AFN/Meguiar's/etc. **ya están** en Mongo.
- No hace falta microservicios ni RAG para esto.
- Rate limit PIN (R-042) es otro hilo; no arregla catálogo.

---

## 5. Checklist inmediato (dueño ops / Antigravity)

- [ ] Job de sync imágenes → GCS + update Mongo URLs
- [ ] Endpoint search/paginación productos + FE debounce
- [ ] Diff Auxbeam 194 vs 177
- [ ] Placeholder `onError` en Catalog/Sales
- [ ] Smoke: gerencia abre `/catalog`, busca `meg`, `pioneer`, `fox` < 300 ms percibidos tras debounce
- [ ] Fix `limit` en `GET /api/products`

---

## 6. Referencias repo

- `frontend/src/pages/CatalogPage.jsx` (carga total + filter cliente)
- `frontend/src/pages/SalesPage.jsx` (`filteredProducts` cliente)
- `scripts/build_unified_product_seeds.py` (prefijo GCS)
- `scripts/download_and_rename_catalog_images.py`
- `docs/PROCEDIMIENTO_CATALOGOS.md`
- `docs/GUIA_BUSQUEDA_PRODUCTOS_RAPIDA.md` (hermana de este reporte)
- Issues relacionados perf: #8, #9; R-054 paginación/proyección en `ANTIGRAVITY_APLICAR_TODO.md`
