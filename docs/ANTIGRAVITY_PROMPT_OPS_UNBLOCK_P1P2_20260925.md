# PROMPT PEGABLE — Antigravity: Ops Unblock Pack 1+2 (un solo lote, mínimos deploys)

Copia **TODO** este bloque a Antigravity.

---

LEE ESTO PRIMERO

Repo: Samuraimaid/MC-LARENS_ERP2 · `master` · **NO force-push** · Windows: `python` no `py`.

Auditoría fuente: `docs/ERP_DEEP_AUDIT_20260925.md` (P0=5 P1=5 P2=4).  
Live: https://mclarens-erp-836176703716.us-central1.run.app  
Login gerencia: `POST /api/auth/pin/login` `{"pin":"01011990"}`  
Deploy (Xinon): `cd ~/MC-LARENS_ERP2 && git pull origin master && ./deploy.sh`

### Objetivo

Un **solo lote** que implemente **Pack 1 (ops unblock)** + **Pack 2 (higiene)**, en **PRs pequeños** (1 tema o grupo cohesivo por PR), merge a master sin force-push. Preferir **un solo deploy** al final (o máximo dos si el sync de PINs requiere job aparte en Cloud Shell).

**NO** rehacer seguridad Fase 1/2 (idempotency, rate limit, error hygiene) salvo regresión.

### Ejemplo before → after

**Before:** RRHH crea productos; coordinadores no login; PIN bodegas/entregador cruzados; técnicos Test Ausente; KDS del técnico vacío sin assign; FE cobra por path legacy; técnico mueve OT ajena; tint assign sin asistencia.

**After:** RH no hereda gerencia; PINs login+att alineados a `pins_table.json`; KDS muestra cola unassigned del depto al técnico de piso; FE usa `/cashier/invoices/{id}/collect`; PUT WO status con ownership; tint assign exige asistencia como WO.

### Fuera de alcance

OAuth/MFA, WAF, microservicios, wipe DB, cambiar PIN Xinon `01011990`, reescritura SaleForm, Dependabot/HTTPS/backup (Fase 3 docs), forzar BOLA owner-only en ventas same-branch (salvo documentar), Auxbeam/DS18.

---

## PACK 1 — Ops unblock (hacer primero)

### P1-A — Sync PINs live desde seed (P0-ATT / P0-PIN-COORD / P0-PIN-BODEGAS-SWAP)

Fuente de verdad: `backend/data/seeds/pins_table.json`.

Resync **login_pin** + **attendance_pin** (hashes) al menos para:
- Test Coord. Instalaciones → login `00130009` att `0013`
- Test Coord. Polarizados → login `00140000` att `0014`
- Test Bodegas → login `33445566` att `3344` (hoy ese PIN es entregador — **deshacer swap**)
- Test Entregador → login `00150005` att `0015`
- Mia Andres (bodegas) → login `41090003` att `4109`
- Test Instalaciones / Eléctrico / Polarizador attendance → `4455` / `6677` / `7788`

Usar/adaptar `scripts/sync_seed_users_pins.py` si existe; si no, script idempotente + docstring. **No** tocar PIN Xinon.

Smoke: login coords OK; `33445566` → role bodegas; clock-in Test techs att pins OK; assign WO a Test Instalaciones **no** Ausente.

### P1-B — KDS unassigned visible a técnicos de piso (P0-KDS-TECH-FILTER)

Root cause: `build_work_order_visibility_query` fuerza `technician_id=user.user_id` para instalaciones/electrico/polarizador.

Fix: para esos roles, ver department match AND (`technician_id` = self **OR** unassigned/null). Coordinadores/gerencia/supervisor sin regresión.

Smoke: técnico sin assign ve pending de su depto; tras assign ve los suyos; no ve depts ajenos.

### P1-C — Quitar RH→gerencia equivalence (P0-AUTHZ-RH-AS-GERENCIA)

Quitar `ROLE_EQUIVALENCE["recursos_humanos"]="gerencia"`. Respetar `HYPERVISOR_READONLY_ROLES`. RH **no** debe `POST /products` → 403.

Smoke: Test RH PIN `88990011` → POST /products = 403; gerencia sigue OK.

---

## PACK 2 — Higiene (después de Pack 1 en el mismo lote de PRs)

### P2-A — FE cobrar canónico (P1-FE-COBRAR-LEGACY)

`CashierPage.jsx`: cambiar a `POST /cashier/invoices/{sale_id}/collect` (con `sesion_id` + `Idempotency-Key` que ya existe F1). No romper schema de pagos. Legacy server puede quedar o devolver 410 claro.

### P2-B — Ownership en PUT work-order status (P1-WO-CROSS-TECH-STATUS + P1-SELF-PROGRESS)

Field techs (instalaciones/electrico/polarizador): solo mutar status si `technician_id==self` **o** self-claim explícito de unassigned. Gerencia/supervisor/coords exentos.

### P2-C — Tint assign con attendance gate (P1-TINT-NO-ATTENDANCE)

Reusar el mismo gate de asistencia que WO en `assign_tint_order`. Ausente → 400.

### P2-D — Estrechar equivalence jefe_* (P1-JEFE-EQUIV-SUPERVISOR)

No elevar globalmente jefe_tienda/jefe_vendedores a supervisor. Grants explícitos por endpoint donde realmente deban actuar. Smoke: jefes no ganan mutaciones de supervisor no intencionadas.

### P2-E (opcional doc) — Paths canónicos KDS/dispatch

Documentar en 10 líneas paths vivos (`/coordinator/board`, tint assign PUT, etc.). No aliases masivos salvo 1–2 críticos.

---

## Orden de PRs sugerido

1. `fix/sync-seed-pins-attendance-20260925` (P1-A) — puede requerir run del sync contra live Mongo vía Cloud Shell **después** del merge; documentar comando exacto.
2. `fix/kds-unassigned-visible-techs-20260925` (P1-B)
3. `fix/authz-remove-rh-gerencia-equiv-20260925` (P1-C)
4. `fix/cashier-collect-path-fe-20260925` (P2-A)
5. `fix/wo-status-ownership-20260925` (P2-B)
6. `fix/tint-assign-attendance-20260925` (P2-C)
7. `fix/authz-jefe-equivalence-narrow-20260925` (P2-D)

Actualizar `docs/ERP_DEEP_AUDIT_20260925.md` tabla DONE al cerrar.

### Deploy

Preferir **un** `./deploy.sh` cuando Pack 1+2 estén en master. Si sync PINs es job aparte: documentar `python scripts/sync_seed_users_pins.py ...` para Cloud Shell **después** del deploy (mismo “momento de release”).

### Smoke checklist (post-deploy)

- [ ] Login coords 00130009 / 00140000 OK  
- [ ] 33445566 → bodegas; 00150005 → entregador  
- [ ] Clock-in att 4455/6677/7788 OK; assign Test tech ≠ Ausente  
- [ ] KDS tech ve pending unassigned de su depto  
- [ ] RH POST /products → 403  
- [ ] Caja cobro por UI (path collect)  
- [ ] Tech A no PUT status OT de Tech B → 403  
- [ ] Tint assign a Ausente → 400  
- [ ] Login PIN 01011990 + venta/cobro regresión OK  
- [ ] QC gate sigue bloqueando completed sin QC  

### Entregable

PRs merged + resumen + comando deploy + (si aplica) comando sync PINs. Actualizar auditoría con estados DONE/PARCIAL.

Empieza por **P1-A**. No un solo PR gigante que toque todo `server.py` sin tests.

---
