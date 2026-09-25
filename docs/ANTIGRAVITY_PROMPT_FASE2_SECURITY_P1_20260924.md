# PROMPT PEGABLE — Antigravity: Fase 2 Seguridad P1 (S4 / S5 / C2 / S6)

Copia **TODO** este bloque a Antigravity.

---

LEE ESTO PRIMERO

Repo: Samuraimaid/MC-LARENS_ERP2 · branch `master` · **NO force-push** · Windows: `python` no `py`.

Plan maestro: `docs/ANTIGRAVITY_PLAN_PR42_API_SECURITY_12_20260922.md` (v2)

Live (ya con P0 desplegado): https://mclarens-erp-836176703716.us-central1.run.app  
Revisión reciente: tag `20260925_035047` · merge #45/#46/#47 en master  
Login: `POST /api/auth/pin/login` `{"pin":"01011990"}` → Bearer `session_token`  
Deploy: `cd ~/MC-LARENS_ERP2 && git pull origin master && ./deploy.sh`

### Estado previo (NO rehacer)

| Hecho | PR |
|-------|-----|
| Buscador #42 Enter / multi-AND / select-all | #42 |
| S1 Idempotency + C1 money validate | #45 |
| S2 Rate limit PIN + mutaciones | #46 |
| S3 Error hygiene sin stack | #47 |
| Deploy live smoke Xinon OK | 20260925_035047 |

### Objetivo Fase 2 (este lote)

Implementar **P1** del plan, un tema por PR, en este orden:

1. **S4 + C4** — Audit logging de mutaciones críticas (sin PIN/token) + señales de abuso (picos 401/429 / finalize fallido).
2. **S5 + C3** — Authz/BOLA sample en ventas/órdenes/productos por id + `require_roles` en mutaciones dinero/stock; separar mentalmente lecturas vs mutaciones.
3. **C2** — Sesión: idle TTL (sugerido 8–12 h caja) e invalidar al cerrar turno / cambio de privilegio.
4. **S6** — Input validation + output encoding en los endpoints que toques en S4–S5/C2 (schemas/Pydantic; JSON Content-Type; no HTML crudo).

### Bonus chico (si cabe en el mismo sprint, PR aparte)

**F1** — Frontend manda header `Idempotency-Key` (UUID) en finalize/cobro además del fallback `draft_id` (SaleForm/Cashier). CRITICAL: no reescribir totales/drafts; solo header.

### Ejemplo before → after

**Before:** mutaciones de caja sin rastro claro de quién; un id de venta/producto adivinable puede editarse sin chequeo fuerte; sesión PIN puede vivir indefinida; payloads flojos en endpoints tocados.

**After:** cada mutación crítica deja audit (user_id, path, action, resource_id, ok/fail); BOLA sample falla cerrado; sesión expira o se invalida al cierre de turno; inputs validados; front envía Idempotency-Key en cobro/venta.

### Fuera de alcance

OAuth/MFA, WAF, microservicios, force-push, wipe datos, reescritura SaleForm, TestSprite, Auxbeam/DS18 PDF, Dependabot (eso es Fase 3 S7), backup Mongo doc (Fase 3 S10/C5), HTTPS checklist (S9).

### Reglas CRITICAL

- Authz **siempre en servidor**; UI solo oculta.
- No tocar drafts/totales UI / PIN seed overwrite sin gate demostrado.
- Preferir módulos nuevos: p.ej. `backend/core/audit_log.py`, helpers de sesión, no hinchar `server.py` de más.
- Logs: **nunca** PIN, `session_token`, ni Authorization crudo.
- PRs pequeños: `feat/s4-audit-…`, `feat/s5-bola-roles-…`, `feat/c2-session-ttl-…`, `feat/s6-validation-…`, opcional `feat/f1-idempotency-header-…`.
- Actualizar tabla #1–#12 y C1–C5 en el plan markdown al cerrar cada PR.
- Merge a master sin force-push; tests unitarios PASS antes de PR.

### Smoke por PR

**S4:** mutación de venta/cobro genera línea de audit; intento fallido también; sin secretos en log.  
**S5:** usuario sin rol → 403 en mutación ajena/sample; lectura catálogo sigue OK.  
**C2:** sesión vieja / idle → 401; login nuevo OK; cierre turno invalida si existe endpoint.  
**S6:** payload inválido → 422/400 claro; respuesta JSON.  
**F1 (si):** header presente en request finalize; doble submit misma key no duplica.  
**Regresión:** login PIN, una venta normal, buscador #42 Enter/multi/select-all.

### Entregable

1. PRs merged (#S4, #S5, #C2, #S6, opcional #F1).  
2. Tabla del plan actualizada (DONE/PARCIAL).  
3. Resumen corto + comando deploy (Xinon despliega):  
   `cd ~/MC-LARENS_ERP2 && git pull origin master && ./deploy.sh`

Empieza por **S4 + C4**. No hagas un solo PR gigante.

---
