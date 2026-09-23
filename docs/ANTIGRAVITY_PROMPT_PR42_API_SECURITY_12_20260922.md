# PROMPT PEGABLE — Antigravity: PR #42 buscador + Top 12 API Security

Copia **TODO** este bloque a Antigravity.

---

LEE ESTO PRIMERO

Repo: Samuraimaid/MC-LARENS_ERP2 · branch `master` · **NO force-push** · Windows: `python` no `py`.

Plan completo: `docs/ANTIGRAVITY_PLAN_PR42_API_SECURITY_12_20260922.md`

Live: https://mclarens-erp-836176703716.us-central1.run.app  
Login: `POST /api/auth/pin/login` `{"pin":"01011990"}` → Bearer session_token  
Deploy: `cd ~/MC-LARENS_ERP2 && git pull origin master && ./deploy.sh`

### Contexto

Xinon quiere **un mismo plan** que:
1. Cierre/valide el buscador del **PR #42** (Enter cierra suggest; multi-término AND; select-all on focus).
2. Realice las **12 ideas de API security** del reel Code Crack (lista exacta abajo), en PRs chicos, empezando por caja/dinero.

### Ejemplo before → after

**Before (buscador):** Enter deja el dropdown abierto; `Dlaa Mitsubishi` → 0 resultados; refocus no selecciona texto.

**After (buscador):** Enter cierra suggest y se navega el grid; multi-término encuentra DLAA+Mitsubishi; focus selecciona todo.

**Before (seguridad):** Doble tap / retry de red puede cobrar dos veces; PIN sin tope global de API; errores pueden filtrar stack.

**After (seguridad):** `Idempotency-Key` en finalizar venta; rate limit en login + mutaciones sensibles; errores JSON sin traceback en prod.

### Las 12 ideas (obligatorio cubrir en el roadmap)

1. Authentication  
2. Authorization  
3. Rate Limiting  
4. Input Validation  
5. Output Encoding  
6. HTTPS Everywhere  
7. Secret Rotation  
8. Least Privilege  
9. Idempotency Key  
10. Audit Logging  
11. Dependency Scans  
12. Error Hygiene  

### Orden P0 (implementar primero)

1. Smoke live PR #42 (móvil). Si falla → PR `fix/search-…` mínimo.  
2. **S1 Idempotency-Key** en finalizar venta / cobros (R-039).  
3. **S2 Rate limit** PIN login + mutaciones sensibles (429).  
4. **S3 Error hygiene** — sin stack traces en prod.

### Luego P1 / P2

S4 Audit log mutaciones · S5 Authz/BOLA sample · S6 Input validation en endpoints tocados · S7 Dependency scans CI · S8 Secret rotation runbook · S9 HTTPS/HSTS checklist · S10 Session hardening notes.

### Fuera de alcance

Microservicios, OAuth/MFA completo, WAF comercial, force-push, wipe datos, reescritura SaleForm, TestSprite, Auxbeam import masivo.

### Reglas CRITICAL

No tocar drafts/totales/PIN seed overwrite sin gate. Preferir módulos nuevos (`idempotency.py`, `rate_limit.py`) antes de hinchar `server.py`. UI solo manda header Idempotency-Key si hace falta; authz siempre server-side.

### Smoke por PR

- [ ] Login PIN OK  
- [ ] Misma Idempotency-Key 2× → una venta  
- [ ] Burst login → 429  
- [ ] Error → sin stack en JSON  
- [ ] Buscador #42 sin regresión  

### Entregable

PRs mergeados a master + checklist en el plan markdown. Actualizar `docs/ANTIGRAVITY_PLAN_PR42_API_SECURITY_12_20260922.md` con estado DONE/parcial por idea #1–#12.

---
