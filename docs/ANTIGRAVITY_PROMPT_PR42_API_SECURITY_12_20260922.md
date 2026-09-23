# PROMPT PEGABLE — Antigravity: PR #42 + Top 12 API Security + endurecimiento Case (v2)

Copia **TODO** este bloque a Antigravity.

---

LEE ESTO PRIMERO

Repo: Samuraimaid/MC-LARENS_ERP2 · `master` · **NO force-push** · Windows: `python` no `py`.

Plan completo: `docs/ANTIGRAVITY_PLAN_PR42_API_SECURITY_12_20260922.md` (**v2**)

Live: https://mclarens-erp-836176703716.us-central1.run.app  
Login: `POST /api/auth/pin/login` `{"pin":"01011990"}` → Bearer session_token  
Deploy: `cd ~/MC-LARENS_ERP2 && git pull origin master && ./deploy.sh`

### Objetivo

Mejor nivel de **ambos**:
1. Cerrar/validar buscador **PR #42** (Enter cierra suggest; multi-término AND; select-all on focus).
2. Cubrir las **12 ideas** del reel Code Crack (#1–#12).
3. Aplicar **endurecimiento Case** (obligatorio): idempotencia + **validación de dinero en servidor (C1)**, rate limit PIN/mutaciones, error hygiene, audit+abuso (C4), BOLA/least privilege (C3), sesión TTL (C2), backup/restore doc (C5).

### Fuera de alcance

OAuth/MFA completo, WAF comercial, microservicios, force-push, wipe datos, reescritura SaleForm, TestSprite, Auxbeam masivo, DS18 PDF crop.

### Ejemplo before → after

**Before:** doble finalize puede cobrar 2×; total del cliente sin validar; PIN sin tope API; sin audit claro; stack en errores; buscador Enter/multi/select-all a medias.  
**After:** `Idempotency-Key` → una venta; servidor valida/recalcula montos; 429 en abuse; audit sin secretos; JSON sin stack; BOLA sample OK; buscador #42 smoke PASS.

### Orden P0 (código primero)

1. Smoke live PR #42 (móvil). Si falla → PR `fix/search-…` mínimo.  
2. **S1** Idempotency-Key en finalizar venta/cobros **+ C1** validar/recalcular totales en servidor.  
3. **S2** Rate limit PIN + mutaciones sensibles (429).  
4. **S3** Error hygiene sin stack en prod.

### Luego P1 / P2

**S4** Audit + notas abuso 401/429/finalize (**C4**) · **S5** BOLA/require_roles (**C3**) · **C2** idle/TTL sesión · **S6** validation/encoding · **S7** dependency scans · **S8** secret rotation runbook · **S9** HTTPS checklist · **S10/C5** backup+restore Mongo documentado.

### Reglas CRITICAL

No tocar drafts/totales UI / PIN seed overwrite sin gate. Módulos nuevos preferidos (`idempotency.py`, `rate_limit.py`, money validate). UI solo manda `Idempotency-Key` si hace falta. Authz siempre server-side. Totales de dinero: **servidor gana**.

### Smoke por PR

- [ ] Login PIN OK  
- [ ] Misma Idempotency-Key 2× → una venta  
- [ ] Total manipulado en cliente → rechazo o corrección servidor  
- [ ] Burst login → 429  
- [ ] Error → sin stack  
- [ ] BOLA sample (S5)  
- [ ] Buscador #42 sin regresión  

### Entregable

PRs a master + tabla #1–#12 y C1–C5 en el plan markdown (DONE/PARCIAL). Actualizar `docs/ANTIGRAVITY_PLAN_PR42_API_SECURITY_12_20260922.md`.

---
