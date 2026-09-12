# ANTIGRAVITY_MASTER — Fuente canónica única (MC-LARENS ERP2)

> **SUPERSEDES** fragmented briefs for implementation priority:
> - `ANTIGRAVITY_APLICAR_TODO.md`
> - `MC-LARENS_ERP2_ANTIGRAVITY_HANDOFF.md`
> - `ANTIGRAVITY_REELS_EVAL.md`
> - `REPORTE_DANOS_CATALOGO_IMAGENES.md`
> - `GUIA_BUSQUEDA_PRODUCTOS_RAPIDA.md`
>
> Those files may remain as **archives**. **Antigravity should read ONLY this master** for what to implement and in what order.
>
> **Repo:** https://github.com/Samuraimaid/MC-LARENS_ERP2 · **Branch:** `master`  
> **Updated:** 2026-09-12 (post-c152d010 + oem2 batch) · **Brief author:** Case + TARS · **Owner:** Xinon  
> **For:** Antigravity — code PRs. Case does data/ops on live when Cloud Agents/Pro unavailable.

---

## 0. Context live

| Item | Value |
|------|--------|
| Live ERP | `https://mclarens-erp-836176703716.us-central1.run.app` |
| Demo mode | **Intentional:** all `product.stock = 0` and all `inventory.quantity = 0` (2026-09-12). Report: `img_sync/demo_stock_zero_report.json` |
| Product images | GCS bucket `mclarens-erp-products` (public HTTPS URLs on product docs) |
| DLAA Option C | **Done:** 840 OEM soft-deleted (`is_active:false`); **130** fog lights remaining (~129/130 GCS) |
| Brands image-synced | AFN, Auxbeam, DLAA (fog), DS18, FOX, KEKO, Meguiar's, Pioneer (partial), Fernandez_Sera / Little Trees cluster |
| Cloud Agents / Pro | Unavailable in this environment (MCP CloudAgent not launchable). **Case = data/ops only; Antigravity = code PRs.** |
| Stack | FastAPI + React/Vite + MongoDB (Motor) → Docker → Cloud Run |
| Auth QA | PIN typed on **keyboard** at splash (not pinpad clicks). Gerencia PIN for ops is known to Case only — never commit PINs/cookies. |

**Why demo stock=0:** prepare for warehouse **Alta inicial** (initial stock-take activation) without fake on-hand quantities confusing bodegueros / demos.

---

## 1. FEATURE P0 — Alta inicial de bodega (NEW — Xinon 2026-09-12)

### Status (2026-09-12 evening) — TARS / commit `c152d010`
**DONE in code** (do **not** reimplement): inventory zone quantities, `POST /api/inventory/zone-transfer`, `POST /api/inventory/product-status`, InventoryPage UI, sale blocks non-available stock.
**Next:** verify post-`./deploy.sh` on live against acceptance below (Alta inicial N/M progress, demo stock=0 banner, inactive-until-activated **per warehouse** — confirm gaps vs full §1 intent; fill only missing pieces).


When the ERP is connected to a warehouse IGP / **bodeguero** endpoint for that warehouse:

### Intent

Flow **“Alta inicial”** / initial stock-take activation:

1. Bodeguero sees the full product catalog (or warehouse-scoped catalog).
2. Can **activate** products that exist in the real warehouse inventory.
3. Can **deactivate** products not present — **soft only** (`is_active: false` **or** a warehouse-scoped active flag). **NEVER hard-delete** in this flow.
4. Later, gerencia can hard-delete permanently unused SKUs to save storage (**separate admin flow**). Today hard `DELETE` on products returns **405** — needs implementation.
5. After alta inicial, entering quantities / receiving stock uses **existing** inventory movements (`add-stock`, `purchase-receipt`, transfers, etc.).

### Multi-bodega scope

Activation state must be **warehouse-scoped** if multi-bodega — not a global wipe:

- `wh_main` — Bodega Central  
- `wh_topcar_calvario` — TopCar El Calvario  
- `wh_topcar_tigre` — TopCar La Tigre  

Deactivating in Calvario must not hide the product for La Tigre / Central.

### UI

- Clear **demo banner** while all quantities are 0 (demo mode).
- Alta inicial checklist progress: **activated N of M** (per warehouse).
- Deactivated products hidden from default warehouse pickers but **recoverable** (toggle back on).
- Spanish UI copy throughout.

### API sketch (Antigravity designs exact contracts)

Suggested model:

```text
warehouse_product_state {
  warehouse_id: str
  product_id: str
  is_active_in_warehouse: bool
  activated_at: datetime?
  activated_by: user_id?
}
```

Suggested endpoints:

- `GET /api/warehouses/{warehouse_id}/product-states` — list (+ filters active/inactive, search)
- `PUT /api/warehouses/{warehouse_id}/product-states/{product_id}` — toggle / set `is_active_in_warehouse`
- Optional bulk: `POST .../product-states/bulk` `{product_ids, is_active_in_warehouse}`
- Auth roles: `bodegas`, `gerencia` (and supervisor if already allowed on inventory writes)
- Bodegas users: only their assigned `warehouse_id`
- Audit log every toggle (actor, warehouse, product, before/after)

Default pickers / inventory / sales lines for a warehouse should respect `is_active_in_warehouse` (treat missing row as inactive **or** active-by-default — pick one and document; Xinon preference: **inactive until alta inicial activates**, once that warehouse has started alta inicial).

### Acceptance

- [ ] Bodeguero can toggle activate/deactivate **without deleting** Mongo products.
- [ ] Deactivated SKUs hidden from default warehouse pickers; recoverable via alta inicial / admin.
- [ ] State is per-warehouse; no cross-warehouse wipe.
- [ ] Audit log entries for toggles.
- [ ] Demo banner when global/warehouse qty all zero.
- [ ] Progress UI: activated N of M.
- [ ] No hard DELETE in this flow; separate gerencia hard-delete (when implemented; currently 405).

### Note for Antigravity

**CloudAgent launch for Alta inicial was not available** in Case’s executor environment (no MCP CloudAgent / Pro). **Antigravity must implement this feature in code** (PR(s) against `master`).

### Related inventory API landmines (ops learned 2026-09-12)

- `POST /api/inventory` expects query param `inv_data` but handler annotates `inv_data: Any` → receives string → `model_dump()` **500**. Fix typing to `InventoryUpdate` (Body) as part of inventory hygiene if touching this area.
- `POST /api/inventory/add-stock` only **adds** (`quantity > 0`); cannot set absolute 0 or negative delta.
- `PATCH`/`PUT` on inventory ids → **405**.
- Demo zero used official warranty approve `$inc` negative drain + product `GET`+`PUT stock:0` — do not redo.

---

## 1b. FEATURE P0 — Zonas virtuales dentro de cada bodega (NEW — Xinon 2026-09-12)

### Status (2026-09-12 evening) — zonas
**DONE in code** via commit `c152d010`: `quantity_available` / `damaged` / `incomplete` / `warranty`, zone-transfer + product-status APIs, InventoryPage sections.
**Next:** live smoke after deploy — default pickers/POS exclude non-sellable zones; warranty approve auto-places returned unit into Garantía; audit/kardex on each move. Fix only gaps.


**Xinon asked:** within **each physical warehouse**, a section / virtual sub-warehouse for non-sellable or special stock — not a separate warehouse entity the user manages as a full bodega, but a **zone inside the same bodega**.

### Zones (minimum set)

| Zone id (suggested) | Label ES | What lives there |
|---------------------|----------|------------------|
| `zone_damaged` | Dañado / Bodega dañado | Physical damage, unsellable as new |
| `zone_incomplete` | Incompleto | Missing parts / incomplete kits |
| `zone_warranty` | Garantía (devoluciones) | Unit the **customer returned** when a warranty replacement was issued (the old/defective unit taken in). The **new** unit given to the customer leaves sellable stock via normal warranty/sale flow; the returned unit enters this zone. |
| `zone_zero` (optional alias) | Bodega cero | Optional umbrella UI tab grouping the above, or a catch-all for qty held at 0 in special state — Antigravity may merge with damaged/incomplete if cleaner |

### Intent

- Same `warehouse_id` (e.g. `wh_main`, TopCar Calvario, TopCar La Tigre).
- Inventory rows (or movement metadata) carry a **`storage_zone`** (or equivalent) so pickers for normal sales **default to sellable / main floor only**.
- Bodeguero + gerencia can **move** units between `zone_sellable` (default) ↔ damaged / incomplete / warranty **without deleting** product masters.
- Warranty flow: when validating/activating garantía and swapping a new unit to the customer, the returned SKU/unit is recorded into `zone_warranty` with reason + reference to warranty request id (see existing `/inventory/warranty-requests*` routes).
- Later: report/export “qué hay en dañado/garantía” per bodega; optional purge/write-off admin later (not in v1).

### Do NOT

- Do not invent separate Cloud Run deploys per zone.
- Do not hard-delete products when moving to these zones.
- Do not count zone_damaged / zone_warranty qty as available-to-sell in cotización/venta unless gerencia explicitly overrides.

### Acceptance

- Each warehouse UI shows tabs/sections: Venta / Dañado / Incompleto / Garantía.
- Move unit → zone updates inventory + audit movement with reason.
- Warranty approve/swap path can auto-place returned unit into Garantía zone.
- Sellable availability queries exclude non-sellable zones by default.

### Implementation note

Needs **Antigravity / Cloud Agent code PR** (schema + API + InventoryPage/KDS). Case cannot ship this as data-only ops.

---

## 2. P0 bugs still open (from issues)

| Issue | What | Done when |
|-------|------|-----------|
| [#4](https://github.com/Samuraimaid/MC-LARENS_ERP2/issues/4) | `/my-completed-jobs` crash (“Incidencia Técnica Registrada”). Repro: keyboard PIN login → open route (gerencia/técnicos). | Page lists jobs without crash; smoke documented |
| [#11](https://github.com/Samuraimaid/MC-LARENS_ERP2/issues/11) (catalog images / search / pagination) | `GET /api/products` returns full catalog ≈ **~11 MB**; `?limit=` does not filter; FE filters client-side → slow search/UI. Images historically broken `/uploads/...` (many now GCS-synced — still need server pagination + `q` search). | Paginated API + working `q`/`limit`; catalog/search usable |
| Security (handoff) | Cookies/secrets in git history risk; kiosk PIN bake; AuthZ on mutations (ventas/inventario/caja/users) | No tracked cookies; secrets runtime-only; endpoint→permission→test table |
| Search limit/`q` | Same as #11 — server-side search and limits | Coherent with CatalogPage / SalesPage |

**Security detail (still P0):**

1. Remove tracked `cookies*.txt`; rotate exposed sessions.  
2. PIN kiosko / secrets out of Dockerfile bake → Secret Manager / runtime env.  
3. AuthZ **server-side** on write endpoints; UI only hides.

---

## 3. P1

| Issue | What |
|-------|------|
| [#5](https://github.com/Samuraimaid/MC-LARENS_ERP2/issues/5) | Coord. polarizados: “Permiso denegado” ×2 on `/coordinator/polarizados` |
| [#6](https://github.com/Samuraimaid/MC-LARENS_ERP2/issues/6) | Sucursal “no asignada” for coordinators (and similar) |
| [#7](https://github.com/Samuraimaid/MC-LARENS_ERP2/issues/7) | Entregador GPS denied → raw «Not allowed»; need clear ES message + degraded UX |
| (handoff) | Approvals/WS live-vs-dead decision; cookie contract; `test_pin_lockout` 401/403 consistency |

---

## 4. P2

| Issue / ID | What |
|------------|------|
| [#8](https://github.com/Samuraimaid/MC-LARENS_ERP2/issues/8) | Slow initial loads (>15s): dashboard, inventory, users, catalog |
| [#9](https://github.com/Samuraimaid/MC-LARENS_ERP2/issues/9) | Bodegas main `/inventory` empty/slow |
| [#10](https://github.com/Samuraimaid/MC-LARENS_ERP2/issues/10) | Context menus: DesktopMenu + MobileSheet (Xinon: implement) |
| R-009 | Honest upload progress (publicidad videos + taller photos): % / ETA / MB/s / cancel |
| Design Motion R-011…R-035 | After bugs; see archived `design_motion_overnight_candidates.md` — do not prioritize over P0/P1 |

---

## 5. Data/ops already done by Case (do not redo)

| Work | Result (2026-09-12) |
|------|---------------------|
| Brand image sync → GCS `mclarens-erp-products` | AFN 220/220; Auxbeam ~176/177; DS18 819/819; FOX ~626/631; KEKO 212/212; Meguiar's ~206; Pioneer partial; Fernandez_Sera ~199/213 |
| DLAA Option C | Soft-delete **840** OEM; **130** fog left; GCS **129/130** (TY1071-LED-3 no image bytes) |
| Corrupt text fixes | 35 products fixed (names/descriptions) |
| Desc mismatch | Little Trees `prod_fs_no-especificado` ABRO wax blurb → correct ambientador copy |
| **DLAA oem2 batch** | **98** products `prod_dlaa_oem2_*`, brand `DLAA`, subcategory Halógenos OEM, stock 0; live DLAA ≈228 (130 fog + 98 oem2). Do not delete/rename without Xinon. |
| **Demo stock zero** | **29** products `stock→0`; **16** inventory rows drained to `quantity=0` via warranty approve; verify **0 / 0** nonzero. Report: `/workspace/erp_docs/img_sync/demo_stock_zero_report.json` |

Hard DELETE products remains **405** (soft-delete only). OpenAPI `GET /openapi.json` still **500** (P2 hygiene).

---

## 6. Constraints

1. Respect **`CRITICAL_ZONES.md`**, `SAFE_FIRST_REFACTORS.md`, `POLITICAS_CAMBIOS_CODIGO.md`, `RUNTIME_CONTRACTS.md`.  
2. **No microservices** (R-003): stay modular monolith on the same Cloud Run service.  
3. **No secrets in git** — no PINs, cookies, session tokens, service account keys.  
4. PIN login QA: **type on keyboard** (splash), not pinpad clicks.  
5. **Spanish UI copy** for user-facing strings.  
6. Authz on **server**; UI only hides.  
7. One theme ≈ one small PR; smoke PIN login + touched area after each.  
8. Do not “fix along the way” CRITICAL sales/caja/drafts/totals/session lock unless security gap is proven.  
9. Do not invent catalog/inventory data; do not bake fake positive stock for demos.  
10. Alta inicial: **soft deactivate only**; never hard-delete in that flow.

---

## Suggested Antigravity execution order

1. **Deploy + smoke live:** zonas virtuales + #4 (commit `c152d010`) — verify acceptance; only patch gaps  
2. **#11** — `GET /api/products` pagination / `q` / `limit`  
3. **Security P0** — cookies out of git + rotate; PIN/secrets out of Docker bake; AuthZ on mutations  
4. **P1** — #5 polarizados, #6 sucursal, #7 GPS copy  
5. **P2** — #8/#9/#10, R-009, Design Motion after bugs  

**Do not reimplement** Alta inicial / zonas / #4 from scratch if `c152d010` already covers them.


## Archive pointers (read only if needed)

| Archive | Use |
|---------|-----|
| `docs/ANTIGRAVITY_APLICAR_TODO.md` | Older execution table — **redirects here** |
| `docs/MC-LARENS_ERP2_ANTIGRAVITY_HANDOFF.md` | Long security/Torti handoff |
| `docs/ANTIGRAVITY_REELS_EVAL.md` | Reels eval (many OBVIAR/APARCAR) |
| `docs/REPORTE_DANOS_CATALOGO_IMAGENES.md` | Catalog/image damage report (pre/post sync) |
| `docs/GUIA_BUSQUEDA_PRODUCTOS_RAPIDA.md` | Search UX notes |

**End of ANTIGRAVITY_MASTER.** Antigravity: implement from this file only.
