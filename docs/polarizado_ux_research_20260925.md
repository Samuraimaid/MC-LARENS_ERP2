# Polarizado UX + Pricing Research — 2026-09-25 (America/Managua)

**Repo:** `/workspace/MC-LARENS_ERP2`  
**Live:** `https://mclarens-erp-836176703716.us-central1.run.app`  
**Rule (Xinon):** KEEP existing gama **names** exactly. Only differentiate **prices** by gama × body/windows.

---

## 1. NI market ballparks (Managua, 2024–2026)

Sources: r/Nicaragua threads (Mar 2025–Mar 2026), local shop mentions (Titán Plaza 101, Autonación, Garage 505, Genesis Polarizado 505, Curva/Mayoreo, Guanacaste). Currency mixed C$ / USD. Approx FX used in ERP: **~C$36.5 = US$1**.

| Job / quality | Typical range | Notes |
|---|---|---|
| Street básico / “negro” sedán completo | **C$1,600–2,200** (~US$44–60) | Curva Mayoreo C$1600; Guanacaste C$2200 (Mar 2026) |
| Nano cerámico sedán | **C$3,200 / US$90–130** | Autonación C$3200; Titán ~US$100–130 |
| Nano cerámico SUV grande (Land Cruiser) | **C$5,500** (~US$150) | User report combined 15%/35% |
| Premium / certificado (Garage 505 VK) | **~US$300** | Highest tier mentioned |
| Solo delanteros / franjas | Much cheaper than full | Franjas-only after removing full tint (Titán) |
| VLT tips | 20% night visibility issues; **35%/50%** recommended for front | Common advice on threads |

**Gamas to keep (ERP official — do not rename):**

1. `gama_economica` — **Gama Económica**
2. `tinmax` — **Tinmax**
3. `nano_ceramico` — **Nano Cerámico**
4. `gama_premium` — **Gama Premium**

### Proposed price matrix (USD) — base POL body + gama surcharge

ERP prices products in **USD**. Body SKUs carry the **Económica** base; higher gamas add `price_by_zone_group` / `extra_price` surcharges (windshield + sides + rear). Rule: more windows → higher base; higher gama → higher total.

#### A) Body / window bases (POL-* unit_price) — Económica complete job

| Row (body / option) | Live SKU | Live price (2026-09-25) | Proposed Económica USD | Rationale |
|---|---|---|---|---|
| Sedán completo | `POL-SED-COM` | 120 | **55** | Street C$2k band; McLarens mid-shop |
| Hatch / compacto | `POL-HB-COM` | 105 | **50** | Slightly under sedán |
| SUV / station | `POL-SUV-COM` | 180 | **75** | More glass |
| Pickup | `POL-PCK-COM` | 140 | **70** | Between sedán–SUV |
| Van / microbús | `POL-VAN-COM` | 200 | **95** | Large glass count |
| Camión / cabezal | `POL-CAM-COM` | 250 | **110** | Cab-focused but labor |
| Solo delanteros | `POL-DEL-001` | 35 | **22** | Fewer windows |
| Franja superior | `POL-FRA-SUP` | 25 | **12** | Single strip |
| Completo sin sellado | `POL-CSS-001` | 85 | **45** | No windshield |
| Ventana individual | `POL-VEN-001` | 18 | **10** | Per pane |
| Despolarizado / limpia | `POL-LIM-001` | 45 | **45** | Labor service — leave |
| Legacy STD 20% completo | `POL-STD-20` | 149.99 | **55** | Align to Económica sedán |
| Legacy CER 35% completo | `POL-CER-35` | 299.99 | **160** | Align ~Nano+SUV ballpark |

#### B) Gama surcharges (per zone group, USD) — applied on top of base

| Gama (keep name) | windshield | sides | rear | ≈ Full-car extra | Example sedán total |
|---|---:|---:|---:|---:|---:|
| Gama Económica | 0 | 0 | 0 | 0 | **$55** |
| Tinmax | 15 | 25 | 15 | ~55 | **~$110** |
| Nano Cerámico | 35 | 55 | 35 | ~125 | **~$180** |
| Gama Premium | 50 | 80 | 50 | ~180 | **~$235** |

SUV Económica $75 → Premium ~$255; Garage 505 ~$300 still sits as top-shop ceiling. Street nano ~$100–150 maps near Tinmax–Nano mid.

**Important:** Today Económica **and most Tinmax** materials use `price_by_zone_group` all **0.0**, so selecting gama 1 vs 2 often yields the **same** ticket — that is the “4 gamas same price” bug. Nano/Premium already have non-zero extras but need a cleaner ladder.

---

## 2. Code locations (exact paths + symbols)

### A. Search placeholder (`pegar funciona` / `Buscar SKU…`)

| File | Line | Symbol / snippet |
|---|---|---|
| `frontend/src/pages/CatalogPage.jsx` | **962** | `placeholder="Buscar SKU, nombre, marca… (pegar funciona)"` |

*(Lot A owns placeholder + fuzzy — avoid conflicting edits here beyond layout.)*

### B. Catalog / product search filtering (fuzzy / brand aliases DLLA→DLAA)

| Layer | File | Symbols |
|---|---|---|
| Client — Sale form dropdown | `frontend/src/components/sales/SaleForm.jsx` | `filteredProducts` (~3563), `indexedProducts`, token `.includes` match |
| Client — Catalog page | `frontend/src/pages/CatalogPage.jsx` | `normalizeText`, score/`includes` (~499+), search Input ~960 |
| Client — lookup helper | `frontend/src/lib/productLookup.js` | `productMatchesSearch` (imported by CatalogPage) |
| Server — unified search | `backend/domains/search/unified_search.py` | server search entry |

**Lot A suggestion:** fuse.js on client indexed fields + small `BRAND_ALIASES = { dlla: "dlaa", … }`; optional light Levenshtein only for short tokens (SKU typos).

### C. Polarizado selector UI (4 gamas)

| File | What |
|---|---|
| `frontend/src/components/sales/TintWindowMaterialDialog.jsx` | Main selector UI |
| | `ALL_OFFICIAL_TINT_MATERIALS` (offline materials + `extra_price`) |
| | `OFFICIAL_GAMAS` (~592): `gama_economica`, `tinmax`, `nano_ceramico`, `gama_premium` |
| | `DialogContent` size (~1459): `max-w-6xl md:max-w-7xl max-h-[98dvh] h-[96dvh]` |
| | Pricing: `localMaterialsExtraTotal`, `calculatedBasePrice`, `grandTotalUsd` (~1220–1276) |
| `backend/domains/tint/window_materials.py` | Source of truth materials + `TINT_GAMAS` + `price_by_zone_group` |
| `backend/data/seeds/core_seed.json` | POL-* service products (~2450+) |
| `backend/data/demo_products.py` | `POL-CER-35`, `POL-STD-20` |

**Live POL SKUs (API `/api/products?search=POL-`):**  
`POL-SED-COM`, `POL-HB-COM`, `POL-SUV-COM`, `POL-PCK-COM`, `POL-VAN-COM`, `POL-CAM-COM`, `POL-DEL-001`, `POL-FRA-SUP`, `POL-CSS-001`, `POL-VEN-001`, `POL-LIM-001`, `POL-STD-20`, `POL-CER-35`.

### D. Product Quick View max-size CSS (mirror for polarizado)

| File | Class |
|---|---|
| `frontend/src/components/erp/ProductQuickViewDialog.jsx` | **330**: `!w-[100dvw] !max-w-[100dvw] sm:!max-w-[1480px] sm:!h-[min(100dvh-1rem,980px)]` (ProductQuickViewDialog) |

Polarizado today is smaller (`max-w-7xl` / `94vh`). Lot B should align DialogContent to QV max footprint.

### E. “Buscar desde Catálogo” open behavior

| File | Behavior |
|---|---|
| `SaleForm.jsx` | Button ~4892 → `handleOpenCatalogSearch` (~3431) → `onOpenCatalogSearch(snapshot)` or `localStorage` + `/catalog` |
| `SalesPage.jsx` | `openCatalogFromSaleForm` (~1412) → draft + `navigate("/workbench?tab=catalog&mode=sale-pick")` |
| `QuotationsPage.jsx` | `openCatalogFromQuoteForm` → quote-pick analog |
| `CatalogPage.jsx` | `isSalePickMode` when `mode=sale-pick\|quote-pick`; banner ~874; **no persistent 2-col cart panel** — cart lives in draft storage only; product list is single column (`grid-cols-1` ~1287) |

**Lot B change:** desktop split `catalog | customer cart` while in pick mode.

---

## 3. Technical suggestions (brief)

1. **Fuzzy (Lot A):** Prefer **fuse.js** over hand-rolled Levenshtein for name/brand; keep exact/`includes` first for SKU. Add `BRAND_ALIASES` map (DLLA→DLAA) before scoring. Touch `SaleForm.jsx `filteredProducts`` + `productLookup` / CatalogPage carefully (coordinate with Lot A).
2. **Polarizado matrix storage:** Keep **POL-* product `unit_price`** as body/window base (Económica). Store gama differentials in **`window_materials.py` → `price_by_zone_group`** (server quote path) and mirror **`extra_price`** in FE `ALL_OFFICIAL_TINT_MATERIALS` for offline. Optional later: config JSON — not required for Lot B.
3. **Split view:** In `CatalogPage` when `isSalePickMode`, wrap content in `lg:grid-cols-[minmax(0,1fr)_340px]` with sticky right cart reading draft `cartItems` (qty + total + “Volver a venta”).

---

## 4. Lot scopes (Antigravity / Case)

### Lot A — placeholder + fuzzy *(other executor)*
- Placeholder copy tweak on CatalogPage (and SaleForm search if needed)
- Fuzzy + brand aliases — avoid overlapping Lot B files except coordinated rebase on CatalogPage

### Lot B — this workstream
1. **Prices:** Update `price_by_zone_group` / `extra_price` ladder for all 4 **existing** gamas; update POL-* bases in seed + **live PUT**; keep names.
2. **Modal max:** Tint dialog DialogContent → QV-like max size.
3. **2-col catalog/cart:** Catalog pick mode desktop split view.

---

## 5. Short summary for Case → Xinon

- **NI ballparks:** sedán street C$1.6–2.2k; nano C$3.2k / US$90–130; SUV nano ~C$5.5k; premium shop ~US$300. VLT 35/50 preferred for front.
- **Keep gamas:** Gama Económica → Tinmax → Nano Cerámico → Gama Premium (names unchanged).
- **Bug:** Económica & Tinmax often **$0** extras → same ticket; fix surcharge ladder + optional NI-aligned POL bases.
- **Key files:** `TintWindowMaterialDialog.jsx`, `window_materials.py`, `CatalogPage.jsx`, `ProductQuickViewDialog.jsx`, `SaleForm.jsx` / `SalesPage.jsx`, `core_seed.json`.
- **Lot A:** placeholder + fuzzy. **Lot B:** prices + modal max + 2-col cart.

---

## 6. Lot B implementation notes (2026-09-25)

**Branch:** `feat/lot-b-polarizado-prices-modal-catalog-20260925`  
**Gama names kept (unchanged):** Gama Económica (`gama_economica`), Tinmax (`tinmax`), Nano Cerámico (`nano_ceramico`), Gama Premium (`gama_premium`).

### Price ladder applied
| Gama | `price_by_zone_group` (WS/sides/rear USD) | FE `extra_price` (offline full-car approx) |
|---|---|---|
| Gama Económica | 0 / 0 / 0 | 0 |
| Tinmax | 15 / 25 / 15 | 55 |
| Nano Cerámico | 35 / 55 / 35 | 125 |
| Gama Premium | 50 / 80 / 50 | 180 |

### POL-* body bases (seed + live PUT)
Sedán 55, HB 50, SUV 75, Pickup 70, Van 95, Camión 110, Delanteros 22, Franja 12, CSS 45, Ventana 10, Limpieza 45, STD-20 55, CER-35 160.

### UI
- Polarizado modal → QV-like max (`100dvw/100dvh`, sm `1480×980`)
- Catalog pick mode → desktop 2-col catalog | customer cart

### Files touched (Lot B only)
- `backend/domains/tint/window_materials.py`
- `frontend/src/components/sales/TintWindowMaterialDialog.jsx`
- `frontend/src/pages/CatalogPage.jsx` (cart split only; search/fuzzy left to Lot A)
- `backend/data/seeds/core_seed.json`, `backend/data/demo_products.py`
