# Design Motion — overnight UX tip candidates (McLarens ERP)

**Batch date:** 2026-09-12
**Repo:** Samuraimaid/MC-LARENS_ERP2
**For:** Xinon / Case → Antigravity inbox
**IDs:** Continues after evaluated R-001…R-010 → **R-011…R-035**

## Source recovery notes

- **Facebook page** `https://www.facebook.com/p/Design-Motion-61588326206046/` and share root: **login-walled / fetch timeout**. No cookies accepted; no FB login attempted. Could not mine reels directly from FB in this batch.
- **Recovered from public site:** `https://www.designmotionhq.com` + **`/patterns`** library (76 free pattern breakdowns with Key insights + Do/Don't). Sitemap listed all pattern URLs.
- **Also indexed:** Instagram/TikTok handles linked from site (`@designmotionhq`); content principles recovered via pattern pages rather than social embeds.
- **Skipped as already evaluated:** R-001 EDA APARCAR; R-002 cron OBVIAR; R-003 monolith guardrail APLICAR; R-004 failover OBVIAR; R-005 LB OBVIAR; R-006 table UX APARCAR (pattern data-table skipped as duplicate); R-007 mobile tables APARCAR; R-008 AI slop OBVIAR (de-ai landing / charts-that-lie promo skipped); R-009 honest upload APLICAR (deepened as R-028, not re-logged as duplicate); R-010 context menus APLICAR (pattern context-menu skipped as duplicate)
- **Skipped (low transfer / promo / motion-only):** animation-timing, easing-curves, scroll-driven-animations, card-hover-anatomy (pure motion); de-ai-landing-hero, landing-page-skeleton, reverse-engineered-linear, perfect-card, gradient-design, golden-ratio, gestalt, von-restorff, depth-layers, border-radius, shadow-elevation, design-system-kit, design-tokens (brand/visual kit / plugin sales); live-cursors, star-rating, color-picker-ux, range-sliders, css-has-selector, z-index-mastery, peak-end, serial-position, zeigarnik (low ERP transfer now); UX Engine $79 plugin purchase (R-008 already OBVIAR)

## Verdict summary

| Verdict | Count |
|---------|-------|
| APLICAR | 20 |
| APARCAR | 5 |
| OBVIAR | 0 |
| **Total NEW** | **25** |

## Candidates

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

## Suggested next actions for Case

1. Promote selected **APLICAR** into `ANTIGRAVITY_REELS_EVAL.md` / `ANTIGRAVITY_APLICAR_TODO.md` (especially R-011–R-015, R-017–R-022, R-026, R-028, R-031–R-032, R-034).
2. Keep **APARCAR** (R-023, R-027, R-030, R-033, R-035) for post-P0 FE polish with R-006/R-007.
3. When Xinon pastes a FB reel that matches a pattern above, cross-link reel URL to the R-0xx ID instead of creating a duplicate.
4. Re-try FB mining only if Xinon exports reel links or provides screenshots — do not log in.
