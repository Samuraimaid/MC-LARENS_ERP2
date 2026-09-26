# Case chat history / handoff — 2026-09-25 → 26

**Repo:** https://github.com/Samuraimaid/MC-LARENS_ERP2  
**Branch:** `master` (no `main`)  
**Live:** https://mclarens-erp-836176703716.us-central1.run.app  
**Owner:** Xinon · **Zona:** America/Managua (UTC-6)  
**Grok Web:** director · **VS Grok / Antigravity:** FE · **Cloud Shell (`dayavar18`):** merge+deploy

No pegar PINs, PAT ni `gho_` en chats.

---

## 1. Qué se hizo (orden real)

1. U1–U15 ya estaban en master (#82–#96). No reimplementar.
2. P0 live: **B-28113** `visibleSaleIds is not defined` en `/workbench` → **#102**.
3. Tras deploy: **B-58261** `isQueued is not defined` en `/inventory` (FileUploadQueue) → **#103**.
4. UX Inventario apiñado → **#104** (default Cómoda, una toolbar, KPIs bajos, Más, filas 56px).
5. Venta en iPhone apiñada → **#105** (ocultar barra de lista en `<md`, chips scroll, un paso, Cobrar sticky).
6. Taglines de página en móvil → **#106** (`hidden md:block` en ~31 pages).
7. Catálogo: tap en foto = quick view; se quitó el ojito → **#107**.
8. Intento de deploy desde **VS/Windows** (zip ~2.9 GB, tag `20260925_214103`) casi pisa el live → rollback a imagen `20260926_024502` / rev `00191-cwq`.

---

## 2. PRs del día

| PR | Tema | Notas |
|----|------|--------|
| #102 | B-28113 helpers fuera del `.filter` en SalesPage | Commit `5acdc503` |
| #103 | B-58261 `const isQueued` en QueueItem | Primer deploy se hizo **antes** del merge; live seguía roto. Segundo deploy `00186-vcw` OK |
| #104 | Inventario densidad/toolbar | `ce2fdcc2` |
| #105 | Sales móvil | `39bb0a2e` · `00188-gqq` · imagen `20260926_024502` |
| #106 | Ocultar taglines `<md` | `ffe5681b` · `00193-84p` · build `20260926-0405` |
| #107 | Tap imagen = detalle; sin Eye | Tras corte de luz; restaurar `.git/HEAD` a master |

Live al cierre de esta nota: confirmar `gcloud run services describe` (no asumir tag si hubo rollback).

---

## 3. Incidentes y cómo se arreglaron

| Síntoma | Causa | Fix |
|---------|--------|-----|
| `visibleSaleIds is not defined` | Helpers de multi-select **dentro** de `sales.filter` | #102: helpers **después** del filter |
| `isQueued is not defined` | JSX “En cola…” sin `const isQueued` | #103: `item.status === "queued"` junto a isError/isDone/isUploading |
| Deploy #103 no curó el bug | Build de master **sin** el merge | `grep const isQueued` **antes** de `builds submit`; segundo deploy |
| Cloud Shell no pega texto | Clic en editor, no en terminal | Terminal tab + New Terminal |
| `gcloud` project vacío / auth caída | Sesión Cloud Shell nueva | `gcloud config set project gen-lang-client-0971793042` + `gcloud auth login` |
| PowerShell: `Missing expression after unary operator '--'` | Bloque bash pegado en VS Windows | Deploy **solo** Cloud Shell |
| Upload 2.9 GB + tag `214103` | VS Grok `gcloud` desde `D:\` con venvs | Stop. No tocar `.gcloudignore`. Rollback imagen `20260926_024502` |
| HyperVisor “Inspección de Código” | Viewport mobile / setter de PIN en automation | Smoke Grok Web: **solo PC**. Móvil lo prueba Xinon |
| `.git/HEAD` borrado (corte de luz) | Antigravity a medias | Restaurar `master`, terminar #107 |
| `gh pr merge` vs `git pull` | Pull no mergea PRs | Merge GitHub o `gh pr merge` en Cloud Shell **luego** pull |
| Primer `builds submit` sin `--project` | Config no persistida | Siempre `--project gen-lang-client-0971793042` |

**.gcloudignore:** nunca regla bare `uploads` / `uploads/` (#97–#99). Mata `frontend/src/components/uploads`.

---

## 4. Flujo acordado (desde 2026-09-25 22:59)

1. VS Grok: código + PR. **Sin gcloud.** Opcional `gh pr create`.
2. Xinon / Grok Web: número de PR + build verde.
3. Cloud Shell, un bloque: `gh pr merge` → `git pull` → `builds submit && run deploy`.
4. Grok Web: smoke PC + siguiente prompt.

`gh auth login` en Cloud Shell por sesión si hace falta. **Nunca** token en el chat.

### Bloque Cloud Shell (plantilla)

```bash
cd ~/MC-LARENS_ERP2
gcloud config set project gen-lang-client-0971793042
gcloud config set run/region us-central1
PR=NNN
gh pr view $PR --json state,title,mergeable
gh pr merge $PR --merge --delete-branch || true
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

Imagen buena conocida de #105 (rollback): `gcr.io/gen-lang-client-0971793042/mclarens-erp:20260926_024502`.

---

## 5. Preferencias vigentes

- Prompts lote + un bloque pegable.
- UI español.
- Listas: densidades #80 + selección #81.
- Polarizado: matriz gama×carrocería USD 80–300.
- No reescribir U1–U15.
- No mezclar Contabilidad.
- HyperVisor: no emular móvil desde Grok Web.

---

## 6. Pendiente

- QA catálogo: SKU sin foto / recorte / descripción vaga (no hay script visión en el repo; API `/api/products` + revisión por tandas).
- Banner “Modo Selección Venta” compacto en móvil (no iba en #106).
- Auto-merge solo si Xinon lo pone en el prompt VS (`gh pr merge`). Grok Web no tiene write al repo.
