# MC-LARENS_ERP2 — Handoff para Antigravity

**Repo:** https://github.com/Samuraimaid/MC-LARENS_ERP2  
**Branch base:** `master`  
**Fecha del brief:** 2026-09-11 (actualizado reels 2026-09-11)  
**Autor del brief:** TARS (análisis remoto vía GitHub API + cruce con prácticas de Torti Code / canales afines)  
**Objetivo:** que Antigravity (con permisos totales) aplique mejoras de seguridad, authz, higiene de repo y refactors *seguros*, sin romper contratos de ventas/caja/login.

---

## 0. Contexto del sistema (no reinventar)

| Pieza | Hecho verificado |
|--------|------------------|
| Stack | FastAPI (`backend/`) + React/Vite (`frontend/`) + MongoDB (Motor) |
| Deploy | Docker multi-stage unificado → Google Cloud Run |
| Auth | Login por PIN + cookies de sesión; permisos por rol (`/permissions/me`, roles comerciales, gerencia, etc.) |
| Dominios de negocio | Ventas, cotizaciones, caja, inventario, RRHH, tintado/polarizados, vehículos (~16k), warranties, approvals |
| Deuda principal | Monolito `backend/server.py` (~1 MB), `frontend/src/components/sales/SaleForm.jsx` (~300 KB), contratos frágiles auth/drafts/totales |
| Docs internas a respetar | `CRITICAL_ZONES.md`, `SAFE_FIRST_REFACTORS.md`, `MONOLITH_DECOMPOSITION_PLAN.md`, `TESTING_MINIMUMS.md`, `POLITICAS_CAMBIOS_CODIGO.md`, `RUNTIME_CONTRACTS.md` |

### Reglas duras (leer antes de tocar código)

1. **No** “arreglar de paso” zonas CRITICAL (auth, drafts, totales, caja, SaleForm submission payload, session lock).
2. Preferir PRs **pequeños**, un tema por PR, con tests mínimos que demuestren no-regresión.
3. Authz se valida **en servidor**; la UI solo oculta, no autoriza.
4. No cachear stock ni saldos de caja con strong consistency.
5. No reactivar WebSockets/approvals sin decisión explícita (vivo vs muerto).
6. No introducir secretos en el repo ni bakear PINs en imagen Docker.
7. Seguir el espíritu de `SAFE_FIRST_REFACTORS.md`: helpers puros primero; auth/drafts/totales al final.

---

## 1. Trabajo priorizado (orden de ejecución)

### P0 — Seguridad inmediata (hacer primero)

#### P0.1 Quitar cookies/sesiones trackeadas en Git

**Problema:** Existen `cookies2.txt` y `cookies3.txt` en la raíz con `session_token` (Netscape cookie file). `.gitignore` ya tiene `cookies*.txt` / `cookies.txt`, pero los archivos **siguen versionados**.

**Acciones:**
1. Eliminar del árbol de trabajo: `cookies2.txt`, `cookies3.txt` (y cualquier `cookies*.txt` similar).
2. Quitar del índice Git sin borrar historial aún: `git rm --cached cookies2.txt cookies3.txt` (ajustar si hay más).
3. Confirmar que `.gitignore` cubre `cookies.txt` y `cookies*.txt`.
4. **Rotar** cualquier `session_token` que haya quedado expuesto (invalidar sesiones en Mongo / política de sesión existente).
5. Opcional pero recomendado: `git filter-repo` o BFG para purgar del historial si el repo es público o compartido; si no se hace, documentar el riesgo residual en el PR.

**No hacer:** pegar tokens reales en issues/PRs; no commitear nuevos dumps de cookies “para debug”.

**Éxito:**
- `git ls-files` no lista `cookies*.txt`
- App sigue logueando con PIN en entorno de prueba
- Sesiones antiguas expuestas quedan inválidas

#### P0.2 Secretos y PINs fuera de la imagen / build

**Problema:** En `Dockerfile` aparece bakeado `VITE_ATTENDANCE_KIOSK_SHORTCUT_PIN` (y README/documentación lo referencian). Cloud Run se documenta con `--allow-unauthenticated` → la seguridad depende 100% de la app.

**Acciones:**
1. Mover el PIN de kiosko a runtime env / Secret Manager (Cloud Run secrets), **no** a `ENV` de build stage si se puede evitar.
2. Revisar `frontend` build args (`VITE_*` / legado `REACT_APP_*`) y documentar cuáles son públicos (expuestos al browser) vs secretos de servidor.
3. Auditar que no haya otros secretos en `Dockerfile`, `docker-compose*.yml`, scripts `.bat`/`.ps1`, o markdown de deploy.
4. Si un valor *debe* ser público en el bundle Vite, tratarlo como público (no como secreto) y endurecer el endpoint de kiosko en backend.

**Éxito:**
- Build no requiere secretos reales hardcodeados
- Kiosko/attendance sigue funcionando con secret inyectado en runtime
- Checklist de secretos en PR description

#### P0.3 AuthZ en mutaciones críticas (servidor)

**Problema conceptual (Torti Code — Auth vs Authorization):** login ≠ permiso. Roles y `/permissions/me` existen; hay que asegurar que **cada mutación** de ventas, inventario, caja y usuarios revalida permiso en backend.

**Alcance sugerido (auditoría + fixes mínimos):**
1. Inventariar endpoints de escritura en:
   - `backend/server.py` (auth, drafts, ventas si viven ahí)
   - `backend/routes/inventory.py`
   - rutas/servicios de caja (`backend/services/cash.py`, petty cash, cashier)
   - administración de usuarios / permisos
2. Para cada uno: ¿hay `require_*` / chequeo de rol-permiso **después** de autenticar sesión?
3. Corregir gaps claros (missing check) sin rediseñar el sistema de permisos.
4. Añadir/ajustar tests al estilo de `backend/tests/test_cashier_permissions.py` y `test_role_permission_contracts.py`.

**Zonas CRITICAL — tocar solo si el gap es seguridad demostrable; PRs micro.**

**Éxito:**
- Tabla en el PR: endpoint → permiso requerido → test
- Rol sin permiso recibe 401/403 coherente (ver nota P1.3 sobre 401 vs 403)
- Flujos felices de venta/caja/inventario siguen pasando

---

### P1 — Estabilización de contratos

#### P1.1 Destino explícito de WebSockets / approvals

**Problema:** Docs (`FASE1_ANALISIS_PROFUNDO.md`, `CRITICAL_ZONES.md`) indican approvals/WebSockets parcialmente desmontados, con UI que aún asume esos contratos (`GerenteApprovalPanel.jsx`, etc.).

**Acciones (elegir UNA rama y documentarla):**
- **Opción A — Vivo:** montar rutas, alinear contratos FE/BE, tests de smoke de notificación/aprobación.
- **Opción B — Muerto:** desmontar/ocultar UI zombie, marcar endpoints legacy, actualizar docs; no dejar “parece vivo y falla”.

**Éxito:** una decisión en `RUNTIME_CONTRACTS.md` o PR note + código alineado (sin half-live).

#### P1.2 Runtime contracts de cookie / sesión

**Problema histórico:** login PIN + `/api/auth/me` 401 por CORS/SameSite/Path/Secure (documentado en README).

**Acciones:**
1. Congelar en doc el contrato actual de cookie (nombre, HttpOnly, SameSite, Secure, Path, dominio).
2. Tests de integración PIN → sesión → `/api/auth/me` (ya hay suite PIN; no romperla).
3. No “optimizar” auth en el mismo PR que features.

**Éxito:** contrato documentado + tests PIN verdes.

#### P1.3 Cerrar gate de tests bloqueantes

**Problema documentado:** `tests/test_pin_lockout.py::test_pin_lockout_after_max_attempts` espera `401` pero recibe `403` (u viceversa según entorno). También hubo `ModuleNotFoundError: No module named 'backend'` en validación.

**Acciones:**
1. Unificar semántica: no autenticado → 401; autenticado sin permiso → 403 (alineado a Torti/AuthZ).
2. Ajustar implementación **o** test con decisión explícita (preferir semántica correcta + test actualizado).
3. Asegurar `PYTHONPATH` / working directory en CI y Docker para imports `backend.*`.

**Éxito:** gate de Phase 5 / CI local documentado en verde para esos casos.

---

### P2

#### P2.media — Honest upload progress (R-009)
Cuando se trabaje el uploader de **videos de publicidad** o **imágenes de pruebas de taller**: mostrar %, ETA, MB/s, nombre/tamaño y cancelar — no solo spinner. Ver `docs/ANTIGRAVITY_REELS_EVAL.md` R-009.

#### P2.context — Context menus PC + móvil (R-010)
Implementar sistema compartido de acciones contextuales: DesktopMenu (right-click/⋯) + MobileSheet (long-press). Misma lista de acciones; grupos; delete en peligro. Ver R-010. Prioridad tras P0/#4–#7 salvo que Xinon pida adelantar (2026-09-12: adelantar implementación).
 — Rendimiento y caché (sin tocar consistencia fuerte)

#### P2.1 Caché de lecturas calientes

**Hecho:** CDN GCS para imágenes de vehículos ya existe (bien). Caché de app aparece sobre todo en TeraBox/sync, no como capa general.

**Acciones:**
1. Identificar lecturas calientes: catálogo, permisos efectivos, listados de vehículos (metadatos), settings de sucursal.
2. Introducir caché con **TTL + invalidación** en writes.
3. **Prohibido** cachear stock disponible / saldos de caja / estado de factura abierta sin estrategia de invalidación fuerte.

**Éxito:** métrica antes/después en un endpoint caliente (latencia o conteo de queries) en la descripción del PR.

#### P2.2 Big O / paginación Mongo

**Acciones:**
1. Auditar listados que traen “todo” a memoria (vehículos, movimientos, reportes).
2. Paginación/cursor en BD; índices en filtros frecuentes.
3. Lookups O(1) con maps/sets donde hoy hay nested loops (permisos, compatibilidad producto-vehículo).

**Éxito:** al menos 1 endpoint caliente paginado + índice documentado.

---

### P3 — Refactors seguros (alineados a docs del repo)

#### P3.1 Ejecutar `SAFE_FIRST_REFACTORS.md`

En este orden, **un helper family por PR**:
1. Formatters puros (teléfono, cédula, RUC, chasis, placa) — solo si output idéntico.
2. Label builders readonly.
3. Connectivity helpers (sin mezclar auth).
4. Constantes estáticas compartidas.
5. Preview builders readonly.

**No incluir:** auth, drafts, totales, cashier lock, inventory mutations, approvals/WS.

**Éxito:** build FE + smoke de páginas afectadas; sin cambio visual ni de payload.

#### P3.2 Descomposición incremental (solo después de P3.1 estable)

Seguir `MONOLITH_DECOMPOSITION_PLAN.md`:
1. Helpers de cálculo puros fuera de `SaleForm` (sin cambiar fórmulas).
2. Hooks de draft orchestration **después** de snapshot/parity.
3. Extraer auth/session policy de `server.py` **al final**.

**Éxito:** mismos payloads de venta/cotización/draft; mismos totales; sin UX regression en sales/quotations/cashier/login.

---

### P4 — Higiene de repo / deploy (menor urgencia que P0)

1. No versionar `node_modules` / `.venv` (si reaparecen).
2. Mantener `.dockerignore` / `.gcloudignore` excluyendo `backend/data/blueprints_raw/` y `frontend/public/vehicles/models/`.
3. Revisar artefactos enormes en raíz (`ERP_TREE.txt`, dumps, `server.txt`, etc.): ¿doc útil o ruido? Mover a `docs/archive/` o gitignore si regenerables.
4. Evitar commits de `*.exe` instaladores si no son fuente de verdad.

---

## 2. Mapa Torti Code → tareas (referencia rápida)

| Tema Torti Code | Video ID | Tarea(s) de este handoff |
|-----------------|----------|---------------------------|
| Auth vs Authorization | `9CRk2rC1h8k` | P0.3, P1.2, P1.3 |
| OWASP Top | `HcsmfMTaxOM` | P0.1, P0.2, P0.3 |
| Encryption vs Hashing vs Encoding | `ZezkXF3ddgs` | P0.2, PINs/bcrypt (no encoding) |
| Docker failures | `NBZlNKRyn7g` | P0.2, P1.3 (PYTHONPATH), P4 |
| Caching | `ZAaS9F6-aAU` | P2.1 |
| REST vs GraphQL vs gRPC vs WS | `-vHf2vzMsqE` | P1.1 |
| SOLID / Design patterns | `ZjfopQLBH1E`, `V8JCghmncXs` | P3.1, P3.2 |
| Big O / Data structures | `EhS3Q5XvyBY`, `9ifwAPFxpu0` | P2.2 |
| Testing myths | `bivlfa5XUvk` | P0.3 tests, P1.3 |

Canal: https://www.youtube.com/@TortiCode  
Watch: `https://www.youtube.com/watch?v=<ID>`

---

## 2.1 Inbox de reels (Case → Antigravity)

Xinon irá compartiendo reels con ideas de arquitectura/producto. **Case las evalúa**; Antigravity no implementa por impulso del video.

Archivo vivo (fuente de verdad del registro):

- En repo: `docs/ANTIGRAVITY_REELS_EVAL.md`
- Veredictos: `APLICAR` · `APARCAR` · `OBVIAR`

**Últimos reels evaluados:** … R-009 APLICAR (uploads) · R-010 context menus → **APLICAR** (Xinon: implementar DesktopMenu + MobileSheet). Ver `docs/ANTIGRAVITY_REELS_EVAL.md`.

Prioridad operativa sigue siendo **P0 → P1** de este handoff + issues GitHub **#4–#7**.

---

## 3. Archivos / zonas sensibles (NO tocar a la ligera)

### Backend CRITICAL
- `backend/server.py` — auth, drafts backup, middleware, bootstrap
- `backend/routes/inventory.py`
- `backend/routes/human_resources.py`
- `backend/api/v1/approvals.py`, `websockets.py`, `reports.py` (legacy / riesgo)
- `backend/services/venta_service.py`, `cash.py`, `pin_*.py`
- `backend/domains/auth/session_policy.py`
- `backend/domains/sales/*` (pricing, vouchers, settlements)

### Frontend CRITICAL
- `frontend/src/context/AuthContext.js`
- `frontend/src/pages/LoginPage.jsx`
- `frontend/src/components/sales/SaleForm.jsx`
- `frontend/src/pages/SalesPage.jsx`, `QuotationsPage.jsx`, `CashierPage.jsx`
- `frontend/src/lib/serverDrafts.js`, `draftStorage.js`
- `frontend/src/components/layout/MainLayout.jsx`

---

## 4. Plan de PRs sugerido (para Antigravity)

| PR | Título sugerido | Incluye | Tests mínimos |
|----|-----------------|---------|---------------|
| PR-1 | `security: remove tracked cookie dumps` | P0.1 | login PIN smoke |
| PR-2 | `security: kiosk pin via runtime secret` | P0.2 | attendance/kiosk smoke |
| PR-3 | `security: enforce server authz on write endpoints` | P0.3 (subset) | permission contract tests |
| PR-4 | `fix: pin lockout status code + import path` | P1.3 | `test_pin_lockout` |
| PR-5 | `chore: approvals/ws contract decision` | P1.1 | smoke o UI unmount |
| PR-6 | `perf: cache + pagination for hot reads` | P2.x | benchmark note |
| PR-7+ | `refactor: safe pure helpers (family N)` | P3.1 | build + visual/smoke |

Cada PR: descripción con **Tema Torti → Evidencia → Riesgo ERP → Acción → Cómo verificar**.

---

## 5. Criterios globales de “done”

- [ ] No hay `cookies*.txt` en el árbol trackeado
- [ ] No hay secretos/PIN de producción bakeados en Dockerfile
- [ ] Mutaciones críticas de ventas/inventario/caja tienen authz de servidor + test
- [ ] Decisión approvals/WS documentada y código alineado
- [ ] `test_pin_lockout` y imports `backend.*` estables en el entorno de CI/Docker del proyecto
- [ ] Ningún PR de refactor cambia payloads de venta/cotización/draft ni UX de login/caja
- [ ] README/deploy no instruyen a commitear secretos

---

## 6. Fuera de alcance de este handoff

- Reescritura total del monolito en un solo PR
- Partir el ERP en microservicios (R-003: quedarse en monolito modular / mismo Cloud Run)
- Migración de Mongo a SQL
- Rebrand / rediseño UX
- Activar Cloud Agents de Cursor (plan del usuario; irrelevante para Antigravity)
- Clonar artefactos binarios enormes innecesarios

---

## 7. Mensaje operativo para Antigravity

**Archivo único consolidado (usar este primero):** `docs/ANTIGRAVITY_APLICAR_TODO.md` — une QA issues #4–#10, P0 seguridad, R-009/R-010 APLICAR y lista OBVIAR/APARCAR.


> Trabaja sobre `Samuraimaid/MC-LARENS_ERP2` desde `master`. Ejecuta **P0 → P1 → P2 → P3** en PRs separados. Respeta `CRITICAL_ZONES.md` y `SAFE_FIRST_REFACTORS.md`. Prioriza seguridad (cookies, secretos, authz servidor) sobre cleanup de MB. Antes de cada merge: build Docker o al menos pytest del área tocada + smoke de login PIN. Si encuentras conflicto entre un test y la semántica 401/403, corrige hacia “401 no auth / 403 no authz” y documenta.

**Fin del handoff.**
