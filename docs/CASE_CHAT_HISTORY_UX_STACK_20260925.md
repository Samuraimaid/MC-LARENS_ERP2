# Case chat history / handoff — UX stack + deploy + B-28113 · 2026-09-25

**Para:** Antigravity (clone `master` y leer este archivo + el prompt del bug).  
**Owner:** Xinon · **Ops/docs:** Case  
**Repo:** https://github.com/Samuraimaid/MC-LARENS_ERP2  
**Live:** https://mclarens-erp-836176703716.us-central1.run.app  
**Zona:** America/Managua (UTC-6)

---

## 1. Qué pidió Xinon hoy (orden)

1. Implementar videos UX **U1–U15** en orden (clips `01.mp4`…`15.mp4`), PRs apilados, **sin** merge/deploy hasta el final.
2. Luego: **merge en orden + deploy Cloud Run**.
3. Por tokens: Xinon tomó el **último deploy** en Cloud Shell; Case pasó comandos y arregló blockers de build.
4. Tras deploy live: crash en `/workbench` ticket **B-28113** → brief Antigravity (este paquete).

---

## 2. Stack de producto / UX mergeado (#77–#96)

| PR | Tema |
|----|------|
| #77 | Polarizado modal/split + matriz gama×carrocería |
| #78 | Fuzzy catalog search (cerrado/reabierto según historial; en master) |
| #79 | Inventario traslado camión + WhatsApp |
| #80 | Densidad lista Google (compact/comfortable/Amplia) |
| #81 | Multi-select + floating search + scroll restore |
| #82 U1 | Pull-to-refresh (+ theme persist backend co-landed) |
| #83 U2 | FileUploadQueue uploads honestos |
| #84 U3 | Batch selection polish |
| #85 U4 | Settings architecture |
| #86 U5 | Autosave / drafts |
| #87 U6 | Hold-to-confirm destructive |
| #88 U7 | Swipe rows |
| #89 U8 | Soft-delete / undo / delayed send |
| #90 U9 | Keyboard focus / skip link |
| #91 U10 | Optimistic UI boundaries |
| #92 U11 | Copy verbs / empty / human errors |
| #93 U12 | Validation blur→live + “Se ve bien” |
| #94 U13 | MorphToggle optimistic |
| #95 U14 | Cmd+K / Ctrl+K palette |
| #96 U15 | Password/PIN coaching |

Default branch = **`master`** (no `main`).

---

## 3. Deploy blockers Case → Cloud Shell (ya resueltos)

| PR | Fix |
|----|-----|
| #97 | `.dockerignore`: no usar `uploads` suelto (mataba `src/components/uploads`) |
| #98 | Quitar root uploads ignore; import `FileUploadQueue` por archivo; assert en Dockerfile |
| #99 | **Causa real Cloud Build:** `.gcloudignore` tenía `uploads/` → no subía U2 al contexto. Force-include `frontend/src/components/uploads/**` |

Comando deploy seguro (Xinon Cloud Shell):

```bash
gcloud config set project gen-lang-client-0971793042
cd ~/MC-LARENS_ERP2 && git pull
TAG=$(date +%Y%m%d_%H%M%S)
gcloud builds submit --project gen-lang-client-0971793042 \
  --tag gcr.io/gen-lang-client-0971793042/mclarens-erp:$TAG .
gcloud run deploy mclarens-erp \
  --project gen-lang-client-0971793042 \
  --image gcr.io/gen-lang-client-0971793042/mclarens-erp:$TAG \
  --region us-central1 \
  --update-env-vars BUILD_VERSION=0.2.0-$TAG
```

Live al crash B-28113: `build_version=0.2.0-20260925_220058`, revisión `mclarens-erp-00182-psh`.

---

## 4. Bug abierto P0 — B-28113

- Modal ErrorBoundary en `/workbench`
- `ReferenceError: visibleSaleIds is not defined` en `SalesPage.jsx`
- Código de selección metido **dentro** del `.filter` de `filteredSales`
- **Prompt Antigravity (lote pegable):** `docs/ANTIGRAVITY_PROMPT_BUG_B28113_VISIBLE_SALE_IDS_20260925.md`
- **JSON telemetría:** `docs/crash_reports/B-28113-25_SEP_2026_16-10-13.json`

---

## 5. Preferencias Xinon vigentes (no olvidar)

- Prompts Antigravity: lote con **antes/después**, checklist smoke, **un bloque pegable**.
- Trabajos pesados FE en partes secuenciales.
- Un deploy batch cuando se acuerde; Case puede desplegar con SA `grok-595` vía build+`--update-env-vars`.
- UI en español.
- Listas: densidades + selección + scroll restore homogéneos.
- Polarizado: matriz gama×carrocería USD 80–300 (no recargo plano).

---

## 6. Fuera de alcance / follow-ups

- DS18 crops PDF / 429 PDFs (después UI)
- Checkboxes fila en Transfers/Users/Quotations/HR (follow-up listas)
- No reabrir seed HTTP 410 packs
