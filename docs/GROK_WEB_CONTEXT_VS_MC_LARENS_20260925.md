# Contexto Case → Grok Web → VS Grok · MC-LARENS ERP2 · 2026-09-25

**Uso:** pega este archivo entero en **Grok Web**. Pídele que guíe a **VS Code Grok** (o que te dé prompts cortos para pegar en VS) sin reinventar trabajo ya hecho.

**Repo canónico:** https://github.com/Samuraimaid/MC-LARENS_ERP2  
**Branch:** `master` (NO `main`)  
**HEAD alineado local Xinon:** `979ea078` (PR #100 docs B-28113)  
**Live:** https://mclarens-erp-836176703716.us-central1.run.app  
**Live build al crash:** `0.2.0-20260925_220058` · revisión Cloud Run `mclarens-erp-00182-psh`  
**Owner:** Xinon · **Zona:** America/Managua (UTC-6)  
**Agente Case (Grok Bot):** ops/docs/deploy; Antigravity/VS Grok = código FE

---

## 1. Quién es quién / repos que NO usar

| Repo | ¿Usar? |
|------|--------|
| **Samuraimaid/MC-LARENS_ERP2** | **SÍ — único canónico** |
| MC-LARENS_ERP-GROK | NO (rama aislada) |
| erp3, mc-larens-erp1, Mc-LarenS-ERP, Mc-LarenS-ERP-v0.2 | NO (viejos) |
| Contabilidad (`C:\Contabilidad`) | Otro proyecto — **nunca** mezclar |

Workspace Xinon: `D:\MC-LARENS_ERP2` (ya en `master` @ `979ea078`). Venvs locales untracked OK: `.venv-win/`, `backend/venv/`.

---

## 2. Objetivo actual (P0)

**Bug live Workbench** ticket `B-28113-25/SEP/2026 16:10:13`  
URL: `/workbench`  
Error: `ReferenceError: visibleSaleIds is not defined`  
Archivo: `frontend/src/pages/SalesPage.jsx`  
Causa: helpers de multi-select (`visibleSaleIds`, `selectedSales`, `exportSelectedSalesCsv`, `copySelectedSaleIds`) quedaron **dentro** del callback de:

`const filteredSales = sales.filter(sale => { ... })`

Deben vivir **después** de cerrar el `.filter`, en el scope del componente.

**Prompt lista para Antigravity/VS (en repo):**  
`docs/ANTIGRAVITY_PROMPT_BUG_B28113_VISIBLE_SALE_IDS_20260925.md`  
**Historial día:** `docs/CASE_CHAT_HISTORY_UX_STACK_20260925.md`  
**JSON crash:** `docs/crash_reports/B-28113-25_SEP_2026_16-10-13.json`  
**Telemetría GET:** `/api/telemetry/crash-report/B-28113-25%2FSEP%2F2026%2016%3A10%3A13`

---

## 3. Qué YA está en master (NO reimplementar)

### Producto / UX PRs mergeados
#77 polarizado matriz+modal · #78 fuzzy search · #79 traslado+WA Inventario · #80 densidades lista · #81 multi-select+scroll  
#82 U1 pull-to-refresh (+ theme backend) · #83 U2 uploads · #84 U3 batch · #85 U4 settings · #86 U5 autosave · #87 U6 hold-confirm · #88 U7 swipe · #89 U8 undo/delay · #90 U9 a11y · #91 U10 optimistic · #92 U11 copy · #93 U12 validation blur→live · #94 U13 MorphToggle · #95 U14 Cmd+K · #96 U15 password coaching

### Fixes deploy Cloud Build
#97–#99: **nunca** poner en `.dockerignore` / `.gcloudignore` una regla bare `uploads` / `uploads/` — borra `frontend/src/components/uploads` (FileUploadQueue U2). Live ya construye con assert Dockerfile.

### Docs
#100: handoff B-28113 + historial Case.

---

## 4. Preferencias Xinon

- Prompts: **lote** con antes/después + checklist smoke + **un bloque pegable**.
- FE pesado en partes secuenciales.
- UI español.
- Listas: densidades Google + selección flotante + scroll restore.
- Polarizado: matriz gama×carrocería USD 80–300 (no recargo plano).
- Deploy: Case SA puede; hoy Xinon prefiere Cloud Shell. Path seguro:
  `gcloud builds submit --tag gcr.io/gen-lang-client-0971793042/mclarens-erp:$TAG .`
  luego `gcloud run deploy mclarens-erp --update-env-vars BUILD_VERSION=0.2.0-$TAG`
  Project: `gen-lang-client-0971793042` · region `us-central1` · **no** cleanup destructivo de `deploy.sh` en la box.
- Tokens bajos: prompts cortos a VS Grok; contexto largo aquí en Grok Web.

---

## 5. Cómo guía Grok Web a VS Grok

1. Confirmar VS abierto en `D:\MC-LARENS_ERP2` @ `master` = `origin/master`.
2. Si diverge: `git fetch` + `git reset --hard origin/master` (stash antes si hay cambios locales).
3. Pedir a VS Grok **solo el fix B-28113** (mover bloque fuera del filter) + `npm run build` verde.
4. PR pequeño; Xinon decide merge/deploy.
5. Smoke: `/workbench` sin modal "Incidencia Técnica"; barra selección ventas OK.

### Prompt corto para pegar en VS Grok (P0)

```
En D:\MC-LARENS_ERP2 @ master: lee docs/ANTIGRAVITY_PROMPT_BUG_B28113_VISIBLE_SALE_IDS_20260925.md y aplica SOLO ese fix en frontend/src/pages/SalesPage.jsx (sacar visibleSaleIds/helpers fuera del .filter de filteredSales). npm run build debe quedar verde. PR pequeño. No despliegues. No toques Contabilidad ni .gcloudignore uploads.
```

### Prompt sync (si el clone se atrasa)

```
Alinea D:\MC-LARENS_ERP2 a origin/master (ff o reset --hard si diverge), confirma HEAD ≥ 979ea078, frontend: npm install --legacy-peer-deps && npm run build. No despliegues.
```

---

## 6. Errores que ya vimos hoy (para no repetir)

| Síntoma | Causa | Fix |
|---------|--------|-----|
| docker build sin Dockerfile | Cloud Shell en `~` | `cd ~/MC-LARENS_ERP2` |
| gcloud sin project | config vacío | `gcloud config set project gen-lang-client-0971793042` o `--project` |
| Vite ENOENT components/uploads | `.gcloudignore` `uploads/` | #99 |
| VS Grok en Contabilidad | workspace malo | abrir MC-LARENS_ERP2 |
| pull ff-only abort | master local divergió | `git reset --hard origin/master` |
| localhost:3000 refused | no hay server local | ignorar hasta correr FE |

---

## 7. Instrucción a Grok Web (meta)

Actúa como **director de proyecto**. Mantén a VS Grok en pasos pequeños. No reescribas U1–U15. Prioridad: **B-28113**. Cuando VS reporte build verde + PR, resume a Xinon en español claro qué falta (merge/deploy). Nunca pidas pegar secretos/PINs en el chat.
