# Polarizado matrix recal — USD $80–$300 (2026-09-25 America/Managua)

**PR:** https://github.com/Samuraimaid/MC-LARENS_ERP2/pull/77  
**Branch:** `feat/lot-b-polarizado-prices-modal-catalog-20260925`  
**Gama names:** unchanged (Gama Económica, Tinmax, Nano Cerámico, Gama Premium)  
**Deploy:** none — hold for single future deploy with Lots A/B/C + view modes

---

## Goal

Full-car tickets land roughly **$80 (floor)** … **~$300 (cap)**:

| Target | Ballpark |
|---|---|
| Sedán Económica | **~80–100** |
| Sedán Nano (mid) | **~150–200** |
| SUV Tinmax (mid) | **~150–160** |
| Van / Camión Premium | **~280–300** |

---

## Formula (unchanged architecture)

```
ticket ≈ POL-* body base (Económica unit/list price)
       + Σ zone extras(gama) × body_surcharge_multiplier(body_class)
```

### POL-* body bases (USD)

| SKU | Body | Base |
|---|---|---:|
| POL-HB-COM | hatch | **80** |
| POL-SED-COM | sedan | **90** |
| POL-PCK-COM | pickup | **100** |
| POL-SUV-COM | suv | **105** |
| POL-VAN-COM | van | **120** |
| POL-TRK-COM | camion | **130** |

### Sedán-reference zone extras

| Gama | windshield | sides | rear | Full-car extra |
|---|---:|---:|---:|---:|
| Gama Económica | 0 | 0 | 0 | **0** |
| Tinmax | 10 | 20 | 10 | **40** |
| Nano Cerámico | 25 | 45 | 25 | **95** |
| Gama Premium | 35 | 50 | 35 | **120** |

### Body multipliers (compressed top end)

| Body | Mult |
|---|---:|
| partial | 0.45 |
| hatch | 0.90 |
| **sedan** | **1.00** |
| pickup | 1.15 |
| suv | 1.25 |
| van | 1.35 |
| camion | 1.40 |

---

## Sample full-car tickets (USD)

| Ticket | Base | Extra (scaled) | **Total** |
|---|---:|---:|---:|
| **Hatch Económica** | 80 | 0 | **80** |
| **Sedán Económica** | 90 | 0 | **90** |
| Sedán Tinmax | 90 | 40 × 1.00 | **130** |
| **Sedán Nano** | 90 | 95 × 1.00 | **185** |
| Sedán Premium | 90 | 120 × 1.00 | **210** |
| **SUV Tinmax** | 105 | 40 × 1.25 = 50 | **155** |
| SUV Nano | 105 | 95 × 1.25 = 118.75 | **≈224** |
| Pickup Premium | 100 | 120 × 1.15 = 138 | **238** |
| **Van Premium** | 120 | 120 × 1.35 = 162 | **282** |
| **Camión Premium** | 130 | 120 × 1.40 = 168 | **298** |

### Full ladder (base + scaled extra)

| body | base | económica | tinmax | nano | premium |
|---|---:|---:|---:|---:|---:|
| hatch | 80 | 80 | 116 | 165.5 | 188 |
| sedan | 90 | 90 | 130 | 185 | 210 |
| pickup | 100 | 100 | 146 | 209.25 | 238 |
| suv | 105 | 105 | 155 | 223.75 | 255 |
| van | 120 | 120 | 174 | 248.25 | **282** |
| camion | 130 | 130 | 186 | 263 | **298** |

Range observed: **80 … 298** (cap ~300).

Partial jobs (POL-DEL / POL-FRA / POL-VEN) keep low bases; fewer zones → fewer extras.

---

## Code / live touchpoints

- `backend/domains/tint/window_materials.py` — ladder + multipliers
- `backend/data/seeds/core_seed.json` + `demo_products.py` — POL-* bases
- `frontend/.../TintWindowMaterialDialog.jsx` — offline ladder × mult
- `backend/tests/test_tint_window_materials.py`
- Live Mongo: materials policy + POL-* prices via API (PIN gerencia) — **no Cloud Run deploy**

