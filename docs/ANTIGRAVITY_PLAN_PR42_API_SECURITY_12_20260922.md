# Plan Antigravity — PR #42 (buscador) + Top 12 API Security + endurecimiento Case

**Fecha:** 2026-09-22 (v2 — merge reel Code Crack + recomendaciones Case)  
**Repo:** https://github.com/Samuraimaid/MC-LARENS_ERP2  
**Base:** `master`  
**Live:** https://mclarens-erp-836176703716.us-central1.run.app  
**Auth smoke:** `POST /api/auth/pin/login` `{"pin":"01011990"}` → Bearer `session_token`  
**Deploy:** `cd ~/MC-LARENS_ERP2 && git pull origin master && ./deploy.sh`  
**Pedido Xinon:** un solo plan que combine el lote del buscador (PR #42), las **12 ideas** del reel, y el **endurecimiento Case** (caja/dinero/sesión/BOLA/ops) hasta el mejor nivel práctico de ambos.

---

## LEE ESTO PRIMERO

1. PRs **pequeños**, un tema por PR. **No** force-push. Windows: `python`, no `py`.
2. **No** reescribir el monolito ni tocar CRITICAL (auth/drafts/totales/SaleForm submit) sin gap demostrado y tests.
3. Authz se valida **en servidor**; la UI solo oculta.
4. Preferir helpers puros + middleware acotado; no “arreglar de paso” media API.
5. Cloud Run ya da HTTPS; no inventar nginx/WAF propio, OAuth completo ni MFA obligatorio en caja.
6. Prompt pegable: `docs/ANTIGRAVITY_PROMPT_PR42_API_SECURITY_12_20260922.md`.
7. El front puede mostrar totales; **el backend valida o recalcula montos** en mutaciones de dinero.

---

## Principio del plan (mejor de ambos)

| Fuente | Aporta | Cómo lo usamos |
|--------|--------|----------------|
| Reel Top 12 | Checklist completo de higiene API | Cobertura #1–#12 con estado DONE/parcial al cerrar |
| Case / McLarens | ROI de caja: no cobrar dos veces, no martillar PIN, BOLA, dinero en servidor, abuso, backups | Orden real de PRs y criterios de done |

**No hacer ahora:** OAuth/MFA completo, WAF comercial, microservicios, reescritura SaleForm “por seguridad”, TestSprite, Auxbeam import masivo, DS18 PDF crop.

---

## Parte A — Buscador catálogo (PR #42) — estado y cierre

### Ya en master (PR #42)

| Ítem | Estado |
|------|--------|
| Enter cierra autocomplete; grid filtrado navegable | Hecho |
| Multi-término AND (`Dlaa Mitsubishi`) | Hecho |
| Focus selecciona todo el texto | Hecho |
| SaleForm searchable + compat | Hecho |
| Doc `docs/CATALOG_SEARCH_UX_STANDARD_20260919.md` | Actualizado |

### Restante Parte A (solo si falla smoke)

| ID | Tarea | Prioridad |
|----|--------|-----------|
| A1 | Smoke live móvil/desktop: Enter, multi-término, select-all | P0 |
| A2 | Si 0 resultados multi-término: ampliar searchable blob sin romper AND | P0 |
| A3 | Misma UX en Inventory u otros buscadores de producto si aún no | P1 |

**Done Parte A:** Xinon confirma en teléfono post-deploy.

---

## Parte B — Top 12 (reel) mapeadas a trabajo concreto

| # | Idea | Gap ERP | Acción (PR) |
|---|------|---------|-------------|
| 1 | Authentication | Sí básico | **C2** idle/TTL sesión + invalidar al cambio de rol/cierre turno |
| 2 | Authorization | Parcial | **S5** BOLA sample + require_roles en mutaciones |
| 3 | Rate Limiting | Parcial (PIN) | **S2** login estricto + mutaciones sensibles |
| 4 | Input Validation | Parcial | **S6** schemas en endpoints tocados |
| 5 | Output Encoding | Parcial | **S6** JSON Content-Type; sin HTML crudo |
| 6 | HTTPS Everywhere | Sí Cloud Run | **S9** checklist HSTS / no http |
| 7 | Secret Rotation | Débil | **S8** runbook + sin bake PIN en imagen |
| 8 | Least Privilege | Parcial | **S5** + roles en mutaciones dinero/stock |
| 9 | Idempotency Key | **No** | **S1** finalizar venta / cobros |
| 10 | Audit Logging | Parcial | **S4** mutaciones críticas sin secretos |
| 11 | Dependency Scans | **No** | **S7** Dependabot o audit CI |
| 12 | Error Hygiene | Parcial | **S3** sin stack en prod |

---

## Parte C — Endurecimiento Case (extra al reel, obligatorio en este plan)

| ID | Qué | Por qué | Fase |
|----|-----|---------|------|
| **C1** | Validación/recalc de montos, impuestos y descuentos **en servidor** al finalizar venta | El cliente no es fuente de verdad del dinero | Con **S1** |
| **C2** | Sesión: TTL o idle timeout (sugerido 8–12 h caja); invalidar al cerrar turno / cambio de privilegio | PIN + token largos = riesgo en taller | Tras S2–S3 |
| **C3** | Separar mentalmente lecturas (catálogo) vs mutaciones (venta, anulación, ajuste stock, precios) | Menos superficie privilegiada | Guía S5 |
| **C4** | Observabilidad de abuso: métricas/logs de picos 401/429 en PIN, fallos de finalize en ráfaga | Detectar script o ataque temprano | Con **S4** |
| **C5** | Ops: backup Mongo + restore de prueba documentado (frecuencia sugerida mensual) | Un wipe duele más que un XSS teórico | **S10** doc |
| **C6** | Rate limit también por señal de dispositivo/sesión si ya existe header estable; si no, IP + user tras login | Complementa S2 | Opcional en S2 |

---

## Orden de ejecución (roadmap único)

### Fase 0 — Smoke buscador
1. Confirmar deploy PR #42 (+ #41 si aplica).
2. A1. Solo si falla → A2/A3 en PR `fix/search-…`.

### Fase 1 — P0 Caja / dinero (máximo ROI) — **código primero**

| PR | Contenido | Ideas # + Case |
|----|-----------|----------------|
| **S1** | `Idempotency-Key` en finalizar venta / cobros; store TTL; retry no duplica. **+ C1** validar/recalcular totales en servidor (payload mínimo; no reescribir SaleForm) | 9, 8 + C1 |
| **S2** | Rate limit: `/api/auth/pin/login` estricto; tope suave en POST mutaciones inventario/ventas; 429 + Retry-After. Opcional C6 | 3 + C6 |
| **S3** | Error hygiene: handler prod sin traceback; códigos estables | 12 |

### Fase 2 — P1 Authz / evidencia

| PR | Contenido | Ideas # + Case |
|----|-----------|----------------|
| **S4** | Audit log: user_id, path, action, resource_id, ok/fail (sin PIN/token). **+ C4** notas/queries para picos 401/429 y finalize fallido | 10 + C4 |
| **S5** | Authz/BOLA: sample orders/sales/products by id; require_roles en mutaciones dinero/stock (**C3**) | 2, 8 + C3 |
| **S6** | Input validation + output encoding en endpoints tocados por S1–S5 | 4, 5 |
| **C2** | (PR propio o cola de S5) idle/TTL sesión + invalidación turno/rol | 1 |

### Fase 3 — P2 Higiene / ops

| PR | Contenido | Ideas # + Case |
|----|-----------|----------------|
| **S7** | Dependency scans: Dependabot o `npm audit` / `pip-audit` en CI | 11 |
| **S8** | Secret rotation runbook; verificar no bake PIN en Docker | 7 |
| **S9** | HTTPS/HSTS checklist (Cloud Run) | 6 |
| **S10 / C5** | Backup + restore Mongo documentado; session notes si C2 no cerró | 1 + C5 |

---

## Ejemplo before → after

**Buscador before:** Enter deja suggest abierto; `Dlaa Mitsubishi` → 0; focus no selecciona.  
**Buscador after:** Enter cierra suggest; AND multi-término; select-all on focus.

**Seguridad before:** Doble tap puede cobrar dos veces; PIN sin tope API global; total confiado al front; sin audit claro; errores con stack.  
**Seguridad after:** Misma `Idempotency-Key` → una venta; totales validados en servidor; rate limit PIN/mutaciones; audit de mutaciones; JSON de error sin traceback; BOLA chequeado en sample crítico.

---

## Smoke checklist (cada PR de seguridad)

- [ ] Login PIN OK / lockout sigue OK  
- [ ] Finalizar venta 2× mismo Idempotency-Key → **una** venta  
- [ ] Total manipulado en cliente → servidor rechaza o corrige  
- [ ] Burst `/api/auth/pin/login` → 429  
- [ ] Error forzado → JSON sin stack  
- [ ] Usuario sin rol no muta recurso ajeno (sample S5)  
- [ ] Buscador #42: Enter / multi-término / select-all sin regresión  

---

## Archivos / zonas probables

- `backend/server.py` — mínimo; preferir módulos nuevos  
- Nuevos preferibles: `backend/lib/idempotency.py`, `backend/middleware/rate_limit.py`, `backend/lib/money_validate.py` (nombre libre)  
- Rutas ventas/caja/inventory según S1–S5  
- Frontend: solo header `Idempotency-Key` desde SaleForm si hace falta (**CRITICAL**: no tocar drafts/totales UI)  
- Buscador: `CatalogPage.jsx`, `productLookup.js`, SaleForm search  
- Docs: este plan, `ANTIGRAVITY_MASTER.md`, nota en `CRITICAL_ZONES.md` si se toca SaleForm  

---

## Tabla de cierre (actualizar al terminar)

Marcar cada fila DONE / PARCIAL / N/A:

| # | Idea | Estado | PR / Implementación |
|---|------|--------|---------------------|
| Buscador | PR #42 UX Buscador (Enter, AND multi-término, Select-all) | **DONE** | PR #42 (`productLookup.js`, `CatalogPage.jsx`, `SaleForm.jsx`) |
| 1 | Authentication (idle/TTL sesión) | **DONE** | PR C2 (`backend/domains/auth/session_policy.py`, `backend/core/session_security.py`, cajero idle 10h/600m para turno continuo, ventas 5m, invalidación en cierre de caja y cambio de rol) |
| 2 | Authorization (BOLA sample + require_roles) | **DONE** | PR S5 (`backend/core/authz_bola.py`, mitigación BOLA en /sales/{id}, /work-orders/{id}, /samples/{id}, require_roles en dinero y stock) |
| 3 | Rate Limiting (PIN estricto + mutaciones 429) | **DONE** | PR S2 (`backend/middlewares/rate_limit.py`, `RateLimitMiddleware` con tope ráfaga 5/10s en PIN y 60/min en mutaciones, 429 + Retry-After) |
| 4 | Input Validation (schemas en endpoints tocados) | **DONE** | PR S6 (`backend/core/validation_encoding.py`, validación de tipos, rangos finitos, longitudes y saneamiento en /sales, /cashier/collect, /caja/anular, /auth/pin/login, URLs seguras sin path traversal) |
| 5 | Output Encoding (JSON Content-Type, sin HTML crudo) | **DONE** | PR S6 (`backend/core/validation_encoding.py`, neutralización de scripts/etiquetas HTML en cadenas salientes, cabeceras MIME estrictas application/json y X-Content-Type-Options: nosniff) |
| 6 | HTTPS Everywhere (Cloud Run checklist) | PENDIENTE (Fase 3) | S9 |
| 7 | Secret Rotation (runbook + no bake PIN en imagen) | PENDIENTE (Fase 3) | S8 |
| 8 | Least Privilege (roles en mutaciones dinero/stock) | **DONE** | PR S5 + C3 (`backend/core/authz_bola.py`, roles restringidos en creación de ventas, cobro/anulación de facturas, inventario/productos) |
| 9 | Idempotency Key (finalizar venta / cobros con store TTL) | **DONE** | PR S1 (`backend/core/idempotency.py`, TTL index 24h, `/api/sales`, `/caja/facturas/cobrar`, `/cashier/invoices/collect`) |
| 10 | Audit Logging (mutaciones críticas sin secretos) | **DONE** | PR S4 (`backend/core/audit_log.py`, redacción estricta de PINs/tokens/Bearer, trazabilidad en /sales, /caja/facturas, /auth/pin/login, status ok/fail) |
| 11 | Dependency Scans (Dependabot o audit CI) | PENDIENTE (Fase 3) | S7 |
| 12 | Error Hygiene (handler prod sin traceback) | **DONE** | PR S3 (`backend/core/error_handler.py`, manejador global de excepciones sin exposición de stack trace en prod, JSON sanitizado) |
| **C1** | Validación/recalc de montos en servidor (servidor gana, 409 TOTAL_MISMATCH) | **DONE** | PR S1 + C1 (`backend/core/money_validate.py`, saneamiento de ítems, totales garantizados en servidor) |
| **C2** | Sesión: TTL o idle timeout (invalidar al cierre de turno / cambio rol) | **DONE** | PR C2 (`backend/core/session_security.py`, `invalidate_user_sessions` en `/caja/cierre` y `/users/{user_id}/role`, cajero 10h idle dentro de 8–12h) |
| **C3** | Separar lecturas de mutaciones privilegiadas | **DONE** | PR S5 + C3 (catálogos y productos legibles abiertamente por usuarios autenticados; mutaciones blindadas bajo roles estrictos y 403 Forbidden) |
| **C4** | Observabilidad de abuso (métricas/logs 401/429/finalize) | **DONE** | PR S4 + C4 (`backend/core/audit_log.py`, `AbuseSignalTracker` con detección en tiempo real de ráfagas 401_BURST, 429_SPIKE y FINALIZE_FAIL, persistencia en `security_abuse_events`) |
| **C5** | Ops: backup Mongo + restore de prueba documentado | PENDIENTE (Fase 3) | S10 / C5 |

---

## Definición de éxito

1. Parte A smoke PASS.  
2. S1–S3 + C1 merged y smoke PASS.  
3. S4–S6 + avance C2/C3/C4 merged o issues claros.  
4. S7–S10 + C5 documentados o merged.  
5. Tabla #1–#12 y C1–C5 actualizada.  
6. Sin force-push; caja/login intactos.
