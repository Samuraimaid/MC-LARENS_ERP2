# Case chat history / handoff — 2026-09-25 → 26

**Repo:** https://github.com/Samuraimaid/MC-LARENS_ERP2  
**Branch:** `master` (no `main`)  
**HEAD local/origen al escribir esto:** `0a39cc8f` — Merge pull request #113  
**Live citado al cierre del lote:** https://mclarens-erp-836176703716.us-central1.run.app  
**Revisión live conocida:** `mclarens-erp-00199-qwv` · imagen `20260926_184244` · BUILD `20260926-1845`  
**Owner:** Xinon · **Zona:** America/Managua (UTC-6)  
**Grok Web:** director + prompts · **VS / Antigravity:** código + PR, sin `gcloud` · **Cloud Shell (`dayavar18`, `~/MC-LARENS_ERP2`):** merge en GitHub a mano + `builds submit && run deploy`

**GCP:** project `gen-lang-client-0971793042` · region `us-central1` · service `mclarens-erp`

No pegar PINs, PAT ni `gho_` en chats. `gh` en Cloud Shell suele no estar logueado: el merge es el botón verde en GitHub.

`frontend/public/env.js` en este workspace es el sello local (`0.2.1 | dev`), no el build de Cloud Run. El `git log -1` de `master` (`0a39cc8f`, #113) es más nuevo que el live `20260926-1845`.

---

## 1. Qué se hizo (orden real)

1. U1–U15 ya estaban en master (#82–#96). No reimplementar.
2. P0 live: **B-28113** `visibleSaleIds is not defined` en `/workbench` → **#102**.
3. **B-58261** `isQueued is not defined` en `/inventory` (`FileUploadQueue`) → **#103**.
4. UX Inventario apiñado → **#104** (default Cómoda, una toolbar, KPIs bajos, Más, filas 56px).
5. Venta en iPhone apiñada → **#105** (ocultar barra de lista en `<md`, chips scroll, un paso, Cobrar sticky).
6. Taglines de página en móvil → **#106** (`hidden md:block`).
7. Catálogo: tap en foto = quick view; se quitó el ojito → **#107**.
8. Docs handoff **#108** no está en `master`. Este archivo lo reemplaza.
9. **#109** (sync de borradores + carrito) no mergeó. Lo cubre **#110**.
10. **#110** stay in catalog, sin aviso Leave site, se quitó el badge Guardado, carrito USD/C$.
11. **#111** cabecera de carrito sin cliente duplicado, vehículo/entrega, sin H1 Catálogo ni Actualizar en el workbench, nombre basura = marca + SKU.
12. **#112** toasts Sonner en stack y ocultar buscar / CSV / vistas cuando el formulario de venta o cotización está abierto.
13. **#113** un solo Toaster `top-right` y contraste del liquid glass claro (texto slate, panel más opaco, overlay del modal más suave). Está en `master`. El live citado `20260926-1845` es anterior a este commit.

---

## 2. PRs del tramo

| PR | Tema | En master |
|----|------|-----------|
| #102 | B-28113 `visibleSaleIds` fuera del `.filter` en SalesPage | sí |
| #103 | B-58261 `const isQueued` en QueueItem | sí |
| #104 | Inventario Cómoda, toolbar, KPIs, Más | sí |
| #105 | Venta móvil | sí |
| #106 | Taglines `hidden md:block` | sí |
| #107 | Tap en la foto = detalle, sin ojito | sí |
| #108 | Docs handoff 20260926 | no (este PR lo sustituye) |
| #109 | Draft sync + carrito | no; superseded por #110 |
| #110 | Stay catalog, no leave-site, sin badge Guardado, carrito USD/C$ | sí |
| #111 | Cabecera de carrito, vehículo/entrega, hide H1 Catálogo + Actualizar, basura = brand+SKU | sí |
| #112 | Toasts Sonner + ocultar buscar/CSV/vistas con formulario abierto | sí |
| #113 | Un Toaster top-right + contraste glass claro | sí, posterior al live `20260926-1845` |

---

## 3. Incidentes

- Deploy desde VS/Windows: contexto ~2.9 GB, tag `20260925_214103`. Rollback a imagen `gcr.io/gen-lang-client-0971793042/mclarens-erp:20260926_024502`.
- Cloud Shell abierto en `~`, no en `~/MC-LARENS_ERP2`.
- `gh auth` cancelado. Merge local falló con “not something we can merge”. Merge = botón verde en GitHub.
- Builds de `master` sin el PR (#109 / #110) dejaron el live viejo. `git log -1` tiene que citar el PR antes de celebrar.
- Toaster duplicado: uno `top-center` en `App.js` y otro `top-right` en `MainLayout`. #113 deja solo el de `App.js` en `top-right`.
- HyperVisor: smoke de Grok Web solo en PC. No emular móvil desde Grok Web.
- `.gcloudignore`: nunca una regla suelta `uploads`.

---

## 4. Flujo Cloud Shell (después del merge verde)

```bash
cd ~/MC-LARENS_ERP2
gcloud config set project gen-lang-client-0971793042
gcloud config set run/region us-central1
git fetch origin && git checkout master && git pull --ff-only origin master
git log -1 --oneline
TAG=$(date +%Y%m%d_%H%M%S)
echo TAG=$TAG
gcloud builds submit --project gen-lang-client-0971793042 \
  --tag gcr.io/gen-lang-client-0971793042/mclarens-erp:$TAG . && \
gcloud run deploy mclarens-erp \
  --project gen-lang-client-0971793042 \
  --region us-central1 \
  --image gcr.io/gen-lang-client-0971793042/mclarens-erp:$TAG \
  --update-env-vars BUILD_VERSION=0.2.0-$TAG
```

Imagen buena conocida de rollback (#105): `gcr.io/gen-lang-client-0971793042/mclarens-erp:20260926_024502`.

Nunca `gcloud` desde `D:\` (venv local enorme + tags viejos).

---

## 5. Preferencias vigentes

- Prompts lote + un bloque pegable.
- UI en español.
- Listas: densidades #80 + selección #81.
- Polarizado: matriz gama×carrocería USD 80–300.
- No reescribir U1–U15.
- No mezclar Contabilidad.
- No FE de producto salvo que el prompt lo pida.
- HyperVisor: smoke Grok Web solo PC.
- VS/Antigravity no corre `gcloud`.

---

## 6. Pendiente

- Desplegar `master` `0a39cc8f` (#113) si el live sigue en `mclarens-erp-00199-qwv` / BUILD `20260926-1845`.
- QA de datos de catálogo (nombres OCR). En la card, nombre basura ya se muestra como marca + SKU (#111). No hay PATCH masivo a la BD.
- Banner “Modo Selección Venta” compacto en móvil (no iba en #106).
- Automerge con `gh` cuando haya login en Cloud Shell. Hoy el merge es el botón verde.
