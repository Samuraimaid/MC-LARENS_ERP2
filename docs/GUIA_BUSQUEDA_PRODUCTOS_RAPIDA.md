# Guía — Búsquedas de productos más rápidas (McLarens ERP)

**Fecha:** 2026-09-12  
**Contexto:** Live carga **3657** productos ≈ **11.4 MB** en `GET /api/products`; el FE filtra en memoria sin debounce. Por eso el buscador se siente “lag”.

Relacionado: `docs/REPORTE_DANOS_CATALOGO_IMAGENES.md`, R-054 (paginación/proyección), issue #8.

---

## Objetivo

Al tipear en Catálogo / Ventas:

- Primera respuesta útil **&lt; 300 ms** tras soltar tecla (con debounce).
- Payload de listado **&lt; 200 KB** por página (meta razonable).
- Sin descargar el catálogo entero al abrir la pantalla.

---

## Diagnóstico actual (no reinventar)

| Capa | Hoy | Efecto |
|------|-----|--------|
| API | `GET /api/products` sin paginar; `limit` ignorado | 11 MB, 2–3+ s |
| API search | no existe `/api/products/search` | 404 |
| CatalogPage | `products.filter` en cada cambio de `search` | CPU + re-render |
| SalesPage | igual + `.slice(0,30)` | sigue costando filtrar 3657 |
| Imágenes | miles de `<img>` 404 | peor jank |

---

## Plan de implementación (ordenado)

### Paso 1 — Debounce + no buscar en vacío (FE, rápido, P0 parcial)

Archivos: `CatalogPage.jsx`, `SalesPage.jsx` (y cualquier picker de producto).

1. Debounce del input **200–300 ms** (`useDeferredValue` o hook debounce).
2. Si `query.length < 2` (salvo scanner/SKU exacto): no filtrar todo el universo; mostrar “Escribe 2+ caracteres” o últimos recientes.
3. Virtualizar grid (`react-window` / similar) o paginar UI de 24–48 cards.
4. `img onError` → placeholder (reduce layout thrash de iconos rotos).

**Done:** tipear “meg” no congela el tab aunque el API viejo siga gordo.

### Paso 2 — API listado liviano + `limit` real (BE, P0)

`GET /api/products`:

```
q?: string
brand?: string
category?: string
limit?: int = 48   # HARD CAP max 100
cursor?: string    # o skip
fields=list        # proyección
```

Proyección listado (ejemplo):  
`product_id, sku, name, brand, category, subcategory, price, images (solo [0]), is_active`  
**Excluir** en list: `description` largo, `specs`, `compatibility` pesada, `erp_matched_blueprint`, etc. (van en `GET /api/products/{id}`).

**Bug a cerrar:** hoy `limit=20` se ignora — debe respetarse.

Respuesta sugerida:

```json
{
  "items": [ /* ≤ limit */ ],
  "next_cursor": "...",
  "total_estimate": 3657
}
```

### Paso 3 — Búsqueda server-side (BE, P0/P1)

Opción A (rápida en Mongo):

```js
// índices
{ sku: 1 }
{ brand: 1, name: 1 }
{ name: "text", sku: "text", brand: "text", category: "text" }
```

Query:

- Si `q` parece SKU (`^[A-Za-z0-9_-]{3,}$`): `sku` prefix / exact primero.
- Else: `$text` o regex anclada case-insensitive en `name`/`brand` **con límite**, nunca full collection en FE.

Opción B (después): Atlas Search si el catálogo supera ~10–20k.

Endpoint dedicado opcional: `GET /api/products/search?q=meg&limit=30`  
(evita romper clientes viejos de `/api/products`).

### Paso 4 — FE consume search API

1. Quitar `axios.get('/products')` masivo del mount de Catalog/Sales.
2. Al debounced `q` / filtros → llamar API paginada.
3. Prefetch página 1 al abrir (48 items activos).
4. Cache React Query / SWR por `(q, brand, cursor)` 30–60 s.

### Paso 5 — Medir

| Métrica | Antes (QA 2026-09-12) | Meta |
|---------|----------------------|------|
| Tamaño `/api/products` | 11.4 MB | list ≤ 200 KB |
| Tiempo `/api/products` | ~2.5–3.2 s | search p95 &lt; 400 ms |
| Keystroke Catalog | jank perceptible | sin freeze |

Añadir log/timing `X-Response-Time` o métrica en Cloud Run.

---

## Criterios “Done” para Antigravity

- [ ] `GET /api/products?limit=48` devuelve **≤ 48** items
- [ ] `GET /api/products?q=meg&limit=30` (o `/search`) &lt; 400 ms p95 con proyección liviana
- [ ] Catalog/Sales **no** descargan 11 MB al montar
- [ ] Debounce ≥ 200 ms en inputs de producto
- [ ] Test: 3657 productos en DB; buscar `pioneer`, `fox`, `G1917` usable en caja
- [ ] Documentar breaking change si algún cliente dependía del array completo (HyperVisor, exports → endpoint `/api/products/export`)

---

## Anti-patrones (no hacer)

- No meter Elasticsearch “por ahora” si Mongo + índice basta.
- No cachear 11 MB en `localStorage`.
- No filtrar compatibilidad vehicular pesada en cada keystroke sin worker/debounce.
- No servir imágenes desde disco Cloud Run; GCS + URL absoluta (ver reporte de daños).

---

## Enlace con seeds/catálogos

Tras arreglar search, el import desde `catalogos/*/catalogo.json` debe:

1. Upsert por SKU
2. Escribir `images` ya como URL GCS pública
3. Correr check 404 post-import

Sin eso, la búsqueda rápida seguirá mostrando cards rotas (mala UX aunque sea veloz).
