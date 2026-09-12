# Antigravity — Inbox de reels / ideas (evaluación Case)

**Repo:** Samuraimaid/MC-LARENS_ERP2  
**Quién evalúa:** Case (Grok Bot) — Xinon comparte reels; Case clasifica impacto antes de que Antigravity implemente.  
**Actualizado:** 2026-09-12 ( + Afzal P-AFZ barrido)

> **Antigravity:** usa `docs/ANTIGRAVITY_APLICAR_TODO.md`. Barrido Design Motion: R-011…R-035 en este inbox + `docs/design_motion_overnight_candidates.md`.
>
> **Antigravity:** para implementar, usa el consolidado `docs/ANTIGRAVITY_APLICAR_TODO.md` (este inbox es el detalle de reels).

## Cómo usar este archivo

1. Xinon pega un link de reel (Facebook/IG/TikTok/YouTube) en el chat de Case.
2. Case resume la idea, la cruza con el estado real del ERP (QA, issues, handoff) y asigna un veredicto.
3. Antigravity **solo actúa** sobre ítems `APLICAR` (o `APARCAR` cuando el handoff diga que toca esa fase). Ignora `OBVIAR`.

### Veredictos

| Código | Significado | Qué hace Antigravity |
|--------|-------------|----------------------|
| **APLICAR** | Encaja ahora; beneficio > riesgo | Implementar en PR pequeño ligado a P0–P3 del handoff |
| **APARCAR** | Idea válida, mal timing o demasiado amplia | No implementar aún; dejar nota / issue; retomar cuando Case/Xinon lo promueva |
| **OBVIAR** | Ruido, clickbait, o dañino en el estado actual del ERP | No tocar código; no abrir PRs “por curiosidad” |

### Reglas duras (igual que el handoff)

- No reescribir el monolito ni partir a microservicios “porque un reel lo dijo”.
- No tocar CRITICAL_ZONES / SaleForm / PIN / drafts / totales sin gap de seguridad demostrable.
- Preferir PRs chicos. Si el reel contradice `POLITICAS_CAMBIOS_CODIGO.md` o `SAFE_FIRST_REFACTORS.md` → **OBVIAR** o **APARCAR**.

---

## Registro (más reciente arriba)


### P-AFZ — Perfil Afzal Web Solutions (codingwithjutt) — barrido amplio
- **Fecha:** 2026-09-12
- **Fuente:** https://www.facebook.com/share/19ir8udn2q/ · https://www.facebook.com/codingwithjutt/
- **Ya evaluado antes:** R-002 cron **OBVIAR**; R-004 failover **OBVIAR**.
- **Nicho:** Full-stack/backend, system design, entrevistas, deploys, AI guardrails.

| Tip (muestra nueva) | Veredicto | Nota ERP |
|---------------------|-----------|----------|
| Canary deployments | **APARCAR** | Útil en Cloud Run (revisions/% tráfico) post-estabilidad; no antes de #4–#7. |
| Tree traversal / jerarquías | **APARCAR** | Permisos/roles/org; solo si modelan árbol de menús/permisos. |
| Read receipts | **APARCAR** | Notificaciones/entregas; con R-030 taxonomy. |
| AI Guardrails | **OBVIAR** | No hay copiloto ERP en scope ahora. |
| FE→BE en 10s / DNS traceroute / interview algos / 13 DS | **OBVIAR** | Educación genérica; no ticket. |
| System design (LB, cache, shard, rate limit) | **OBVIAR / APARCAR** | LB=R-005 OBVIAR; rate limit/colas ya APARCAR en P-DMN. |

- **Acción Antigravity ahora:** ninguna nueva. Canary = nota ops para más adelante.
- **Conclusión:** este perfil aporta poco nuevo vs Đức Minh + lo ya OBVIAR; no priorizar más reels de aquí salvo canary cuando madure el deploy.


### P-MEM — Perfil Memorisely (UX/UI bootcamps)
- **Fecha:** 2026-09-12
- **Fuente:** https://www.facebook.com/share/19N6CTtqhw/ · https://www.facebook.com/p/Memorisely-100071990791186/ · memorisely.com
- **Nicho:** Educación UX/UI — Figma, design systems, tokens, AI en diseño, principios UX.
- **Muestra:** Dual-screen/fold · design tokens Polar · naming layers/components · Hick’s Law · AI tool stack · semantic tokens · brand ≠ primary color · design system MCP.

| Tip | Veredicto | Nota ERP |
|-----|-----------|----------|
| Hick’s Law — menos opciones, priorizar acción principal | **APLICAR** (R-038) | Caja/workbench: menos botones a la vista; progressive disclosure (alineado hierarchy Design Motion). |
| Semantic tokens / no adivinar tokens | **APARCAR** | Útil con DESIGN.md a futuro; no P0. |
| Brand color ≠ primary UI color | **APARCAR** | Status/errores/alertas con color funcional (cerca R-031). |
| Dual screen / fold / breakpoints | **APARCAR** | Tablet + segunda pantalla caja posible; no urgente. |
| Naming layers/components (Figma/AI) | **OBVIAR** | Flujo diseño Figma, no runtime ERP. |
| Daily AI tool stack / MCP design system | **OBVIAR** | Tooling de diseñadores; no ticket Antigravity. |
| Bootcamps Memorisely | **OBVIAR** | No comprar curso para el repo. |

- **Overlap:** mucho espíritu ya cubierto por Design Motion R-011…R-035 (hierarchy, color a11y, destructive). **Nuevo concreto:** R-038 Hick’s Law en pantallas de operación.
- **Acción Antigravity:** al tocar caja/workbench/menús, aplicar R-038 (1 CTA primaria visible; resto en ⋯/sheet R-010).

### R-038 — Hick’s Law en pantallas de operación (Memorisely)
- **Veredicto:** **APLICAR**
- **Idea:** demasiadas opciones ralentizan; una acción primaria clara; secundarias en overflow/sheet.
- **ERP:** caja, workbench ventas, menús de fila (#10), coordinadores.
- **Acción:** en PRs de esas UIs, maximizar 1 primary CTA; no barra de 8 botones iguales.
- **Fuente:** https://www.facebook.com/share/19N6CTtqhw/


### P-DMR — Perfil David Mráz (Atheros)
- **Fecha:** 2026-09-12
- **Fuente:** https://www.facebook.com/share/1BUw5vJWWB/ · https://www.facebook.com/people/David-Mr%C3%A1z/61584464274271/ · learning.atheros.ai
- **Nicho:** FE/UI con AI — HTML/CSS/JS, componentes responsive, demos (pago Atheros Pass en mucho del contenido largo).
- **Muestra pública (pocos reels sin login):** Container Queries · estados MINI/STANDARD/EXPANDED · paginación en cards · frosted glass · checkboxes animados CSS.

| Tip | Veredicto | Nota ERP |
|-----|-----------|----------|
| Container queries + estados adaptativos | **APARCAR** (R-037) | Útil para paneles POS/tablet; no urgente vs #4–#7. Encaja con R-006/R-007 más adelante. |
| Paginación en listas/cards | **APLICAR** (refuerzo #8 / P2.2) | Ya en handoff paginación Mongo; FE también paginar inventory/ventas. No hace falta ID nuevo si #8+P2.2 cubren — marcar como **APLICAR junto #8**. |
| Frosted glass | **OBVIAR** | Estética; riesgo contraste en tienda. |
| Checkboxes animados CSS | **OBVIAR** | Nice-to-have; bulk actions ya APARCAR (R-027). |
| Load balancers / system design genérico | **OBVIAR** | Igual R-005 (Cloud Run). |
| Cursos/Pass Atheros | **OBVIAR** | No comprar para el repo. |

- **Acción Antigravity:** al tocAR #8 / listas: paginación FE+BE. Container queries → backlog con tablas móvil (R-007). Nada más de este perfil ahora.


### P-DMN — Perfil Đức Minh Nguyễn (duckminknguyen)
- **Fecha:** 2026-09-12
- **Fuente:** https://www.facebook.com/share/19k4vdMqPt/ · https://www.facebook.com/duckminknguyen/
- **Nicho:** Educación software VN — backend, escala, DB, DevOps, AI práctico (no UX de piso).
- **Muestra de reels:** Rate Limit · SQL declarativo · WebSocket · DB Index · Docker · RAG · CDN · Message Queue

| Tip | Veredicto | Nota ERP McLarens |
|-----|-----------|-------------------|
| Rate Limit | **APARCAR** | Útil en APIs públicas/abuso; Cloud Run ya mitiga algo. Tras P0. |
| SQL “qué no cómo” | **OBVIAR** | ERP es **Mongo**, no SQL escolar. Espíritu OK en aggregations. |
| WebSocket vs polling | **APARCAR** | Ya en handoff P1.1 (approvals/WS vivo vs muerto). No abrir WS nuevo ya. |
| Database Indexing | **APLICAR** (R-036) | Índices Mongo en lecturas lentas (#8 inventory/users). |
| Docker “works on my machine” | **OBVIAR** | Ya despliegan con Docker/Cloud Run. |
| RAG | **OBVIAR** | No es el dolor del POS; catálogo/QA docs más adelante si acaso. |
| CDN | **APARCAR** | Media/promo ya van a GCS/CDN potencial; no PR nuevo ahora. |
| Message Queue | **APARCAR** | Como R-001 EDA: colas post-estabilidad, no microservicios. |

- **Acción Antigravity ahora:** solo **R-036** (índices Mongo en rutas lentas) cuando toque #8. Resto no abrir PRs por este perfil.
- **Vs Design Motion:** este perfil aporta infra/backend; DM aporta UX. Complementarios, no duplicados.

### R-036 — Índices Mongo en lecturas calientes (de tip DB Indexing / Đức Minh)
- **Veredicto:** **APLICAR**
- **Qué:** Auditar queries lentas de inventory/users/dashboard; asegurar índices compuestos alineados a filtros reales (sucursal, status, created_at).
- **No:** “índices en todo”; medir con explain / Atlas Performance Advisor.
- **Ligado:** issue #8, handoff P2.2 paginación/Big O.

### R-011 — Empty states: four kinds + one CTA
- **Source:** https://www.designmotionhq.com/patterns/empty-states
- **One-liner:** Blank screens look broken; distinguish first-run / no-results / error / filtered-out, each with human copy and one primary next-step CTA (not 'Try refreshing').
- **ERP relevance:** Inventory with no stock matches, technician job queues, credits, users lists, search with zero hits, first-time empty promo/media libraries.
- **Verdict:** **APLICAR**
- **Why:** Low-risk FE polish: replace bare 'No data' with context-specific empty + CTA on pilot lists. Does not touch CRITICAL sales/PIN. Improves perceived quality on slow/empty stores.


### R-012 — Error surfaces by severity
- **Source:** https://www.designmotionhq.com/patterns/error-states
- **One-liner:** Match error type to surface: field validation inline, transient issues as toast/banner, blocking failures as modal; every error needs a recovery exit (Retry / help), never dead-end OK + raw Error 500.
- **ERP relevance:** SaleForm validation, approvals, GPS/entregador failures, upload errors, auth/PIN failures, API timeouts on inventory.
- **Verdict:** **APLICAR**
- **Why:** Directly reduces support confusion and abandoned flows. Aligns with existing error/toast work; no architecture change. Prefer incremental adoption on highest-pain screens.


### R-013 — Toast rules: position, timing, stack≤3
- **Source:** https://www.designmotionhq.com/patterns/toast-notifications
- **One-liner:** Desktop bottom-right / mobile top; timing by severity (~4s info, ~7s warn, critical until ack); max 3 visible; pause on hover; color + icon (not color alone).
- **ERP relevance:** Save success, stock warnings, PIN/approval feedback, upload complete/fail, background sync notices on POS and mobile tech apps.
- **Verdict:** **APLICAR**
- **Why:** Shared toast component rules are a small PR with high consistency payoff. Complements R-012; avoids center-screen blockers during caja.


### R-014 — Loading is a system (not one skeleton everywhere)
- **Source:** https://www.designmotionhq.com/patterns/loading-states-system
- **One-liner:** Pick by knowledge: known shape → skeleton (>~300ms); short unknown → spinner; known % → progress+meta; reversible → optimistic; under ~300ms show nothing (no flash).
- **ERP relevance:** Slow inventory/sales lists (>15s pain), button saves, exports, promo video uploads (ties R-009), dashboard widgets.
- **Verdict:** **APLICAR**
- **Why:** Perceived speed is critical while backend perf is still being fixed. Spec skeletons for list pages and honest progress for long jobs; skip indicators on instant responses.


### R-015 — Hover trap: no primary actions on hover; 44px targets
- **Source:** https://www.designmotionhq.com/patterns/hover-trap
- **One-liner:** Touch has no real hover (first tap sticks); never bury primary actions in hover; gate with @media (hover:hover); pad hit areas to 44px while icons stay ~20px; use card/swipe/sheet fallbacks.
- **ERP relevance:** Technicians/polarizados/entregador on phone; tablet POS; row action menus currently hover-only on desktop tables.
- **Verdict:** **APLICAR**
- **Why:** Pairs with R-010 mobile sheets and R-007. High operational impact on floor devices. Prefer visible ⋯ / long-press over hover-only Edit/Delete.


### R-016 — Destructive actions as a language
- **Source:** https://www.designmotionhq.com/patterns/destructive-actions
- **One-liner:** Name the verb on the button (Delete X / Keep X, not Yes/No); don't put destroy where Confirm usually sits; reserve red for real danger; bury delete in a danger zone; irreversible gets cooldown or typed confirm.
- **ERP relevance:** Cancel/anular venta, delete users, purge media, void tickets, destructive bulk inventory — high-stakes ERP actions.
- **Verdict:** **APLICAR**
- **Why:** Prevents muscle-memory disasters on caja. Compatible with CRITICAL_ZONES if limited to copy/placement/friction outside SaleForm internals first; typed confirm for irreversible cancels.


### R-017 — Form fields: six explicit states
- **Source:** https://www.designmotionhq.com/patterns/form-field-states
- **One-liner:** Design default/focus/error/success/disabled/loading explicitly; labels outside fields (not placeholder-as-label); errors = color+icon+message; success in-field; disabled ≠ loading.
- **ERP relevance:** SaleForm, quotations, catalog uploads, login/PIN, vehicle/client forms, settings.
- **Verdict:** **APLICAR**
- **Why:** Foundational form quality. Can start with shared Input component states without rewriting SaleForm business logic. Accessibility win (colorblind-safe errors).


### R-018 — Validation timing: blur first, then live
- **Source:** https://www.designmotionhq.com/patterns/form-validation-timing
- **One-liner:** Don't validate every keystroke or only on submit; validate on blur; after an error, switch that field to live revalidation; success checks are feedback too.
- **ERP relevance:** SKU/qty/price fields, client email/phone, PIN length, credit forms, technician notes.
- **Verdict:** **APLICAR**
- **Why:** Reduces form rage without schema changes. Apply carefully on CRITICAL sale fields (validate UX only; server remains source of truth — see R-019).


### R-019 — Behind the button: client speed, server truth for money
- **Source:** https://www.designmotionhq.com/patterns/behind-the-button
- **One-liner:** Client validation for speed; server re-checks everything; recompute totals from catalog; wrap multi-row writes in one transaction; optimistic UI only for reversible actions — money waits on spinner/server confirm.
- **ERP relevance:** POS checkout, stock decrements, payments, approvals — core McLarens sales path.
- **Verdict:** **APLICAR**
- **Why:** Guardrail that reinforces handoff/CRITICAL_ZONES: never optimistic UI for money/inventory commits. Audit that FE doesn't trust client-sent prices. Policy + small audits, not a rewrite.


### R-020 — Autosave honesty (status machine + offline queue)
- **Source:** https://www.designmotionhq.com/patterns/autosave-ux
- **One-liner:** Debounce ~800ms; status machine typing/saving/saved/offline/error — never show Saved if write failed; queue offline edits; beforeunload if dirty; no silent last-write-wins across tabs.
- **ERP relevance:** Sale drafts, work-order notes, long quotations, catalog edits on flaky store Wi‑Fi.
- **Verdict:** **APLICAR**
- **Why:** Draft honesty on flaky networks matches real tienda conditions. Scope to draft/autosave UIs already present; don't invent new autosave on CRITICAL paths without review.


### R-021 — Bottom sheets for thumb-reach mobile menus
- **Source:** https://www.designmotionhq.com/patterns/bottom-sheets
- **One-liner:** On tall phones, top-right is a dead zone; put actions in bottom sheets with snap points, drag-to-dismiss, scrim + scroll lock; keep page context visible vs full modal.
- **ERP relevance:** Technician mobile actions, R-010 mobile context menus, filters on inventory phone view, KDS/polarizados.
- **Verdict:** **APLICAR**
- **Why:** Implementation vehicle for R-010 MobileSheet. Prefer sheets over full-screen modals for row actions on mobile.


### R-022 — Search as a system (placeholder, recent, zero-result recovery)
- **Source:** https://www.designmotionhq.com/patterns/search-experience-system
- **One-liner:** Descriptive placeholder (name/SKU/brand); recent searches on focus; popular-ranked autocomplete with category badges; keyboard arrows/Enter/Esc; zero results offer recovery paths.
- **ERP relevance:** Inventory SKU search at POS, parts lookup, client search, vehicle plates, catalog admin.
- **Verdict:** **APLICAR**
- **Why:** POS speed is search speed. Placeholder + recent + better empty recovery are incremental; full autocomplete ranking can be phased.


### R-023 — Undo over 'Are you sure?' for reversible deletes
- **Source:** https://www.designmotionhq.com/patterns/undo-ux
- **One-liner:** Prefer instant action + timed undo toast (visible countdown) and soft-delete; reserve type-to-confirm for truly irreversible; don't hard-delete immediately.
- **ERP relevance:** Removing draft lines, dismissing notifications, soft-deleting media, non-critical list items; NOT anular venta with fiscal impact.
- **Verdict:** **APARCAR**
- **Why:** Excellent pattern but needs per-entity policy (what is soft-deletable). Dangerous if applied naively to sales/inventory commits. Park until soft-delete rules exist; keep typed confirm for irreversible (R-016).


### R-024 — Modal hierarchy: ask 'does it block?'
- **Source:** https://www.designmotionhq.com/patterns/modal-hierarchy
- **One-liner:** Modal only for blocking/critical decisions; else sheet / drawer / popover by context; don't full-scrim routine actions or stack modals.
- **ERP relevance:** Confirmations, filters, row actions, nav drawers, PIN prompts vs casual info dialogs.
- **Verdict:** **APLICAR**
- **Why:** Reduces friction on floor workflows. Audit existing modals; demote non-blocking ones to sheet/popover. PIN/blocking confirms stay modal.


### R-025 — Focus states & keyboard traps
- **Source:** https://www.designmotionhq.com/patterns/focus-states
- **One-liner:** Never outline:none without replacement; :focus-visible; 2px ring+offset; trap focus in modals; restore focus on close; keep DOM order = visual order; skip link.
- **ERP relevance:** Auth/login, dialogs, dropdowns, forms on desktop caja (keyboard-heavy), accessibility compliance.
- **Verdict:** **APLICAR**
- **Why:** Cheap shared CSS + modal focus trap. High a11y value, low product risk. Do not reorder SaleForm DOM casually.


### R-026 — Disabled buttons: keep live, explain on click
- **Source:** https://www.designmotionhq.com/patterns/disabled-buttons
- **One-liner:** Native disabled drops tab order and blocks tooltips; keep CTA enabled, validate on click, focus first blocker; loading = busy/spinner/aria-busy, not greyed-out dead control.
- **ERP relevance:** Submit venta, save forms, approve/reject, upload buttons when prerequisites missing.
- **Verdict:** **APLICAR**
- **Why:** Fixes 'why can't I click?' on busy shop forms. Aligns with R-017/R-018. Exception: genuine permission-denied can stay non-actionable with visible reason text.


### R-027 — Bulk actions as a system
- **Source:** https://www.designmotionhq.com/patterns/bulk-actions
- **One-liner:** Header checkbox tri-state (incl. indeterminate); name exact matching count; selection in app state across pages; for destructive bulk prefer undo window echoing count over confirm modal.
- **ERP relevance:** Inventory multi-select, media batch delete, user/role bulk ops, catalog imports selection.
- **Verdict:** **APARCAR**
- **Why:** Useful later but needs selection architecture + soft-delete policy (ties R-023). Not needed for P0/#4–#7. Revisit with inventory FE polish.


### R-028 — File upload system beyond honest progress
- **Source:** https://www.designmotionhq.com/patterns/file-upload-ux
- **One-liner:** Deepens R-009: drag-over feedback (border/glow/copy), thumbnail+type+size proof, per-file queue with independent progress/retry that resumes without re-picking file.
- **ERP relevance:** Promo videos, taller evidence photos, catalog image batches — same upload surfaces as R-009.
- **Verdict:** **APLICAR**
- **Why:** Extension of R-009 APLICAR: when building honest progress, also ship dropzone feedback, preview proof, and per-item retry. Same PR scope.


### R-029 — Optimistic UI only for reversible actions
- **Source:** https://www.designmotionhq.com/patterns/optimistic-ui
- **One-liner:** Instant UI then background sync + rollback on failure; under 400ms feels instant; never optimistic for payments/transfers/irreversible commits.
- **ERP relevance:** Favorites/pins, UI toggles, list reorder — vs POS totals, stock, PIN-gated actions.
- **Verdict:** **APLICAR**
- **Why:** Complement to R-019: explicit allow/deny list. Apply optimistic only to low-stakes UI; force server-wait on money/stock.


### R-030 — Notification volume mapping (toast/banner/modal/badge)
- **Source:** https://www.designmotionhq.com/patterns/notification-system
- **One-liner:** Four surfaces by severity; persistence differs; never over-escalate everything to modal; never stack blocking modals.
- **ERP relevance:** Approvals waiting, WS events, stock alerts, system degraded, unread job counts for technicians.
- **Verdict:** **APARCAR**
- **Why:** Good design system goal but overlaps R-012/R-013; full notification taxonomy is a broader product decision. Park; apply toast/error rules first.


### R-031 — Color accessibility: never color-alone status
- **Source:** https://www.designmotionhq.com/patterns/color-accessibility
- **One-liner:** WCAG 4.5:1 body / 3:1 large; pair every status color with icon/label/pattern; muted grays often fail; red≠green alone for ~8% CVD users.
- **ERP relevance:** Order/job status pills, stock levels, approval states, dashboard KPIs, error vs success on forms.
- **Verdict:** **APLICAR**
- **Why:** Status pills with icon+label are a small shared component change (DM homepage even calls this out). High clarity on floor screens.


### R-032 — Doherty threshold: visible feedback ≤400ms
- **Source:** https://www.designmotionhq.com/patterns/doherty-threshold
- **One-liner:** Respond within 400ms with acknowledgment/skeleton/optimistic paint even if real work takes longer; blank freezes kill engagement.
- **ERP relevance:** Known slow endpoints (inventory, completed jobs); button clicks on caja; navigation between modules.
- **Verdict:** **APLICAR**
- **Why:** Operationalizes R-014 while backend latency remains. Mandate immediate UI acknowledgment on known-slow routes without claiming the API got faster.


### R-033 — Filter chips with live count + clear-all
- **Source:** https://www.designmotionhq.com/patterns/filter-chips
- **One-liner:** Idle/active/disabled chip states; OR within group / AND across; update result count same frame; sticky active summary; horizontal scroll not multi-row wall; clear-all escape hatch.
- **ERP relevance:** Inventory filters, sales history, job boards, catalog browsing on tablet.
- **Verdict:** **APARCAR**
- **Why:** Solid list UX but broader than P0. Revisit with R-006/R-007 table/mobile polish phase.


### R-034 — Dropdown: 48px trigger, flip, keyboard, search@10+
- **Source:** https://www.designmotionhq.com/patterns/dropdown-design
- **One-liner:** Large touch target + caret; flip upward near edges; arrows/Enter/Esc; add search once options exceed ~10; open anim ~150ms.
- **ERP relevance:** Branch/sucursal selectors, role pickers, payment methods, status filters, catalog attributes.
- **Verdict:** **APLICAR**
- **Why:** Touch and keyboard quality on shared Select. Small component improvement with wide reuse; watch sucursal/role QA (# branch issues).


### R-035 — Swipe actions need affordance + non-swipe fallback
- **Source:** https://www.designmotionhq.com/patterns/swipe-actions
- **One-liner:** Swipes are invisible without hints; destructive needs partial reveal + tap or undo; ≤2 actions/side; always provide long-press/menu fallback.
- **ERP relevance:** Mobile job lists, notifications, technician queues — complements R-010/R-021.
- **Verdict:** **APARCAR**
- **Why:** Nice mobile enhancement after sheets/context menus exist. Discovery/a11y risks if swipe-only. Park until R-010/R-021 land.








### R-010 — Context menu como sistema (PC + móvil)
- **Fecha evaluación:** 2026-09-12
- **Fuente:** Facebook Reel — Design Motion  
  https://www.facebook.com/share/r/1BsSDS2xE6/  
  (reel `1030653972707108`)
- **Idea (resumen):** “Context menu is a system / Right-click is a system”: menú con iconos + labels, hover/selected, **separadores por grupos**, acción destructiva en rojo (Delete).
- **Veredicto:** **APLICAR** (promovido por Xinon 2026-09-12: implementar aunque estaba aparcado)
- **Impacto en McLarens ERP:**
  - **PC / caja-escritorio:** clic derecho o ⋯ en filas (inventario, usuarios, ventas, órdenes, evidencias).
  - **Smartphones / tablet:** long-press → bottom sheet / action sheet (no menú flotante de escritorio); targets ≥44px.
- **Implementación (Case / cloud agent):**
  1. Componente compartido `ContextActions` + shells `DesktopMenu` / `MobileSheet`
  2. Separadores por grupo; Delete/anular al final en color peligro + confirmación
  3. Misma lista de acciones; no ocultar críticas solo en right-click
  4. Integrar en 1–2 pantallas piloto (p.ej. lista con ⋯) sin romper CRITICAL sales/PIN
- **Relacionado:** R-006/R-007; handoff CRITICAL_ZONES.


### R-009 — Drag-and-drop UX: progreso “honesto” en uploads
- **Fecha evaluación:** 2026-09-12
- **Fuente:** Facebook Reel — Design Motion  
  https://www.facebook.com/share/r/1QN7kbvsNg/  
  (reel `1029052806542981`)
- **Idea (resumen):** “SIGNAL 02 — HONEST PROGRESS”: un spinner (“Uploading…”) **esconde la verdad**. Mostrar nombre/tamaño, **%**, barra, **tiempo restante** y **MB/s** para que el usuario decida esperar o cancelar (“wait or walk away”).
- **Veredicto:** **APLICAR** (en los uploaders de medios; no es P0 global)
- **Impacto en McLarens ERP:** **Alto** justo donde Xinon lo señaló:
  1. **Endpoint / UI de videos de publicidad** (login splash / `BackgroundPromoVideo` y flujo admin de subir promo) — archivos grandes (decenas de MB); un misterio-spinner frustra en tienda con Wi‑Fi flojo.
  2. **Imágenes de pruebas de taller** (evidencia QC / work orders / polarizados) — varias fotos; hace falta progreso por archivo + cola, no un único “subiendo…”.
- **Requisitos concretos para Antigravity / FE cuando toquen esos flujos:**
  - `XMLHttpRequest`/`fetch` + `upload.onprogress` (o equivalente) → `loaded/total` → % y ETA
  - Mostrar: filename, size, %, barra, ETA, throughput; botón **Cancelar**
  - Multi-file: lista con estado por ítem (pending / uploading / done / error)
  - No sustituye validación de tipo/tamaño ni storage (GCS); es UX del progreso
- **No hacer ahora:** no priorizar sobre issues #4–#7 / P0 seguridad. Cuando abran PR del uploader de publicidad o evidencias de taller, **incluir honest progress** (aceptación del PR).
- **Relacionado:** `frontend/src/components/auth/BackgroundPromoVideo.jsx`; rol publicidad; flujos taller/QC.


### R-008 — “5 fixes to AI slop in dashboards” / UX Engine plugin
- **Fecha evaluación:** 2026-09-12
- **Fuente:** Facebook Reel — Design Motion  
  https://www.facebook.com/share/r/1CQMxMiEYH/  
  (reel `1562348875576398`)
- **Idea (resumen):** Evitar “AI slop” en dashboards (tells genéricos de UI generada). Promo de plugin Claude Code **UX Engine** (`/ux-design`, `/ux-audit`, `/ux-review`, `/restyle`, ~$79).
- **Veredicto:** **OBVIAR**
- **Impacto en McLarens ERP:** Bajo. El ERP ya tiene UI propia (no un dashboard SaaS genérico de demo). Comprar/usar ese plugin no arregla P0/#4–#7 ni latencias. Un restyle masivo contradice handoff (no rediseño UX de golpe / no tocar CRITICAL por estética).
- **Núcleo reusable (si algún día pulen FE):** evitar KPIs decorativos sin acción, charts de relleno, badges/gradientes “AI default”; priorizar densidad operable en tienda. Eso ya está cubierto en espíritu por R-006/R-007 aparcados — no hace falta este reel ni el plugin.
- **Acción Antigravity ahora:** ninguna. No instalar plugins de terceros ni PR de “de-AI dashboard”.
- **Relacionado:** R-006/R-007 APARCAR; handoff §6 rediseño UX fuera de alcance inmediato.


### R-007 — Tablas en móvil (no achicar: reestructurar)
- **Fecha evaluación:** 2026-09-12
- **Fuente:** Facebook Reel — Design Motion  
  https://www.facebook.com/share/r/1LeJn6SrmQ/  
  (reel `1074809841592221`)
- **Idea (resumen):** “Your table doesn’t fit a phone. Shrinking it isn’t the fix.” Hay que **reestructurar** (p.ej. cards, columnas prioritarias, sticky + scroll, detalle al tap) — no comprimir la grilla de escritorio.
- **Veredicto:** **APARCAR** (útil para móvil; no ahora)
- **Impacto en McLarens ERP:** Medio-alto en roles de piso (técnicos, polarizados/KDS, entregador, a veces ventas/caja en tablet). Achicar `/inventory`, usuarios o listas de órdenes en un teléfono los vuelve inutilizables; el consejo es el correcto.
- **Patrones a considerar cuando toque FE móvil (junto R-006):**
  1. Filas → **cards** con 3–4 campos clave + tap para detalle
  2. Ocultar columnas de baja prioridad (`md+` only)
  3. Sticky de columna identidad + scroll horizontal (si hay que comparar)
  4. Acciones grandes touch (no menús hover)
  5. Filtros en sheet/bottom, no barra densa de escritorio
  6. No `font-size: 8px` ni zoom forzado como “solución”
- **Acción Antigravity ahora:** ninguna. No PR de responsive tables hasta después de P0/#4–#7 (y idealmente un criterio de qué pantallas se usan en teléfono).
- **Relacionado:** R-006 APARCAR (sistema de tabla); entregador/GPS móvil; handoff fuera de alcance “rediseño UX” inmediato.


### R-006 — UX de data tables (“A table is six decisions”)
- **Fecha evaluación:** 2026-09-12
- **Fuente:** Facebook Reel — Design Motion (@designmotionhq)  
  https://www.facebook.com/share/r/1C6RVzTzJd/  
  (reel `1268917731967815`)
- **Idea (resumen):** Una tabla de datos es un sistema; seis decisiones de UX: **Align**, **Density**, **Cells**, **Rows**, **Sticky**, **Actions** (más búsqueda/filtros/paginación en el ejemplo).
- **Veredicto:** **APARCAR**
- **Impacto en McLarens ERP:** Medio a futuro. El ERP está lleno de grillas (inventario, usuarios, ventas, reportes, vehículos, créditos…). Mejorar alineación numérica, densidad, badges de estado, sticky header y menú de acciones por fila mejoraría operación en tienda — pero **no** arregla P0/#4–#7 ni latencias de API.
- **Si se retoma (post P1, FE polish / FRONTEND_MODERNIZATION):**
  - Inventario, Users, Sales/Quotations lists, Cashier queues: sticky header, align montos a la derecha, densidad compacta para POS, acciones claras (no esconder en hover-only en touch).
  - Un PR de diseño de tabla compartida > retocar pantalla por pantalla sin sistema.
- **Acción Antigravity ahora:** ninguna. No abrir PR de rediseño de tablas.
- **Relacionado:** handoff §6 “Rebrand / rediseño UX” fuera de alcance inmediato; R-003 (no reescritura grande).


### R-005 — 10 algoritmos de load balancing
- **Fecha evaluación:** 2026-09-11
- **Fuente:** Facebook Reel — VikStack  
  https://www.facebook.com/share/r/1DG3NrnVja/  
  (reel `1752114135821720`)
- **Idea (resumen):** Catálogo visual de algoritmos de balanceo: round robin, weighted, least connections, least response, IP hash, consistent hashing, random, sticky sessions, least bandwidth, failover.
- **Veredicto:** **OBVIAR**
- **Impacto en McLarens ERP:** Nulo como trabajo de repo. El tráfico ya lo reparte **Cloud Run / balanceador de Google**; no se implementan estos algoritmos en FastAPI. Sticky sessions solo importarían si la sesión viviera solo en memoria de una instancia (ustedes usan cookie + backend/Mongo).
- **Acción Antigravity ahora:** ninguna. No abrir PR de load balancer.
- **Relacionado:** R-003 (un solo servicio Cloud Run); escala horizontal la gestiona la plataforma.


### R-004 — Database failover (HA primario → backup)
- **Fecha evaluación:** 2026-09-11
- **Fuente:** Facebook Reel — Afzal Web Solutions  
  https://www.facebook.com/share/r/1GwvQDFsoE/  
  (reel `1380542970859531`)
- **Idea (resumen):** Database failover = cambiar automáticamente a una DB de respaldo cuando cae la primaria, en un setup de alta disponibilidad.
- **Veredicto:** **OBVIAR** (para código/Antigravity)
- **Impacto en McLarens ERP:** Bajo como tarea nueva. El ERP ya usa **MongoDB Atlas** (`mongodb+srv://…?retryWrites=true&w=majority`) según `deploy/GUIA_DESPLIEGUE_GOOGLE_CLOUD.md`, más backups diarios a Google Drive. Atlas con replica set ya hace failover automático del primario; no hace falta reimplementar failover en FastAPI.
- **Si algún día duele (ops, no feature):**
  - Verificar tier/cluster Atlas (réplicas, región GCP alineada a Cloud Run).
  - Ensayo controlado de failover / alertas Atlas.
  - No escribir lógica casera “si primary down, conectar a secondary” en `server.py`.
- **Acción Antigravity ahora:** ninguna. No abrir PR de failover.
- **Relacionado:** guía deploy Atlas + backups Drive; P0 seguridad del handoff tiene prioridad.


### R-003 — Monolito vs microservicios (Amazon “back to monolith”)
- **Fecha evaluación:** 2026-09-11
- **Fuente:** Facebook Reel — Coding Chops  
  https://www.facebook.com/share/r/19dxtNisUA/  
  (reel `1721221349207912`)
- **Idea (resumen):** Amazon habría vuelto a un monolito y bajado costos ~90%. Mensaje: **los microservicios no siempre son la respuesta**.
- **Veredicto:** **APLICAR (solo guardrail / sin PR de feature)**
- **Impacto en McLarens ERP:** Alto como *criterio de arquitectura*, nulo como tarea de código nueva. Refuerza R-001 (EDA/microservicios aparcado), el handoff §6 (“no reescritura total del monolito”) y `SAFE_FIRST_REFACTORS.md` / `MONOLITH_DECOMPOSITION_PLAN.md` (helpers y módulos *dentro* del mismo deploy).
- **Matiz factual:** el caso famoso suele ser **Prime Video** (monitoreo AV) consolidando servicios, no “todo Amazon”. La lección para un ERP Cloud Run de una PyME sí aplica: ops y costo de red/latencia entre N servicios suelen ser peores que un monolito modular bien acotado.
- **Acción Antigravity ahora:**
  1. **No** proponer ni abrir PRs de “partir en microservicios”.
  2. Seguir P0–P3 del handoff: seguridad, contratos, perf de lecturas, extracción de helpers **en el mismo artefacto Cloud Run**.
  3. Si alguien pide split: citar este R-003 + handoff §6 y escalar a Xinon/Case.
- **Por qué no OBVIAR:** sí aporta utilidad — alinea decisiones y evita trabajo caro. No es un feature; es política.
- **Relacionado:** R-001 APARCAR; handoff §6; P3 descomposición incremental interna.


### R-002 — Cron jobs / crontab (tareas programadas)
- **Fecha evaluación:** 2026-09-11
- **Fuente:** Facebook Reel — Afzal Web Solutions  
  https://www.facebook.com/share/r/1C8MvafK84/  
  (reel `28104495745874142`)
- **Idea (resumen):** Explica qué es un cron job y la sintaxis de 5 campos del crontab (minuto, hora, día…) para correr código en el servidor sin que alguien esté presente.
- **Veredicto:** **OBVIAR** (confirmado por Xinon 2026-09-11: no aplica). Tutorial de crontab; no aporta diseño útil para Cloud Run.
- **Impacto en McLarens ERP:** Bajo-medio. El ERP **ya** tiene programación interna: `backend/services/weekly_business_sentinel.py` (APScheduler + resumen ejecutivo Telegram) y la guía de deploy menciona `crontab -e` para sync nocturno. En **Cloud Run** el contenedor es efímero (scale-to-zero / multi-instancia): un crontab clásico o un APScheduler solo en proceso es frágil (jobs duplicados o que no corren).
- **Si se retoma (post P1 / higiene deploy):**
  - Preferir **Cloud Scheduler → HTTP autenticado** (OIDC / `SCHEDULER_TOKEN`) a endpoints internos, no `crontab` dentro del Dockerfile.
  - Auditar que `weekly_business_sentinel` no dependa de `localhost:8001` frágil en producción.
  - Candidatos de schedule: resumen semanal, limpieza de drafts/sesiones, reconciliación inventario, alertas de locks PIN — uno por uno.
- **Por qué no APLICAR ya:** El reel es tutorial básico; no aporta diseño nuevo. Meter crontab en la imagen Cloud Run empeoraría ops. Prioridad sigue en P0 seguridad + issues #4–#7.
- **Acción Antigravity ahora:** ninguna. **OBVIAR** — no abrir PR ni ticket.
- **Relacionado handoff / código:** P4 higiene deploy; `weekly_business_sentinel.py`; `deploy/GUIA_DESPLIEGUE_GOOGLE_CLOUD.md` (sección crontab).

### R-001 — Event-driven vs llamadas síncronas en cadena
- **Fecha evaluación:** 2026-09-11
- **Fuente:** Facebook Reel — Phạm Tùng  
  https://www.facebook.com/share/r/1abMHNkg73/  
  (reel `2080027619297742`)
- **Idea (resumen):** Si un servicio muere y otros lo llaman en cadena (síncrono), se congelan en cascada. Con event-driven, se publica un hecho y los consumidores reaccionan desacoplados.
- **Veredicto:** **APARCAR**
- **Impacto en McLarens ERP:** Medio-alto *a futuro*, bajo *ahora*. El ERP es FastAPI+React+Mongo en Cloud Run (monolito / semi-monolito). El dolor real de QA (cargas >15s, inventario lento, venta↔stock↔técnicos) sí sugiere **desacoplar algunos side-effects**, no microservicios.
- **Si se retoma (fase sugerida: post P1, junto a P2 perf / approvals):**
  - Eventos *internos* selectivos: p.ej. `SaleCompleted`, `ManagerPinApproved`, notificaciones/reportes en cola.
  - No partir caja/ventas/login en servicios separados.
  - Exigir: idempotencia, reintentos con backoff, DLQ/observabilidad antes de fan-out amplio.
- **Por qué no APLICAR ya:** Issues abiertos #4–#7 (crash `/my-completed-jobs`, permisos coordinador, GPS entregador, sucursal) y P0 seguridad del handoff tienen prioridad. EDA prematura aumenta complejidad de debug.
- **Acción Antigravity ahora:** ninguna. No abrir PR de “migración event-driven”.
- **Relacionado handoff:** P1.1 (approvals/WS), P2 (perf/caché lecturas), fuera de alcance §6 “reescritura total”.

---

## Plantilla para Case (copiar al agregar)

```
### R-XXX — <título corto>
- **Fecha evaluación:** YYYY-MM-DD
- **Fuente:** <url>
- **Idea (resumen):** …
- **Veredicto:** APLICAR | APARCAR | OBVIAR
- **Impacto en McLarens ERP:** …
- **Si APLICAR:** tareas concretas + tests + PR sugerido
- **Si APARCAR:** cuándo retomar / dependencias
- **Si OBVIAR:** por qué (1–3 líneas)
- **Acción Antigravity ahora:** …
- **Relacionado handoff / issues:** …
```
