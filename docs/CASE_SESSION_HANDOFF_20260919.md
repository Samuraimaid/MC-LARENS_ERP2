# Case → Antigravity / Grok — Handoff sesión 2026-09-19

**Repo:** https://github.com/Samuraimaid/MC-LARENS_ERP2  
**Live:** https://mclarens-erp-836176703716.us-central1.run.app  
**Auth smoke:** `POST /api/auth/pin/login` `{"pin":"01011990"}` → Bearer `session_token`  
**Deploy (Cloud Shell):** `cd ~/MC-LARENS_ERP2 && git pull origin master && ./deploy.sh`  
**Master tip al cerrar este brief:** incluye PR **#37** (`b69b1237`) — bombillos vehículo + FBT DLAA→DS18.  
**Autor handoff:** Case (Grok Bot) para Xinon — continuar si se agotan tokens.

---

## LEE ESTO PRIMERO

1. Preferir **lotes pequeños** (UI o datos), no un mega-prompt.
2. En Windows workshop: usar `python`, **no** `py`.
3. **No** force-push.
4. Terminología: **bombillo** (incandescente vs LED). No usar “Socket/casquillo” en UI.
5. FBT: solo **halógeno DLAA → bombillos LED** (nunca al revés).
6. Excluir **xenón/HID** (D1S/D2S/D3S/D4S).
7. Alias LED: **H11 ↔ H11/H8/H9/H16** (también H4↔9003, 9005↔HB3, 9006↔HB4, H13↔9008).
8. Cloud Agents pueden no estar en el plan → `gh` / patch local / Antigravity en PC taller.

---

## Qué ya está en master (UI — necesita deploy si aún no salió)

| PR | Qué |
|----|-----|
| #33 | RefreshCwIcon mapa lucide-animated |
| #34 | QV 2 col imagen\|precios, scroll, sanitize trash desc, FBT 0/N, carruseles |
| #35 | QV mobile (max-h imagen, footer 2×2, overflow) |
| #36 | Quitar flechas redundantes del header de carruseles |
| #37 | `vehicleCatalog.json` +280 `bombillos` (luz_antiniebla) + FBT QV DLAA→DS18 VIXH/VTLH |

Docs: `docs/BOMBILLO_VEHICLE_FBT_20260919.md`, `docs/ANIMATED_ICONS_LUCIDE_20260919.md`, `docs/LIQUID_GLASS_FASE1_20260919.md`, `docs/CATALOG_SEARCH_UX_STANDARD_20260919.md`.

---

## Qué ya está en LIVE API (no necesita rebuild)

### DLAA enriquecimiento bombillo
- Piloto 20 + resto 33 = **53** elegibles con `bombillo` top-level + `specs.Bombillo` + `led_upsell_eligible=true`
- Tag notes: `dlaa_bombillo_pilot_20260919` / `dlaa_bombillo_rest_20260919`
- Elegibles ≈112 total; **~59** siguen sin bombillo conocido (research pendiente)
- Excluir de upsell: ya LED, DRL

### Auxbeam LED scrape (box Case, no importado a ERP)
- 122 kits / 116 sin xenón → `/workspace/auxbeam_leds/` (en máquina Case; CSV/JSON)
- ERP Auxbeam hoy = pods/barras, **no** bombillos LED

### Vehículos
- 8315 con vector CDN; **280** con `bombillos.luz_antiniebla` en `frontend/src/data/vehicleCatalog.json`
- Otras posiciones (baja/alta/intermitentes/interior) = null (no inventar)

---

## En vuelo al escribir este handoff

- **UX buscador:** con vehículo de cliente seleccionado → bombillos compatibles **primero en verde**, incompatibles **gris** (evitar errores en facturación). Executor Case trabajando; si no mergeó, es **P0 siguiente**.

---

## Pendientes ordenados (para quien continúe)

### P0 — Facturación / vendedores
1. **Buscador verde/gris** por vehículo seleccionado (SaleForm / catálogo / Ctrl+K según dónde viva la selección de vehículo).
2. Smoke post-deploy #37: MB433 QV → VIXH11/VTLH11 en FBT; ASX catálogo vehículos → antiniebla H11.

### P1 — Datos bombillo
3. Research bombillo para ~59 DLAA elegibles sin dato (fuentes OEM / página DLAA campo “bombillo”).
4. Ampliar `bombillos` en vehículos vectoriales más allá de antiniebla (fuentes confiables; HELLA PDF **solo pág.1** = vocabulario, no fitment por modelo).
5. Import piloto bombillos LED Auxbeam (familia halógena, sin xenón) + precios McLarens.

### P2 — Backlog viejo
6. Fotos DS18 mal cortadas PDF; reintento PDFs DS18 si bajó 429.
7. Liquid Glass Fase 2; rollout search UX a SaleForm/Inventory tras smoke.
8. No reabrir P0 seguridad del handoff TARS 2026-09-11 sin brief nuevo.

---

## Archivos clave

| Path | Rol |
|------|-----|
| `frontend/src/components/erp/ProductQuickViewDialog.jsx` | QV / FBT UI |
| `frontend/src/lib/productRecommendations.js` | FBT + aliases |
| `frontend/src/data/vehicleCatalog.json` | bombillos vehículo |
| `frontend/src/pages/CatalogPage.jsx` | search sticky |
| `frontend/src/lib/sanitizeCopy.js` | trash desc |
| `docs/BOMBILLO_VEHICLE_FBT_20260919.md` | brief bombillos |

---

## Preferencias Xinon (Case memory)

- Español; lotes Antigravity pegables (ejemplo before/after, smoke, un bloque).
- Lucide Animated free/MIT (no Lordicon de pago).
- Liquid Glass Fase 1 ya merged (#27/#28).
- Dividir trabajo pesado; pedir ayuda TARS/PATH si es muy pesado.

---

## Prompt pegable

Ver `docs/ANTIGRAVITY_PROMPT_CONTINUAR_BOMBILLOS_20260919.md` en el mismo PR.
