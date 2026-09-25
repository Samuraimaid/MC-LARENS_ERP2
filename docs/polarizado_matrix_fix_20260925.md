# Polarizado price matrix fix — 2026-09-25 (America/Managua)

**PR:** https://github.com/Samuraimaid/MC-LARENS_ERP2/pull/77  
**Branch:** `feat/lot-b-polarizado-prices-modal-catalog-20260925`  
**Gama names:** unchanged (Gama Económica, Tinmax, Nano Cerámico, Gama Premium)

---

## How the matrix works

```
ticket ≈ POL-* body base (Económica unit_price)
       + Σ zone extras(gama) × body_surcharge_multiplier(body_class)
```

| Layer | Source | Notes |
|---|---|---|
| Body base | Product `POL-*-COM` / partial SKUs `unit_price` | Already differs by windows/labor |
| Zone extras | `materials[].price_by_zone_group` (windshield / sides / rear) | **Sedán reference** ladder |
| Body multiplier | `BODY_SURCHARGE_MULTIPLIERS` in policy + code | Scales **only** gama extras (not POL base, not sunstrips) |

### Sedán-reference zone extras (USD)

| Gama | windshield | sides | rear | Full-car extra |
|---|---:|---:|---:|---:|
| Gama Económica | 0 | 0 | 0 | **0** |
| Tinmax | 15 | 25 | 15 | **55** |
| Nano Cerámico | 35 | 55 | 35 | **125** |
| Gama Premium | 50 | 80 | 50 | **180** |

### Body surcharge multipliers

| Body class | Categories (examples) | Mult |
|---|---|---:|
| partial | ventana / franja / moto | 0.45 |
| hatch | hatchback | 0.90 |
| **sedan** | sedan (**reference**) | **1.00** |
| pickup | camioneta_* | 1.20 |
| suv | suv, station_wagon | 1.35 |
| van | microbus_*, bus_* | 1.65 |
| camion | camion_* | 1.85 |

Quote API accepts `vehicle_category` (UI silhouette id). Frontend sends `selectedVehicleType`.

**Why not flat surcharge?** Lot B kept the same Tinmax/Nano/Premium zone $ on every car. Xinón needs Tinmax sedán &lt; Tinmax SUV &lt; Premium van, etc. Bases alone were not enough differentiation on higher gamas.

---

## Example tickets (completo, same material all zones)

| Ticket | Body SKU base | Gama | Extra (scaled) | **Total USD** |
|---|---:|---|---:|---:|
| **Sedán Económica** | POL-SED-COM 55 | Q1 / Económica | 0 × 1.00 | **55** |
| **Sedán Nano** | POL-SED-COM 55 | Supreme / Nano | 125 × 1.00 | **180** |
| **SUV Tinmax** | POL-SUV-COM 75 | Smoke / Tinmax | 55 × 1.35 = 74.25 | **≈149** |
| **Van Premium** | POL-VAN-COM 95 | Quantum Orig / Premium | 180 × 1.65 = 297 | **≈392** |

Full ladder (base + scaled extra):

| body | base | económica | tinmax | nano | premium |
|---|---:|---:|---:|---:|---:|
| hatch | 50 | 50 | 99.5 | 162.5 | 212 |
| sedan | 55 | 55 | 110 | 180 | 235 |
| pickup | 70 | 70 | 136 | 220 | 286 |
| suv | 75 | 75 | 149.25 | 243.75 | 318 |
| van | 95 | 95 | 185.75 | 301.25 | 392 |
| camion | 110 | 110 | 211.75 | 341.25 | 443 |

Partial jobs (POL-DEL / POL-FRA / POL-VEN) keep low bases; fewer zones → fewer extras; optional `partial` multiplier when category maps there.

---

## Code touchpoints

- `backend/domains/tint/window_materials.py` — multipliers, `resolve_body_*`, scale in `quote_tint_window_plan`
- `backend/routes/tint_materials.py` — `WindowPlanPayload.vehicle_category`
- `frontend/.../TintWindowMaterialDialog.jsx` — send category; offline fallback uses same ladder × mult
- Seeds: POL-* Económica bases (POL-TRK-COM → 110)

## Live API (no deploy)

- POL-* product bases already match ladder (SED 55, HB 50, SUV 75, PCK 70, VAN 95, CAM 110, …).
- Tint **materials policy** on Mongo still had old extras (Tinmax **0**). Updated via `PUT /api/tint/window-materials/policy` to sedán-reference ladder + multiplier maps.
- **Body scaling in quotes requires this PR deployed** (runtime reads multipliers). Until deploy, live quotes get correct **gama** ladder but flat body mult (=1.0 in old code).

