# Plan Antigravity — PR #42 (buscador) + Top 12 API Security Ideas

**Fecha:** 2026-09-22  
**Repo:** https://github.com/Samuraimaid/MC-LARENS_ERP2  
**Base:** `master`  
**Live:** https://mclarens-erp-836176703716.us-central1.run.app  
**Auth smoke:** `POST /api/auth/pin/login` `{"pin":"01011990"}` → Bearer `session_token`  
**Deploy:** `cd ~/MC-LARENS_ERP2 && git pull origin master && ./deploy.sh`  
**Pedido Xinon:** un solo plan de acción que combine el lote del buscador (PR #42) con la realización de las 12 ideas de seguridad API del reel Code Crack.

---

## LEE ESTO PRIMERO

1. PRs **pequeños**, un tema por PR. **No** force-push. Windows: `python`, no `py`.
2. **No** reescribir el monolito ni tocar CRITICAL (auth/drafts/totales/SaleForm submit) sin gap demostrado y tests.
3. Authz se valida **en servidor**; la UI solo oculta.
4. Preferir helpers puros + middleware acotado; no “arreglar de paso” media API.
5. Cloud Run ya da HTTPS; no inventar nginx/WAF propio.
6. Prompt pegable: `docs/ANTIGRAVITY_PROMPT_PR42_API_SECURITY_12_20260922.md`.

---

## Parte A — Buscador catálogo (PR #42) — estado y cierre

### Ya en master (PR #42, `e107a633`)

| Ítem | Estado |
|------|--------|
| Enter cierra autocomplete y deja navegar el grid filtrado | Hecho |
| Multi-término AND (`Dlaa Mitsubishi`) vía `productMatchesSearch` / `getProductSearchableText` | Hecho |
| Focus selecciona todo el texto (estilo barra del navegador) | Hecho |
| SaleForm reutiliza searchable blob + compat | Hecho |
| Doc `docs/CATALOG_SEARCH_UX_STANDARD_20260919.md` | Actualizado |

### Trabajo Antigravity restante (Parte A) — solo si falla smoke post-deploy

| ID | Tarea | Prioridad |
|----|--------|-----------|
| A1 | Smoke live: Enter, multi-término DLAA+Mitsubishi, select-all on focus (móvil + desktop) | P0 |
| A2 | Si 0 resultados con multi-término: ampliar campos searchable (compat ERP matches labels) sin romper AND | P0 |
| A3 | Misma UX Enter/select-all en cualquier otro buscador de productos que aún no la tenga (Inventory si aplica) | P1 |
| A4 | No reabrir scope de Liquid Glass / bombillos salvo bug de regresión | — |

**Criterio de done Parte A:** Xinon confirma en teléfono que Enter / multi-término / select-all funcionan tras deploy.

---

## Parte B — Top 12 API Security Ideas (reel Code Crack)

Fuente exacta (viñetas del reel):

1. Authentication — proves who is calling  
2. Authorization — decides what they may touch  
3. Rate Limiting — caps calls per key, per minute  
4. Input Validation — reject bad shapes at the door  
5. Output Encoding — stops injected markup running  
6. HTTPS Everywhere — no plaintext on the wire  
7. Secret Rotation — keys expire before they leak  
8. Least Privilege — each token gets only its scope  
9. Idempotency Key — a retry cannot charge twice  
10. Audit Logging — who did what, and when  
11. Dependency Scans — your code is mostly theirs  
12. Error Hygiene — stack traces help attackers  

### Gap actual (Case 2026-09-22)

| # | Idea | Estado ERP | Acción plan |
|---|------|------------|-------------|
| 1 | Authentication | Sí (PIN + session_token) | Endurecer sesión: TTL/rotación suave documentada; no inventar OAuth |
| 2 | Authorization | Parcial (roles sí; BOLA dudoso) | Auditar mutaciones dinero/stock; require_roles + ownership donde falte |
| 3 | Rate Limiting | Parcial (PIN IP lockout) | Rate limit middleware en login + mutaciones sensibles |
| 4 | Input Validation | Parcial | Pydantic/schemas en endpoints tocados por este plan |
| 5 | Output Encoding | Parcial | JSON Content-Type; sanitizar campos HTML si existen |
| 6 | HTTPS Everywhere | Sí (Cloud Run) | Verificar HSTS / no http fallback; checklist only |
| 7 | Secret Rotation | Débil | Doc + checklist rotación; no hardcode; env/Secret Manager |
| 8 | Least Privilege | Parcial | Revisar roles en endpoints nuevos; least privilege en tokens sesión |
| 9 | Idempotency Key | **No** | **P0** — header en finalizar venta / cobros (R-039) |
| 10 | Audit Logging | Parcial | Log estructurado mutaciones críticas (sin secretos) |
| 11 | Dependency Scans | **No** | CI: `npm audit` / `pip-audit` o Dependabot config PR |
| 12 | Error Hygiene | Parcial | Handler global: no stack traces en prod |

---

## Orden de ejecución (un solo roadmap)

### Fase 0 — Smoke buscador (antes de seguridad profunda)
1. Confirmar deploy PR #42 (+ #41 si aplica).
2. A1 checklist móvil.
3. Solo si falla → A2/A3 en PR chico `fix/search-…`.

### Fase 1 — P0 Seguridad (máximo valor caja) — **hacer primero en código**

| PR sugerido | Contenido | Ideas # |
|-------------|-----------|---------|
| **S1** | `Idempotency-Key` en `finalizar venta` / cobros / side-effects de dinero; store TTL; retry no duplica | 9 (+8) |
| **S2** | Rate limit: `/api/auth/pin/login` estricto + tope suave en POST mutaciones inventario/ventas; 429 + Retry-After | 3 |
| **S3** | Error hygiene: exception handler prod sin traceback; códigos estables | 12 |

### Fase 2 — P1 Seguridad

| PR sugerido | Contenido | Ideas # |
|-------------|-----------|---------|
| **S4** | Audit log mínimo: user_id, path, action, resource_id, ok/fail (sin PIN/token) | 10 |
| **S5** | Authz pass: sample BOLA en orders/sales/products by id; require_roles gaps | 2, 8 |
| **S6** | Input validation en endpoints tocados por S1–S5 | 4, 5 |

### Fase 3 — P2 Higiene

| PR sugerido | Contenido | Ideas # |
|-------------|-----------|---------|
| **S7** | Dependency scans: workflow GitHub Dependabot o script audit en CI | 11 |
| **S8** | Secret rotation runbook + verificar no bake de PIN en Docker (ya gated) | 7 |
| **S9** | HTTPS/HSTS checklist documentada (Cloud Run) | 6 |
| **S10** | Auth session notes: idle timeout / rotate session_token on privilege change | 1 |

### Fuera de alcance de este plan
- Microservicios, WAF comercial, OAuth completo, MFA obligatorio, reescritura SaleForm.
- Force-push, wipe datos, import Auxbeam masivo, DS18 PDF crop (otro backlog).
- TestSprite u otras tools SaaS de QA.

---

## Smoke checklist (después de cada PR de seguridad)

- [ ] Login PIN OK / lockout tras fallos sigue OK  
- [ ] Finalizar venta 2× con mismo Idempotency-Key → **una** sola venta  
- [ ] Burst a `/api/auth/pin/login` → 429 sin tumbar Cloud Run  
- [ ] Error forzado en prod-like → JSON sin stack trace  
- [ ] Buscador #42: Enter / multi-término / select-all sin regresión  

---

## Archivos / zonas probables

- `backend/server.py` — auth PIN, middleware, exception handlers (tocar mínimo)  
- `backend/routes/` — ventas/caja/inventory según S1–S5  
- Helpers nuevos preferibles: `backend/middleware/rate_limit.py`, `backend/lib/idempotency.py`  
- Frontend solo si hace falta mandar `Idempotency-Key` desde SaleForm (CRITICAL: payload mínimo)  
- Buscador: `frontend/src/pages/CatalogPage.jsx`, `frontend/src/lib/productLookup.js`, SaleForm search  

Docs a actualizar al cerrar: este plan + `docs/ANTIGRAVITY_MASTER.md` + nota en `CRITICAL_ZONES.md` si se toca SaleForm.

---

## Definición de éxito del plan completo

1. Parte A smoke PASS en live.  
2. PRs S1–S3 merged y smoke PASS.  
3. Al menos S4–S6 merged o con issue claro.  
4. S7–S10 documentados o merged.  
5. Ningún force-push; caja/login intactos.
