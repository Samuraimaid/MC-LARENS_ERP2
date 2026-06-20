# DO_NOT_TOUCH_YET

Temporary no-touch zones for Phase 3.

## Absolutely do not touch yet

- auth and session logic
- draft restore, draft backup, or draft engine behavior
- totals, discount math, IVA, retention, or currency conversion
- cashier session open/close, money movement, and invoice collection math
- inventory mutations or stock availability logic
- approvals workflow and approval resolution
- websocket runtime and gerencia WebSocket wiring
- server.py decomposition into multiple modules
- SaleForm structural split
- quote-to-sale conversion semantics
- login PIN flow and lockout behavior

## Do not touch unless tests and contract freeze exist

- payload shape for sales
- payload shape for quotations
- payload shape for drafts
- session lock UX and tamper behavior
- branch-based theme defaults and watermark loading
- any layout, animation, or responsive behavior in the core workbench flows

## Why these are blocked

- They are the highest-risk production contracts.
- They are cross-cutting and hard to roll back if partially changed.
- They combine storage, timers, network calls, and visible UX state.
- They can cause financial, access-control, or customer-facing regressions.

## Additional caution zones

- MainLayout
- AuthContext
- ThemeContext
- SaleForm
- SalesPage
- QuotationsPage
- CashierPage
- LoginPage
- backend/server.py
- backend/api/v1/* legacy compatibility area

## Exit criteria for lifting the block

- Baseline snapshots are frozen.
- Contracts are frozen and documented.
- Regression tests exist for the touched slice.
- Rollback path is proven.
- Feature-flag or fallback path exists when UX/runtime is affected.
