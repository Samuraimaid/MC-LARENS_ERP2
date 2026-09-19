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
- Título sugerido: **Productos relacionados** (rojo/acento del tema ERP, no necesariamente rojo DS18).
- Cards horizontales con flechas `<` `>` (hover desktop; touch swipe o botones siempre visibles en móvil).
- Cada card: imagen (`ProductThumb` / `object-contain`), SKU, nombre corto, precio dual US$/C$ (mismo formatter actual), botón **Agregar a venta** / **Agregar a cotización** (respetar props del dialog: `onAddToCart` / `onAddToQuote`).
- Click en la card (fuera del botón) → abrir ese producto en el mismo Quick View (cambiar `product`).

### C) Carrusel “Se venden juntos” / Completá el sistema
- Título sugerido: **Se venden juntos** o **Completá el sistema**.
- Misma UI de cards.
- Contenido orientado a **kits de instalación / complementos**, no solo “misma categoría”:
  - Ej. parlante midbass / coax → amplificador 4 canales, kit cableado calibre 4, fusible, RCA, condensador si existan en catálogo.
  - Ej. neblineras → switch, arnés, relay si hay SKUs.
  - Ej. faros → kit de instalación / ballast solo si hay productos reales.

**No inventar productos.** Solo SKUs que existan en el catálogo live/API.

---

## Lógica de recomendación (MVP, sin ML)

Implementar helpers puros (ej. `frontend/src/lib/productRecommendations.js`):

### Relacionados (prioridad)
1. Misma `brand` + misma `category` o `subcategory`, excluir producto actual.
2. Si pocos: misma brand.
3. Si pocos: misma category.
4. Límite 8–12; preferir `is_active` y con imagen.

### Se venden juntos (heurística por keywords / categoría)
Mapa simple (español + inglés) configurable al tope del helper, ejemplos:

| Producto actual (señales) | Buscar en catálogo |
|---------------------------|--------------------|
| midbass, midrange, woofer, coax, componente, parlante, speaker | amplificador / amp + `4 canal` / `4 channel`; kit cableado / wiring / calibre 4 / AWG 4; RCA |
| subwoofer, sub | amp monoblock / 1 canal; kit calibre 4 u 8; caja |
| led, faro, fog, neblina, driving light | switch, arnés, relay, cableado |
| pantalla, radio, headunit | arnés, antena, cámara, RCA |

Matching: `name` + `description` + `category` + `sku` (case-insensitive). Excluir el SKU actual. Límite 6–8.

Si no hay matches: **ocultar** la sección (no mostrar vacío).

Opcional P1 (no bloqueante): campo futuro `related_skus[]` / `bundle_skus[]` en producto para overrides manuales; si existe, tiene prioridad sobre la heurística.

---

## UI / componentes

- Nuevo componente reutilizable, ej. `ProductCarouselSection.jsx` (título, items, onAdd, onOpenProduct).
- Integrar **dentro del scroll** del Quick View, debajo de descripción/precios (no tapar footer de acciones).
- Sticky bar tipo DS18 (“ADD TO CART” fijo abajo) = **opcional P2**; el ERP ya tiene footer Cerrar / WhatsApp / Cotización / Venta — no duplicar salvo que quepa sin pelear con el footer actual.
- Reusar `formatCurrency` / precios duales y `sanitizeProductCopy` en nombres/desc mostrados.
- Accesible: botones con `aria-label`, teclado en flechas del carrusel.

---

## Fuera de alcance

- No clonar ratings/estrellas/reviews de DS18 (no hay reviews en ERP).
- No swatches de color/tamaño Shopify salvo que el ERP ya tenga variantes reales.
- No scrape de ds18.com en runtime.
- No cambiar precios ni stock.

---

## QA

1. Abrir un DS18 midbass (ej. familia PRO-X) → ver **Productos relacionados** con otros midbass/PRO.
2. Misma ficha → **Se venden juntos** con amp / kit cableado si existen en catálogo.
3. Agregar desde el carrusel a venta/cotización sin cerrar bugs de estado.
4. Producto sin matches → secciones ocultas.
5. Móvil: swipe o botones usables; no romper lightbox.

---

## Entregable

1. Commit/PR en `master` (o rama + merge).
2. Deploy Cloud Run.
3. Nota en `memory/chat-log.md` + BUILD_ID.
4. 2–3 capturas o SKUs de prueba usados.

Commit sugerido: `feat(ui): related + frequently-bought-together carousels in Quick View`.
