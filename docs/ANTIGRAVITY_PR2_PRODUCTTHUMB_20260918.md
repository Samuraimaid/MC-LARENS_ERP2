# Antigravity PR-2 — ProductThumb + onError placeholder (Catálogo / Ventas)

**Uso:** pega este documento completo a Antigravity como único prompt de trabajo para **PR-2**.  
**Repo:** `Samuraimaid/MC-LARENS_ERP2` · branch `master`  
**Live:** `https://mclarens-erp-836176703716.us-central1.run.app`  
**Owner producto:** Xinon · **Código:** Antigravity · **Datos/ops:** Case (ya ejecutó rewrite de extensiones + rebuild DS18 en live; **no** tocar datos/GCS en este PR)

| Campo | Valor |
|-------|--------|
| PR | **PR-2** (= PR-A / P0.3 del plan imágenes 2026-09-18) |
| Depende de | PR-1 (nav vendedor / precios / compat) puede ir en paralelo; **no** bloquea este PR |
| Datos live | Case ya reescribió `images[]` a URL GCS absolutas con extensión real (FOX SHOCKS ~600 mismatch, KEKO, GOLDEN SUPREME, BRAVA, ABRO, COOLZONE, LITTLE TREES, Auxbeam y cluster Fernández Sera / chem). Residual truly-missing documentado abajo — **no** inventar URLs. |

**Prohibido en commits / descripción de PR / comentarios:** PINs, cookies, session tokens, JSON de service account, secretos de GCS.

Alinea con `ANTIGRAVITY_MASTER.md` y `erp_docs/img_sync/ANTIGRAVITY_PLAN_IMAGENES_20260918.md` (P0.3).

---

## Objetivo

Thumbs de producto **nunca** muestran el icono roto del navegador. Si `images[0]` falla (404, red, vacío), mostrar placeholder estable (iniciales de marca / silueta). Wire en Catálogo y Ventas (y pickers con thumb si ya renderizan `<img>`).

Meta UX: scroll en Catálogo/Ventas sin cascada de 404 visuales; productos truly-missing o sin imagen se ven “sin foto”, no rotos.

---

## Contexto live (2026-09-18, post-rewrite Case)

- Bucket: `gs://mclarens-erp-products/products/`
- URL pública: `https://storage.googleapis.com/mclarens-erp-products/products/{file}`
- Cloud Run aún espeja `/uploads/{object}` cuando path+ext coinciden; Mongo preferido ahora = **URL GCS absoluta**.
- FOX SHOCKS sample 20 primaries (GET Range): **antes 10% OK → después 95% OK** (1/20 truly missing sin objeto GCS).
- Truly-missing primaries conocidos tras rewrite (dejar placeholder FE; no inventar path):

| Brand | SKU |
|-------|-----|
| FOX SHOCKS | `803-02-220`, `803-02-219`, `803-02-124-KIT`, `398-00-095-A`, `398-00-094-A` |
| ABRO | `A-EC-833` |
| Auxbeam | `ZD000864` |

(Hay más truly-missing de otras marcas en la auditoría P1 — fuera de alcance de este PR de UI.)

---

## Alcance IN

1. Helper `getProductImageUrl(product)` (o ampliar el existente).
2. Componente `<ProductThumb />` con `onError` → placeholder.
3. Wire en `CatalogPage` y `SalesPage` (listados, cards, filas de carrito/draft si muestran thumb).
4. Integrar o envolver el uso actual de `ProductImageHoverZoom` en Catálogo para que el fallo de carga no deje borde roto.
5. Tests mínimos / story no obligatorios; smoke manual sí.

## Alcance OUT

- Re-sync GCS / reescritura Mongo (Case ya lo hizo).
- Validación API create/update de `images` (PR-C / P1.3).
- Quitar Unsplash (P1.2).
- Pagination/`q` (P2).
- Secrets, scripts ops, SA JSON.

---

## Diseño técnico

### 1) `frontend/src/lib/productImage.js` (nuevo, o junto a utils existentes)

```js
const GCS_BASE = "https://storage.googleapis.com/mclarens-erp-products";

/** Primary image URL for a product, or null. */
export function getProductImageUrl(product) {
  if (!product) return null;
  const raw =
    (Array.isArray(product.images) && product.images.find((u) => typeof u === "string" && u.trim())) ||
    product.image_url ||
    product.image ||
    null;
  if (!raw || typeof raw !== "string") return null;
  const u = raw.trim();
  if (!u) return null;
  // Unsplash = placeholder de seed, no packshot: tratar como “sin imagen real”
  if (u.includes("images.unsplash.com")) return null;
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  if (u.startsWith("/uploads/")) return u; // relativa OK; Cloud Run espeja si existe
  if (u.startsWith("/")) return u;
  return u;
}

/** Optional: if relative /uploads/ fails, browser onError can retry GCS twin once. */
export function uploadsToGcsUrl(url) {
  if (!url || typeof url !== "string") return null;
  if (!url.startsWith("/uploads/")) return null;
  return `${GCS_BASE}/${url.slice("/uploads/".length)}`;
}

export function brandInitials(brand) {
  const b = (brand || "?").trim();
  if (!b) return "?";
  const parts = b.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
```

Notas:
- Hoy `CatalogPage.jsx` suele tener algo como:  
  `const getProductImage = (product) => product?.images?.[0] || product?.image_url || null;`  
  → **reemplazar** por import de `getProductImageUrl`.
- En `SalesPage.jsx`, al setear cart item (`image: product.images?.[0] || null`) → usar el helper **y** al renderizar thumb.

### 2) `frontend/src/components/products/ProductThumb.jsx` (nuevo)

Props sugeridas:

| Prop | Tipo | Default | Notas |
|------|------|---------|--------|
| `product` | object | — | preferido; saca URL + brand |
| `src` | string | — | override opcional |
| `alt` | string | product.name | |
| `brand` | string | product.brand | para iniciales |
| `className` | string | | tamaño del contenedor |
| `imgClassName` | string | `object-contain` | |
| `size` | `"sm"\|"md"\|"lg"` | `"md"` | sm≈40px (filas), md≈96, lg≈200 |
| `retryGcs` | boolean | `true` | si `/uploads/...` falla, un retry a URL GCS equivalente |

Comportamiento:
1. `src = srcProp || getProductImageUrl(product)`.
2. Si `!src` → render placeholder (no `<img>`).
3. `<img src={src} alt=... loading="lazy" decoding="async" onError={handleError} />`.
4. `handleError`:
   - Si `retryGcs` y aún no reintentado y `uploadsToGcsUrl(src)` → setSrc(gcs) y return.
   - Si no → setBroken(true) y mostrar placeholder.
5. Placeholder: caja `bg-muted` + iniciales (`brandInitials`) o icono silueta Package/ImageOff de lucide; texto opcional `Sin imagen` solo en `size=lg`.
6. Accesible: `role="img"` + `aria-label={alt || "Sin imagen de producto"}` en placeholder.

**No** usar Unsplash ni hotlink externos como fallback.

### 3) Wire Catálogo

Archivo: `frontend/src/pages/CatalogPage.jsx`

- Importar `ProductThumb` y/o `getProductImageUrl`.
- Donde hoy se usa `ProductImageHoverZoom` (o `<img>` directo):
  - **Opción A (preferida):** pasar `onError` / fallback interno a `ProductImageHoverZoom` **o** envolver: si broken, placeholder; si OK, HoverZoom.
  - **Opción B:** sustituir HoverZoom por `ProductThumb` en listado compacto y mantener HoverZoom solo en quick-view **si** HoverZoom ya maneja error; si no, arreglar HoverZoom con la misma lógica `onError` (extraer shared hook `useProductImageSrc`).
- Grid/cards y cualquier mini-thumb del quick-view deben usar el mismo path.
- Quitar helper local duplicado `getProductImage`.

### 4) Wire Ventas

Archivo: `frontend/src/pages/SalesPage.jsx`

- Al agregar al carrito: `image: getProductImageUrl(product)`.
- Donde se renderice `item.image` en filas del carrito / búsqueda de productos / modal de stock: usar `<ProductThumb product={...} src={item.image} size="sm" />` en lugar de `<img src={item.image} />` crudo.
- Buscar otros `<img` de producto en el mismo archivo (picker, transfer, etc.) y unificar.

### 5) Estilo

- Coherente con shadcn/`bg-muted`, `text-muted-foreground`, `rounded-md`, `border`.
- No layout shift: contenedor con aspect-ratio o h/w fijos según `size`.
- Dark mode OK (tokens existentes).

---

## Criterios de aceptación

- [ ] Producto con `images[0]` GCS 200/206: thumb OK (Catálogo + Ventas).
- [ ] Producto con URL 404 (p. ej. FOX `398-00-094-A` si sigue sin objeto): **placeholder**, cero icono roto.
- [ ] Producto `images: []` o solo Unsplash: placeholder.
- [ ] Relative `/uploads/...` que exista: OK; si 404 y gemelo GCS existe: un retry GCS (opcional pero deseable).
- [ ] Scroll rápido en Catálogo no deja cascada de bordes rotos.
- [ ] Sin PINs / secrets en el PR.
- [ ] Smoke: login gerencia o ventas → Catálogo → Ventas (añadir ítem) → thumbs saneadas.

---

## Archivos esperados en el PR

| Path | Acción |
|------|--------|
| `frontend/src/lib/productImage.js` | nuevo |
| `frontend/src/components/products/ProductThumb.jsx` | nuevo |
| `frontend/src/pages/CatalogPage.jsx` | wire + quitar helper local |
| `frontend/src/pages/SalesPage.jsx` | wire cart + thumbs |
| `frontend/src/components/erp/ProductImageHoverZoom.jsx` (ruta real si difiere) | `onError` / retry compartido |

Opcional: `frontend/src/components/products/index.js` re-export.

Rutas sugeridas en el plan: `frontend/src/components/products/ProductThumb.jsx` y/o `frontend/src/lib/productImage.js`.

---

## Orden de trabajo sugerido

1. Crear `productImage.js` + `ProductThumb.jsx`.
2. Wire Sales (filas sm) — feedback visual rápido.
3. Wire Catalog + HoverZoom.
4. Smoke UI desktop + phone ancho.
5. Abrir PR con título: `feat(ui): ProductThumb with onError placeholder for Catalog/Sales`.
6. Descripción del PR: link a este doc; mencionar que Case ya corrigió mismatch GCS en live; listar SKUs truly-missing como residual P1.

---

## No rehacer

- Soft-delete ~840 OEM DLAA.
- Re-upload DS18 / AFN 4X4 / Meguiar's si primary ya OK.
- Alta inicial / zonas (`c152d010`).
- Inventar stock o URLs de imagen para SKUs missing.
- Meter GB de fotos en la imagen Docker / Cloud Run.

---

## Referencias (sin secretos)

- Plan: `erp_docs/img_sync/ANTIGRAVITY_PLAN_IMAGENES_20260918.md` (P0.3 / PR-A)
- Auditoría: `erp_docs/img_sync/LIVE_IMAGE_AUDIT_20260918.md` / `.json`
- Ops rewrite (Case): `erp_docs/img_sync/rewrite_product_image_extensions.py` + `rewrite_ext_*.json`
- Master: `erp_docs/ANTIGRAVITY_MASTER.md`
- Guía ejecución: `erp_docs/ANTIGRAVITY_PROMPT_20260918.md` (PR-1); este archivo = **PR-2**

**Fin PR-2.** Pegable en Antigravity.
