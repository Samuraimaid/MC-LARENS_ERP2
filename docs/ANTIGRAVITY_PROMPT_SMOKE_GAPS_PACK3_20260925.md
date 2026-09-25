# PROMPT PEGABLE — Antigravity: Pack 3 Smoke Gaps + Ops Hygiene (un solo lote)

Copia **TODO** este bloque a Antigravity.

---

LEE ESTO PRIMERO

Repo: Samuraimaid/MC-LARENS_ERP2 · `master` · **NO force-push** · Windows: `python` no `py`.

Contexto live (ya desplegado Pack 1+2):
- Revisión: `mclarens-erp-00165-bsh` · tag `20260925_063811`
- URL: https://mclarens-erp-836176703716.us-central1.run.app
- Smoke Pack 1+2: **GO_WITH_CAVEATS** (evidencia Case: PINs OK, KDS unassigned OK, RH≠gerencia OK, WO ownership OK, tint Ausente→400 OK)
- Sync PINs live ya hecho vía `POST /api/auth/pin/sync-all` (76 users). **No** cambiar PIN Xinon `01011990`.
- Deploy Xinon: `cd ~/MC-LARENS_ERP2 && git pull origin master && ./deploy.sh`
- Tras deploy, si hace falta re-sync PINs: `POST /api/auth/pin/sync-all` (hoy sin auth — hay que endurecerlo en este lote)

### Objetivo

Cerrar los **gaps del smoke Pack 1+2** + higiene ops que el smoke/despliegue expuso. PRs pequeños (1 tema por PR), merge sin force-push. Preferir **un solo deploy** al final.

**NO** rehacer Pack 1+2 (KDS/RH/ownership/tint/jefe) salvo regresión.
**NO** rehacer Fase 1/2 seguridad (idempotency en create sale, rate limit, error hygiene) salvo el gap de **collect**.

### Ejemplo before → after

**Before (live smoke 2026-09-25):**
1. `POST /cashier/invoices/{id}/collect` con `amount=0.01` sobre factura ~$16 → **200** y deja `amount_pending` (parcial silencioso). Create-sale sí tiene `TOTAL_MISMATCH`; collect no.
2. `POST /work-orders` a veces persiste OT con `work_order_id=null` → basura en KDS.
3. `deploy.sh` usa `--set-env-vars` solo con `BUILD_*` → **borra** el resto de env del servicio Cloud Run en cada deploy.
4. `POST /api/auth/pin/sync-all` funciona **sin autenticación**.
5. Cloud Run sin `MONGO_URL` en env; el backend cae a un **fallback Atlas hardcodeado** en `backend/db/distributed.py` (`DEFAULT_PROD_ATLAS_URI` cuando existe `K_SERVICE`).
6. Legacy `POST /caja/facturas/{id}/cobrar` sigue aceptando requests (FE ya usa collect).
7. `/api/health` reporta `version=dev` / build vacío aunque Cloud Run tenga `BUILD_VERSION`.

**After:**
1. Collect exige monto completo pendiente (o flag explícito `allow_partial=true` documentado); underpay sin flag → **409/400** con código claro (`TOTAL_MISMATCH` o `AMOUNT_MISMATCH`), no parcial silencioso.
2. Toda OT creada tiene `work_order_id` no-null (generación idempotente); script/endpoint one-shot para cancelar OT huérfanas `work_order_id=null` + notas AUDIT_SMOKE si existen.
3. `deploy.sh` usa `--update-env-vars` (o equivalente) para **no** wipear env existentes; documentar en comentario.
4. `POST /auth/pin/sync-all` requiere gerencia (o programador) + auth Bearer; 401/403 sin sesión.
5. Sin URI Atlas en código fuente; Cloud Run **debe** tener `MONGO_URL` (o `MONGODB_LOCAL_URI`); si falta en `K_SERVICE` → fail-fast al boot con log claro. Migrar secreto a env Cloud Run / Secret Manager (documentar comando `gcloud run services update ... --update-env-vars` o `--set-secrets` **sin** pegar la URI en el PR/chat).
6. Legacy cobrar → **410 Gone** con body que apunta al path canónico (o alias interno 1:1 a collect, pero preferir 410).
7. Health expone `BUILD_VERSION` / `BUILD_TIMESTAMP` desde env.

### Fuera de alcance

OAuth/MFA, WAF, microservicios, wipe DB, cambiar PIN Xinon, reescritura SaleForm, Auxbeam/DS18/Liquid Glass, Fase 3 Dependabot/HSTS/backup docs (salvo 5 líneas de nota), BOLA owner-only ventas, nuevas features KDS.

---

## P0 — Hacer primero

### P0-A — Collect: no parcial silencioso

Archivos típicos: `backend/server.py` (cashier collect), `backend/core/money_validate.py` / `validation_encoding.py` si aplica, tests.

Regla:
- Si `amount` < `amount_pending` (o total pendiente) **y** no viene `allow_partial=true` (o campo ya existente equivalente) → rechazar con **409** o **400** y código estable (`TOTAL_MISMATCH` / `AMOUNT_MISMATCH`).
- Si `allow_partial=true`, documentar y cubrir con test.
- Idempotency-Key debe seguir funcionando.
- FE `CashierPage.jsx`: si hoy manda pagos parciales a propósito, respetar el flag; si el UX de caja es “cobrar saldo completo”, no enviar underpay.

Smoke: factura pendiente $16; collect $0.01 sin flag → 4xx; collect monto completo → 200; create-sale TOTAL_MISMATCH sin regresión.

### P0-B — `work_order_id` nunca null en create

Root: `POST /work-orders` (y cualquier path que cree WO desde venta/despacho) a veces deja `work_order_id=null`.

Fix:
- Generar `work_order_id` **antes** del insert (mismo patrón que sales `sale_…` / wo_…).
- Test unitario: create → campo presente y único.
- One-shot safe: cancelar/archivar WOs existentes con `work_order_id` null o missing (filtro + status cancelled), log count. No wipe masivo.

Smoke: create WO → id no null; KDS no muestra filas sin id.

### P0-C — Quitar Atlas URI hardcodeada + exigir env en Cloud Run

Archivo: `backend/db/distributed.py` (`DEFAULT_PROD_ATLAS_URI`, `resolve_local_mongo_uri`).

- Eliminar credenciales/URI del repo.
- `resolve_local_mongo_uri`: env (`MONGODB_LOCAL_URI` / `MONGO_URL` / `MONGODB_URI`) o localhost en dev; en `K_SERVICE` sin env → **raise/log fatal** (no fallback secreto).
- Documentar en `deploy/cloud.env.example` + README corto: cómo setear `MONGO_URL` en Cloud Run **sin** commitear secretos.
- En el PR: checklist para Xinon/Cloud Shell **después** del merge, antes o junto al deploy:
  ```bash
  # Ejemplo (URI desde Secret Manager o pegada solo en shell, NO en git):
  gcloud run services update mclarens-erp --region=us-central1 --project=gen-lang-client-0971793042 \
    --update-env-vars "MONGO_URL=... ,DB_NAME=mc-larens2_mundo_accesorios_erp"
  ```
  (Antigravity: **no** escribir la URI real en el PR.)

### P0-D — Auth en `POST /auth/pin/sync-all`

Hoy sync-all es público. Requiere rol gerencia (y/o programador). Sin token → 401/403.
Smoke: sin auth → 401/403; con gerencia → 200.

---

## P1 — Después (mismo lote de PRs)

### P1-A — `deploy.sh` no wipear env

Cambiar `--set-env-vars` de solo BUILD_* por `--update-env-vars` (o leer env actual y merge). Comentario en script explicando el footgun.
Smoke doc: tras deploy, `gcloud run services describe ...` sigue mostrando `MONGO_URL`/`DB_NAME` si estaban.

### P1-B — Legacy cobrar → 410

`POST /caja/facturas/{id}/cobrar` → 410 con mensaje apuntando a `/cashier/invoices/{id}/collect`. Tests.

### P1-C — Health build metadata

`/api/health` incluye `version`/`build_id`/`build_time` desde `BUILD_VERSION`/`BUILD_TIMESTAMP` (o equivalentes).

### P1-D (doc) — Runbook post-deploy PINs

Actualizar `docs/ERP_DEEP_AUDIT_20260925.md` o doc corto: post-deploy sync = `POST /api/auth/pin/sync-all` **con** sesión gerencia (tras P0-D). Mencionar que `scripts/sync_seed_users_pins.py --mongo` es alternativa si hay `MONGO_URL` en shell.

---

## Orden de PRs sugerido

1. `fix/cashier-collect-no-silent-partial-20260925` (P0-A)
2. `fix/work-order-id-never-null-20260925` (P0-B)
3. `fix/mongo-uri-env-only-cloud-run-20260925` (P0-C) — **coordinar** con Xinon el set de env **antes** del deploy que quite el fallback
4. `fix/auth-pin-sync-all-gerencia-20260925` (P0-D)
5. `fix/deploy-sh-update-env-vars-20260925` (P1-A)
6. `fix/legacy-cobrar-410-20260925` (P1-B)
7. `fix/health-build-metadata-20260925` (P1-C) + doc P1-D

**Orden de release crítico:** merge P0-C solo cuando `MONGO_URL` ya esté en Cloud Run (o en el mismo cambio de `gcloud` documentado). Si se despliega P0-C sin env → app no conecta Mongo.

### Deploy

Un `./deploy.sh` al final **después** de que `MONGO_URL` esté en el servicio (P0-C). Preferir: (1) set env Mongo, (2) merge+deploy código, (3) smoke, (4) sync-all con gerencia si hace falta.

### Smoke checklist (post-deploy)

- [ ] Login `01011990` OK
- [ ] Collect underpay sin flag → 4xx; full amount → 200
- [ ] Create WO → `work_order_id` presente; KDS sin null-id
- [ ] `POST /auth/pin/sync-all` sin token → 401/403; con gerencia → 200
- [ ] `gcloud describe` muestra `MONGO_URL` (no solo BUILD_*) tras deploy
- [ ] Legacy cobrar → 410
- [ ] `/api/health` muestra build no-`dev` vacío
- [ ] Regresión: RH POST products 403; KDS unassigned; WO cross-tech 403; tint Ausente 400

### Entrega

PRs mergeados, tabla DONE en doc, comando exacto post-deploy para Xinon (env Mongo + deploy + sync-all auth).
