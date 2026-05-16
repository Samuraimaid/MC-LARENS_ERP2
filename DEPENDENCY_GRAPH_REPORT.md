# DEPENDENCY GRAPH REPORT

Phase 2 dependency and coupling map. This document records runtime dependencies, hidden contracts, and side effects without changing code.

## 1. Backend Dependency Map

### Core runtime
- `backend/server.py` owns the live FastAPI app instance and mounts the active API router.
- `backend/server.py` instantiates `AsyncIOMotorClient` and a shared `db` handle.
- `backend/server.py` registers CORS middleware twice: an initial dev-only origin list and a later environment-driven list.
- `backend/server.py` conditionally mounts frontend static assets from `frontend/build`.

### Active router wiring
- `backend/routes/inventory.py` is injected into `server.py` via `get_inventory_router(db, audit_service, require_auth, require_roles, InventoryUpdate)`.
- `backend/routes/human_resources.py` is injected into `server.py` via `get_human_resources_router(db, audit_service, require_auth, require_roles, verify_pin_hash)`.
- Both routers depend on server-local auth and role helpers.

### Unmounted legacy modules
- `backend/api/v1/auth.py` depends on `backend.db.session.get_collection` and `backend.core.security.verify_cajero_pin`.
- `backend/api/v1/approvals.py` depends on `backend.models.approval_request`, `backend.services.approval_service`, `backend.core.security.get_current_user`, and `backend.core.websocket_manager.manager`.
- `backend/api/v1/reports.py` depends on `backend.db.session.get_collection` and `backend.core.security.get_current_user`.
- `backend/api/v1/websockets.py` depends on `backend.core.websocket_manager.manager` and `backend.core.security.get_current_user`.

### Hidden backend coupling
- Auth/session flows touch draft sync, theme sync, and permissions retrieval in the same login check paths.
- Draft backup endpoints in `server.py` are coupled to frontend localStorage sync and autosave logic.
- Cashier, sales, quotations, and inventory all share the same MongoDB collections, so totals and stock assumptions are cross-cutting.
- Approvals and reports are coupled to approval_requests / approval-related collections even when the routes are not mounted.

## 2. Frontend Dependency Map

### Core app shell
- `frontend/src/index.js` bootstraps React and installs global Axios request/response interceptors.
- `frontend/src/App.js` defines the route tree and wraps it in `AuthProvider` and `ThemeProvider`.
- `frontend/src/components/layout/MainLayout.jsx` is the operational shell for most authenticated routes.
- `frontend/src/components/layout/KDSLayout.jsx` is the special shell for KDS and attendance flows.

### Shared contexts and hooks
- `frontend/src/context/AuthContext.js` depends on:
  - `axios` and `frontend/src/lib/api.js`
  - `frontend/src/lib/userUiPreferences.js`
  - `frontend/src/lib/branding.js`
  - browser `localStorage` and `sessionStorage`
  - backend auth, permission, draft, and logout endpoints
- `frontend/src/context/ThemeContext.js` depends on:
  - `axios` and `frontend/src/lib/api.js`
  - browser theme and watermark storage
  - backend appearance settings endpoint
- `frontend/src/hooks/useDevice.js` feeds responsive layout branches in MainLayout and LoginPage.
- `frontend/src/lib/useRoles.js` is a cached role fetcher used by settings and related screens.

### Sales / quotations coupling
- `frontend/src/pages/SalesPage.jsx` and `frontend/src/pages/QuotationsPage.jsx` both depend on `frontend/src/components/sales/SaleForm.jsx`.
- Both pages use the same draft bundle contract via `frontend/src/lib/serverDrafts.js` and `frontend/src/lib/draftStorage.js`.
- Both pages calculate totals from the same payment method, tax, exchange rate, and discount rules.
- Both pages rely on localStorage keys for active draft state, draft lists, and embedded-form visibility.

### Cashier / session coupling
- `frontend/src/pages/CashierPage.jsx` depends on `localStorage` key `cashier.shift.state.v2` for session persistence.
- Cashier actions depend on backend money endpoints, session lock/unlock endpoints, and billing / cancel-reason settings.
- Cashier and MainLayout both enforce session-lock behavior and read session state.

### Notifications / approvals / reports coupling
- `frontend/src/pages/NotificationsPage.jsx` imports `FollowupsPage` and `ApprovalsPage` directly and embeds them in tabs.
- `frontend/src/components/GerenteApprovalPanel.jsx` depends on a WebSocket path `/ws/gerencia` and approval resolve endpoints.
- `frontend/src/pages/ReportsPage.jsx` and `frontend/src/components/ExecutiveAuditDashboard.jsx` reflect overlapping reporting concepts but depend on different backend endpoints.
- `frontend/src/pages/HyperVisorPage.jsx` is the stronger live audit/report surface and likely the current runtime contract for operational reporting.

## 3. Cross-Layer Contracts

### Auth and session
- Frontend expects `/api/auth/me`, `/api/auth/login`, `/api/auth/pin/login`, `/api/auth/session`, `/api/auth/logout`, and permission endpoints.
- Login flow expects response data to include user identity, theme mode, theme skin, remaining attempts, lockout metadata, or equivalent session status details.
- MainLayout expects `/api/auth/me` to expose `session_locked`.

### Drafts
- Frontend draft flows use `GET /api/drafts/backup`, `POST /api/drafts/backup`, `DELETE /api/drafts/backup` plus flow-specific server draft endpoints.
- Draft snapshots are assumed to preserve selected customer, selected vehicle, cart items, global discount, tax state, payment method, and notes.
- Sales and quotations both assume draft list/state persistence in localStorage and server round-tripping.

### Sales / quotations / payments
- Frontend expects payload fields such as `customer_id`, `vehicle_id`, `warehouse_id`, `items`, `discount`, `payment_type`, `payment_method`, `mixed_payment_methods`, `credit_days`, `apply_iva`, `iva_rate`, `currency`, `exchange_rate`, `discount_codes`, `applied_discounts`, `retention_rate`, `retention_amount`, and `total_amount`.
- Frontend assumes payment methods control discount eligibility.
- Frontend assumes prices are often in USD and may be converted to NIO using current exchange rate.

### Inventory
- Sales and quotations assume inventory rows are filterable by product and warehouse and can be enriched with product metadata.
- Sales and quotations use stock / low-stock logic from inventory and may be branch-sensitive.
- Cashier and sales flows both rely on consistent sale totals and invoice states.

### Approvals / reports / websocket legacy contracts
- Legacy approvals UI expects a gerencia WebSocket and approval request/resolve payloads.
- Reports UIs expect approval-oriented or audit-oriented summary data, even though the live backend routing differs.
- These are now compatibility contracts, not confirmed active runtime contracts.

## 4. Side Effects Detected

### Backend side effects
- `backend/server.py` creates global Mongo clients and shared collections at import time.
- `backend/server.py` registers middleware and mounts static routes on startup.
- Draft backup endpoints write directly to the Mongo `drafts_backup` collection.
- Several server helpers mutate shared DB state indirectly through imported services.

### Frontend side effects
- `frontend/src/index.js` installs Axios interceptors globally and writes `window.__LAST_API_LOG__`.
- `frontend/src/index.js` unregisters service workers and clears caches on load.
- `frontend/src/context/AuthContext.js` patches `window.localStorage.setItem` to trigger draft sync.
- `frontend/src/context/AuthContext.js` writes drafts to backend backup storage on logout.
- `frontend/src/context/AuthContext.js` dispatches `theme:sync` and `ui:sound-sync` events.
- `frontend/src/context/ThemeContext.js` writes `theme_mode`, `theme_skin`, `theme`, and `watermark_opacity` to localStorage and listens to `storage` / custom sync events.
- `frontend/src/components/layout/MainLayout.jsx` performs polling, lock-state mutation, history tamper guards, and session storage writes.
- `frontend/src/pages/LoginPage.jsx` performs interval polling, fresh-session cleanup, keyboard capture, and direct navigation.
- `frontend/src/pages/SalesPage.jsx` and `frontend/src/pages/QuotationsPage.jsx` perform repeated autosave timers and draft persistence writes.
- `frontend/src/pages/CashierPage.jsx` writes shift/session state to localStorage and polls invoices while open.

## 5. Dangerous Dependency Zones

| Zone | Depends On | Why Sensitive |
|---|---|---|
| backend/server.py auth | auth, session, permissions, drafts | It is the live entry point and the majority of auth/session logic is inline. |
| backend/server.py drafts | Mongo drafts backup, front-end localStorage sync | Could silently break sales/quotations recovery. |
| sales totals | exchange, tax, discounts, payment methods | One mismatch changes invoice totals and accounting. |
| quotations totals | exchange, tax, discounts, payment methods | Same risk as sales, plus conversion to sale. |
| cashier session flow | session lock, invoice state, money movements | Sensitive financial control surface. |
| approvals / websocket legacy | websocket manager, approval service, legacy routes | Unmounted now, but still referenced by UI and scripts. |
| theme and branding sync | localStorage, backend appearance, branch defaults | Visual bleed between users or inconsistent branding. |
| draft sync | localStorage mutation, timers, server backup | Hidden auto-save behavior can silently lose or duplicate state. |
| inventory mutations | warehouse / branch scoping, stock assumptions | Can affect stock counts and sales availability. |

## 6. Dependency Interpretation

- The live app is not just a router tree; it is a set of coupled runtime protocols between frontend storage, backend backup endpoints, and shared calculation rules.
- Unmounted legacy modules remain important because they still describe expected contracts in the UI and in scripts.
- The most fragile path is not simple import dependency, but side-effect dependency through storage, timers, and implicit payload shapes.
