# MONOLITH_DECOMPOSITION_PLAN

This is a safe decomposition outline for later phases. It does not prescribe code changes yet.

## Backend Monolith

### Current shape
- `backend/server.py` is the live monolith.
- It mixes app bootstrap, auth/session handling, draft backup, static serving, and router registration.
- It also hosts helper logic that belongs in focused modules.

### Decomposition target
1. Extract app bootstrap.
- Keep ASGI app creation, middleware registration, and router mounting in a small entry module.
- Preserve route prefixes and CORS behavior exactly.

2. Extract auth/session policy.
- Isolate session lock, PIN validation, permission helpers, and invalid-session behavior.
- Preserve response shape and failure messages.

3. Extract draft backup policy.
- Move backup persistence and recovery logic into a dedicated service layer.
- Keep the same endpoint contract and localStorage sync assumptions.

4. Extract router-specific feature modules.
- Inventory and human resources are already focused enough to remain mounted as feature routers.
- Other legacy feature routes should be reviewed separately before any move.

5. Extract static/frontend serving configuration.
- Frontend build mounting should be isolated from API logic to reduce startup coupling.

### Sequence constraint
- Do not split the backend monolith before the runtime contract table is validated.
- Do not rewire unmounted legacy routers into runtime without first deciding whether they are compatibility shims or obsolete artifacts.

## Frontend Monoliths

### SaleForm
- Largest shared feature monolith.
- Owns customer/vehicle selection, cart state, price editor, VIN decoding, installation behavior, discount logic, draft snapshots, and UX animation.
- Decomposition target:
  1. Pure calculation helpers.
  2. Draft snapshot builder/normalizer.
  3. Customer/vehicle subflows.
  4. Cart actions and history.
  5. Presentation-only sections.
- Preserve the exact submission payload and the visual rhythm of the current flow.

### SalesPage
- Owns draft orchestration, product search, compatibility checks, printing, approval-related actions, and customer/vehicle creation.
- Decomposition target:
  1. Draft orchestration hook.
  2. Data fetching hook.
  3. Invoice action hook.
  4. Customer creation helper.
  5. Presentation shell.
- Preserve embedded-form behavior and the workbench interactions.

### QuotationsPage
- Mirrors SalesPage but with quote-specific draft and conversion logic.
- Decomposition target:
  1. Draft orchestration hook.
  2. Conversion to sale draft helper.
  3. Quote total helper.
  4. Presentation shell.
- Preserve conversion semantics and availability checks.

### CashierPage
- Owns money controls, session lock/unlock, invoice tabs, preview panel, and reporting.
- Decomposition target:
  1. Session state hook.
  2. Invoice loader hook.
  3. Denomination math helper.
  4. Cash movement / collection action helpers.
  5. Presentation shell.
- Preserve all lock behavior and financial safety checks.

### MainLayout
- Owns navigation shell, session lock overlay, connectivity polling, autosave status, and responsive controls.
- Decomposition target:
  1. Shell frame.
  2. Session-lock controller hook.
  3. Connectivity/polling hook.
  4. Topbar presentation.
- Preserve the exact lock semantics and responsive breakpoints.

## Decomposition Order

1. Stabilize runtime contracts.
2. Extract pure helpers only.
3. Extract read-only UI subcomponents.
4. Extract hooks for polling and draft orchestration.
5. Extract session / auth policy last.

## Exit Criteria

- No visible UX changes in sales, quotations, cashier, login, or theme-sensitive surfaces.
- No change in payload shape for sales, quotations, or drafts.
- No change in session lock behavior or autosave order.
- No backend route registration changes until the compatibility matrix is finalized.
