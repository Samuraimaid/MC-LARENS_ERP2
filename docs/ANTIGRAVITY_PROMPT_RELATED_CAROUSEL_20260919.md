# Antigravity — Carruseles tipo DS18 (relacionados + se venden juntos) · 2026-09-19

Repo: `Samuraimaid/MC-LARENS_ERP2`  
Referencia UX: https://ds18.com/es/collections/shop-all/products/pro-series-midrange-bullet-loudspeaker-1  
Capturas Case: thumbs en Quick View + secciones “RELATED PRODUCTS” / “YOU MAY ALSO LIKE” / sticky CTA.

**Contexto:** Xinon quiere el mismo *tipo* de carrusel que DS18, adaptado al ERP (ventas/catálogo), no clonar la marca DS18 ni ratings/reviews de Shopify.

**Prerrequisito:** el lote anterior (`5cfa75e9`) ya debe estar en `master` y desplegado (lightbox fullscreen, Universal, sanitize). Este prompt es **nuevo** encima de eso.

**Windows:** no usar launcher `py`; usar `python`, ruta completa o `.ps1`.

---

## Objetivo UX

En **ProductQuickViewDialog** (y, si es natural, en una vista detalle más larga):

### A) Galería principal (ya casi cubierta por lightbox)
- Mantener thumbs horizontales bajo la foto principal (como DS18).
- Tap → lightbox fullscreen con carrusel (ya en lote previo). No rehacer si ya está en live.

### B) Carrusel “Productos relacionados”
- Título sugerido: **Productos relacionados** (acento del tema ERP).
- Cards horizontales con flechas `<` `>` (hover desktop; touch swipe o botones siempre visibles en móvil).
- Cada card: imagen (`ProductThumb` / `object-contain`), SKU, nombre corto, precio dual US$/C$, botón **Agregar a venta** / **Agregar a cotización** (respetar `onAddToCart` / `onAddToQuote`).
- Click en la card (fuera del botón) → abrir ese producto en el mismo Quick View.

### C) Carrusel “Se venden juntos” / Completá el sistema
- Título sugerido: **Se venden juntos** o **Completá el sistema**.
- Misma UI de cards + selección múltiple (ver § E).
- Contenido: kits de instalación / complementos (amp, cableado, etc.) — ver lógica abajo.
- **No inventar productos.** Solo SKUs del catálogo.

### D) Bundles manuales (prioridad sobre heurística) — IN SCOPE
Campo opcional en producto (JSON), cualquiera de estos nombres si ya existe convención; si no, usar:

```json
"bundle_skus": ["SKU-AMP-4CH", "SKU-KIT-AWG4"]
```

o, si prefieren objetos:

```json
"bundle_items": [
  { "sku": "SKU-AMP-4CH", "qty": 1 },
  { "sku": "SKU-KIT-AWG4", "qty": 1 }
]
```

**Reglas**
1. Si el producto actual tiene `bundle_skus` / `bundle_items` no vacíos → esos SKUs son la fuente **principal** del carrusel “Se venden juntos” (resolver contra catálogo live; omitir SKUs inexistentes/inactivos).
2. La heurística por keywords solo **rellena** hasta el límite si el bundle manual trae pocos ítems (o si no hay bundle).
3. Documentar en `docs/` o comentario del helper cómo cargar/editar bundles (PUT producto o seed). Gerencia debe poder fijar “con este midbass vendemos este kit” sin depender del algoritmo.
4. Tag o nota en chat-log si se añade un ejemplo de bundle en 1–2 SKUs piloto (opcional).

### E) “Agregar selección a la venta” — IN SCOPE
En el carrusel **Se venden juntos**:
- Checkbox por ítem (default: todos marcados, o solo los del bundle manual — documentar la elección; preferible **todos los visibles marcados**).
- Botón destacado: **Agregar selección a la venta** (y equivalente cotización si `onAddToQuote` existe): agrega en un solo paso todos los SKUs checked (qty del bundle o 1).
- No hace falta abrir ficha por ficha.
- Respetar stock/permisos igual que un add individual; si uno falla, reportar cuáles sí entraron.
- El add individual por card se mantiene.

---

## Lógica de recomendación (MVP)

Helper: `frontend/src/lib/productRecommendations.js` (o similar).

### Relacionados
1. Misma `brand` + misma `category`/`subcategory`, excluir actual.
2. Si pocos: misma brand → misma category.
3. Límite 8–12; preferir `is_active` con imagen.

### Se venden juntos — orden de fuentes
1. **Bundle manual** (`bundle_skus` / `bundle_items`) — primero.
2. **Heurística keywords** (español + inglés) para rellenar:

| Señales en producto actual | Buscar |
|----------------------------|--------|
| midbass, midrange, woofer, coax, componente, parlante, speaker | amp / amplificador + 4 canal / 4 channel; kit cableado / wiring / calibre 4 / AWG 4; RCA |
| subwoofer, sub | amp monoblock / 1 canal; kit calibre 4 u 8; caja |
| led, faro, fog, neblina, driving light | switch, arnés, relay, cableado |
| pantalla, radio, headunit | arnés, antena, cámara, RCA |

Matching: `name` + `description` + `category` + `sku`. Excluir SKU actual. Si no hay matches ni bundle → **ocultar** sección.

---

## UI / componentes

- `ProductCarouselSection.jsx` (título, items, selection, onAddOne, onAddSelection, onOpenProduct).
- Dentro del scroll del Quick View, debajo de descripción/precios; no tapar footer Cerrar / WhatsApp / Cotización / Venta.
- Sticky bar tipo DS18 = fuera de alcance (el ERP ya tiene footer).
- Reusar precios duales + `sanitizeProductCopy`.
- Accesible: `aria-label`, teclado en flechas.

---

## Pendientes (NO implementar en este lote — solo dejar anotado)

Xinon quiere estas ideas **registradas como pendientes** para un prompt futuro; **no** las codes en este ciclo:

### P-5 · Filtro por compatibilidad de vehículo
Si hay vehículo en contexto (sale-pick / `catalog_source_context`), filtrar relacionados y FBT por compatibilidad con ese vehículo **más** universales (`is_universal`). Objetivo: menos “no le sirve” en mostrador.

### P-7 · Caps y orden de ranking
Máx. ~8 cards; orden sugerido: bundle manual → con stock en bodega activa → misma subcategoría → resto. Evitar carruseles infinitos y priorizar lo vendible hoy.

(Cuando Xinon pida el siguiente lote Case, subir P-5 y P-7 a IN SCOPE.)

---

## Fuera de alcance (este lote)

- Ratings/estrellas/reviews DS18.
- Swatches Shopify sin variantes reales en ERP.
- Scrape ds18.com en runtime.
- Cambiar precios/stock.
- P-5 y P-7 (arriba).
- Sticky ADD TO CART duplicando el footer.

---

## QA

1. DS18 midbass → **Productos relacionados** con otros midbass/PRO.
2. Misma ficha con `bundle_skus` → **Se venden juntos** muestra esos SKUs primero.
3. Checkboxes + **Agregar selección a la venta** mete varios ítems de una vez.
4. Sin bundle ni matches → sección FBT oculta.
5. Móvil: swipe/botones OK; lightbox intacto.
6. Confirmar que P-5/P-7 **no** se implementaron (solo docs/comentarios “pending”).

---

## Entregable

1. Commit/PR + merge a `master`.
2. Deploy Cloud Run.
3. `memory/chat-log.md` + BUILD_ID.
4. Mencionar 1–2 SKUs de prueba (con y sin bundle manual).

Commit sugerido: `feat(ui): related + FBT carousels with manual bundles and multi-add`.


## Nota UI (2026-09-19)
Lightbox fullscreen del Quick View: usar **fondo blanco** (no negro) para no perder detalle en productos oscuros (FOX, etc.). Controles en contraste oscuro.
