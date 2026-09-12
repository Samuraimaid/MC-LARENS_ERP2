# ANTIGRAVITY — Archivo único de cambios a aplicar

**Repo:** https://github.com/Samuraimaid/MC-LARENS_ERP2  
**Branch base:** `master`  
**Actualizado:** 2026-09-12  
**Autor del brief:** Case (evaluaciones + QA) · handoff seguridad original TARS  
**Para:** Antigravity — **este archivo es la fuente de verdad de qué implementar**.  
Ignorar reels/ideas marcados OBVIAR/APARCAR salvo que Xinon los promueva.

Live ERP (referencia QA): `https://mclarens-erp-836176703716.us-central1.run.app`

---

## Cómo trabajar

1. Un **tema = un PR** pequeño.
2. Orden de la tabla **Orden de ejecución** (abajo). No saltear P0/P1 por features UX.
3. Respetar `CRITICAL_ZONES.md`, `SAFE_FIRST_REFACTORS.md`, `POLITICAS_CAMBIOS_CODIGO.md`.
4. **No** partir a microservicios (R-003 guardrail). Monolito modular en el mismo Cloud Run.
5. Authz en **servidor**; UI solo oculta.
6. No inventar datos; no bakear secretos/PINs; no commitear cookies.
7. Tras cada PR: smoke login PIN + área tocada.

Detalle largo de seguridad/Torti: `docs/MC-LARENS_ERP2_ANTIGRAVITY_HANDOFF.md`  
Detalle de reels: `docs/ANTIGRAVITY_REELS_EVAL.md`

---

## Orden de ejecución (aplicar esto)

| # | ID | Severidad | Issue | Qué hacer | Done cuando |
|---|-----|-----------|-------|-----------|-------------|
| 1 | QA-P0 | P0 | [#4](https://github.com/Samuraimaid/MC-LARENS_ERP2/issues/4) | Crash en `/my-completed-jobs` (“Incidencia Técnica Registrada”). Repro: login PIN teclado → abrir esa ruta (gerencia/técnicos). | Página lista trabajos sin crash; test o smoke documentado |
| 2 | SEC-P0.1 | P0 | (handoff) | Quitar `cookies*.txt` del Git trackeado; rotar sesiones expuestas. | `git ls-files` sin cookies; login PIN OK |
| 3 | SEC-P0.2 | P0 | (handoff) | PIN kiosko / secretos fuera del Dockerfile bake; runtime Secret Manager / env. | Build sin secretos reales hardcodeados |
| 4 | SEC-P0.3 | P0 | (handoff) | AuthZ servidor en mutaciones ventas/inventario/caja/users. | Tabla endpoint→permiso→test; 401/403 coherente |
| 5 | QA-P1a | P1 | [#5](https://github.com/Samuraimaid/MC-LARENS_ERP2/issues/5) | Coord. polarizados: “Permiso denegado” ×2 en `/coordinator/polarizados`. | Panel usable sin avisos falsos |
| 6 | QA-P1b | P1 | [#6](https://github.com/Samuraimaid/MC-LARENS_ERP2/issues/6) | Coordinadores (y casos similares) con sucursal “no asignada”. | Sucursal coherente o regla multi-sucursal documentada |
| 7 | QA-P1c | P1 | [#7](https://github.com/Samuraimaid/MC-LARENS_ERP2/issues/7) | Entregador: GPS denegado → mensaje «Not allowed». | Mensaje ES claro + UX degradada controlada |
| 8 | UX-R010 | P2 | [#10](https://github.com/Samuraimaid/MC-LARENS_ERP2/issues/10) | **Menús contextuales** DesktopMenu + MobileSheet (Xinon: implementar). | Ver spec §R-010 abajo; piloto 1 lista; PR |
| 9 | UX-R009 | P2 | (R-009 / P2.media) | **Progreso honesto** en upload videos publicidad + fotos pruebas taller. | % / ETA / MB/s / cancelar; multi-file |
| 10 | QA-P2a | P2 | [#8](https://github.com/Samuraimaid/MC-LARENS_ERP2/issues/8) | Cargas iniciales >15s (dashboard, inventory, users, catálogo…). | Mejora medida o skeleton + nota |
| 11 | QA-P2b | P2 | [#9](https://github.com/Samuraimaid/MC-LARENS_ERP2/issues/9) | Bodegas main `/inventory` lento y vacío. | Inventario o mensaje explícito permisos/datos |
| 12 | P1.x | P1 | (handoff) | Approvals/WS decisión vivo vs muerto; cookie contract; `test_pin_lockout` 401/403. | Docs + código alineados; tests verdes |

---

## Specs APLICAR (detalle suficiente para codear)

### A) #4 — `/my-completed-jobs` crash (P0)

- Síntoma: pantalla “Incidencia Técnica Registrada”.
- Roles: gerencia, instalaciones, técnicos.
- Hipótesis no vinculante (verificar): error de runtime en componente/ruta o permiso/API 500.
- Fix: estabilizar ruta; no romper otros workbench/technician flows.
- Login QA: PIN se **tipea** en teclado en splash publicitario (no clicks en pinpad).

### B) #5 — Coord. polarizados permiso denegado (P1)

- Ruta: `/coordinator/polarizados`
- Rol: `coordinador_polarizados`
- Dos toasts/avisos “Permiso denegado” con panel que igual carga → mismatch permisos FE/BE.

### C) #6 — Sucursal no asignada (P1)

- Coordinadores test y posiblemente gerencia (Xinon) muestran sucursal no asignada.
- Asignar `branch_id` o definir comportamiento multi-sucursal explícito en UI.

### D) #7 — Entregador GPS (P1)

- Al denegar geolocalización: no mostrar «Not allowed» crudo en inglés.
- Copy ES + flujo sin GPS (manual / reintentar permiso).

### E) R-010 / #10 — Context menus PC + móvil (APLICAR — Xinon adelantó)

**Misma lista de acciones, dos shells:**

1. `DesktopMenu` — right-click y/o ⋯ (iconos+labels, hover, separadores por grupo, Delete en rojo al final).
2. `MobileSheet` — long-press o ⋯ → bottom sheet (targets ≥44px). **No** copiar menú flotante de escritorio en touch.

API sugerida: acciones `{ id, label, icon?, onSelect, variant?: 'default'|'danger', group? }`.

- Confirmar antes de destructivas.
- Piloto en **1** lista low-risk (Users / inventario / similar; **no** SaleForm).
- No tocar PIN, drafts, payloads de venta, cashier lock.
- Labels en español si la app lo está.
- Reutilizar Radix/Headless existente si hay.
- Ref visual: https://www.facebook.com/share/r/1BsSDS2xE6/

### F) R-009 — Honest upload progress (APLICAR en esos uploaders)

Cuando se toque:

1. Upload de **videos de publicidad** (login splash / admin promo; ver `BackgroundPromoVideo.jsx`).
2. Upload de **imágenes de pruebas de taller** (QC / work orders / polarizados).

UI requerida (no solo spinner):

- Nombre + tamaño del archivo
- % + barra
- Tiempo restante (ETA)
- Velocidad (MB/s)
- Botón Cancelar
- Multi-file: estado por ítem

Ref: https://www.facebook.com/share/r/1QN7kbvsNg/

### G) #8 / #9 — Perf / inventario (P2)

- Medir y atacar lecturas lentas (caché segura solo donde handoff permite; **no** cachear stock/caja strong-consistency).
- Bodegas `/inventory`: datos o mensaje claro de vacío/permiso.

### H) Seguridad handoff P0 (si aún no cerrado)

Ver secciones P0.1–P0.3 en `docs/MC-LARENS_ERP2_ANTIGRAVITY_HANDOFF.md`.

---

## NO aplicar (OBVIAR / APARCAR)

| ID | Veredicto | Motivo corto |
|----|-----------|--------------|
| R-001 Event-driven / microservicios prematuros | APARCAR | Eventos internos quizás post-P1; no rewrite |
| R-002 Cron/crontab en Cloud Run | OBVIAR | Xinon: no aplica; preferir Cloud Scheduler a futuro |
| R-003 Monolito vs microservicios | APLICAR **solo guardrail** | Quedarse en monolito modular; **no** split |
| R-004 DB failover casero | OBVIAR | Atlas ya hace HA |
| R-005 Load balancing algorithms | OBVIAR | Lo hace Cloud Run |
| R-006 Table UX (Align/Density/…) | APARCAR | FE polish después |
| R-007 Tablas móvil → cards | APARCAR | Con R-006 más adelante |
| R-008 AI slop / UX Engine plugin | OBVIAR | No restyle masivo ni plugin $79 |

---

## Plan de PRs sugerido (unificado)

| PR | Título sugerido | Incluye |
|----|-----------------|---------|
| PR-A | `fix: my-completed-jobs crash` | #4 |
| PR-B | `security: remove tracked cookies` | P0.1 |
| PR-C | `security: kiosk pin runtime secret` | P0.2 |
| PR-D | `security: server authz on writes` | P0.3 |
| PR-E | `fix: coordinator polarizados permissions` | #5 |
| PR-F | `fix: assign branch for coordinators` | #6 |
| PR-G | `fix: entregador GPS denied UX (ES)` | #7 |
| PR-H | `feat: ContextActions DesktopMenu + MobileSheet` | #10 / R-010 |
| PR-I | `feat: honest upload progress (promo + taller)` | R-009 |
| PR-J | `perf: slow routes + bodegas inventory empty` | #8 #9 |

Cada PR: **Tema → Evidencia (issue/reel) → Riesgo → Acción → Cómo verificar**.

---

## Criterios globales de done

- [ ] #4–#7 cerrados o con PR mergeado
- [ ] #10 (R-010) mergeado con piloto desktop+móvil
- [ ] R-009 incluido al tocar uploaders de publicidad/taller
- [ ] Sin cookies trackeadas; sin secretos bakeados
- [ ] Mutaciones críticas con authz servidor
- [ ] Ningún PR cambia payloads venta/cotización/draft ni UX login/caja salvo bugfix explícito
- [ ] No hay PR de microservicios / crontab Cloud Run / failover casero / restyle AI

---

## Mensaje operativo (copiar a Antigravity)

> Trabaja sobre `Samuraimaid/MC-LARENS_ERP2` desde `master`.  
> **Fuente de verdad:** `docs/ANTIGRAVITY_APLICAR_TODO.md` (este archivo).  
> Ejecuta la tabla **Orden de ejecución** con PRs separados.  
> Prioriza #4 luego seguridad P0 luego #5–#7; después #10 (menús) y R-009 (uploads).  
> Respeta CRITICAL_ZONES. Login PIN = teclado en splash.  
> Ignora ítems OBVIAR/APARCAR de la sección “NO aplicar”.

**Fin del archivo único.**
