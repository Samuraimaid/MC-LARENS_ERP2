# CODE CLASSIFICATION MATRIX

Phase 2 classification for the ERP codebase. This is a discovery-only map: no deletions, no moves, no refactors.

## Legend

- ACTIVE: live, mounted, and in runtime use.
- ACTIVE-BUT-MONOLITHIC: live but too large or multi-responsibility.
- LEGACY-COMPAT: old but still useful or kept for compatibility.
- DUPLICATED: overlapping responsibilities or repeated implementations.
- PATCHWORK: workaround, fallback, hotfix, or accumulated escape hatch.
- DEAD: no runtime usage detected, but not safe to remove yet.
- ARCHIVE-CANDIDATE: historical, backup, or experimental.
- DANGEROUS-TO-TOUCH: core auth/session/payment/inventory/draft/calculation zones.

## Classification Summary

| Path / Area | Classification | Evidence / Reason |
|---|---|---|
| backend/server.py | ACTIVE-BUT-MONOLITHIC, DANGEROUS-TO-TOUCH | Main FastAPI runtime; contains auth, drafts, backup, API root, frontend static serving, router mounting, and many business routes inline. |
| backend/routes/inventory.py | ACTIVE | Mounted into api_router in server.py; inventory endpoints used by frontend. |
| backend/routes/human_resources.py | ACTIVE | Mounted into api_router in server.py; HR endpoints used by frontend. |
| backend/api/v1/auth.py | DEAD, LEGACY-COMPAT | File exists, but not mounted in server.py; auth flow is handled inline in server.py and frontend still references related auth contracts. |
| backend/api/v1/approvals.py | DEAD, LEGACY-COMPAT, DANGEROUS-TO-TOUCH | Not mounted, but approval UI and flows still exist on frontend; depends on websocket manager and approval service. |
| backend/api/v1/reports.py | DEAD, LEGACY-COMPAT | Not mounted; overlaps with active HyperVisorPage / reports UIs. |
| backend/api/v1/websockets.py | DEAD, LEGACY-COMPAT | Not mounted; frontend gerencia websocket expectations remain. |
| backend/core/websocket_manager.py | LEGACY-COMPAT, DANGEROUS-TO-TOUCH | Defined and imported by legacy approval routes; currently not wired into runtime. |
| backend/db/session.py | LEGACY-COMPAT | Separate sync Mongo helper still referenced by legacy api/v1 files. |
| backend/services/audit.py | ACTIVE | Imported by server.py and used by active router logic. |
| backend/services/cash.py | ACTIVE | Imported by server.py and used by cash operations. |
| backend/services/pin_policy.py | ACTIVE | Imported by server.py and used in auth/session-related code paths. |
| backend/services/approval_service.py | LEGACY-COMPAT, DEAD | Used only by unmounted approvals route; not part of active runtime. |
| backend/services/venta_service.py | DEAD / PATCHWORK candidate | Previously identified as placeholder / pass-heavy service; not in the active wiring. |
| backend/tests/test_bug_fixes_iteration7.py | ACTIVE | Regression tests reference live endpoints like /api/inventory and /api/dashboard/stats. |
| backend/scripts/e2e_quick_approval.py | LEGACY-COMPAT, DEAD | Script expects approval endpoints that are not mounted in current runtime. |
| frontend/src/App.js | ACTIVE | Main route registration and auth/layout bootstrapping. |
| frontend/src/index.js | ACTIVE, PATCHWORK | Global Axios logging and service worker/cache cleanup are side-effectful debug/bootstrap logic. |
| frontend/src/context/AuthContext.js | ACTIVE, DANGEROUS-TO-TOUCH, PATCHWORK | Owns auth checks, draft sync, theme sync, session invalidation handling. |
| frontend/src/context/ThemeContext.js | ACTIVE, DANGEROUS-TO-TOUCH | Owns current theme, skin, watermark, and storage sync. |
| frontend/src/components/layout/MainLayout.jsx | ACTIVE, DANGEROUS-TO-TOUCH, PATCHWORK | Central shell with lock workflow, autosave status, connectivity checks, responsive nav, and session lifecycle. |
| frontend/src/components/layout/KDSLayout.jsx | ACTIVE, LEGACY-COMPAT | Used for KDS and attendance routes; also has theme controls with a partial theme API mismatch surface. |
| frontend/src/components/layout/BottomNav.jsx | ACTIVE | Mobile workbench navigation. |
| frontend/src/components/FloatingTools.jsx | ACTIVE, LEGACY-COMPAT | Floating FX tool used from shell; depends on API rates. |
| frontend/src/components/ConnectivityBadge.jsx | PATCHWORK, LEGACY-COMPAT | Duplicate connectivity polling to API root. |
| frontend/src/components/SessionGuardian.jsx | DEAD | Not mounted in current app tree; separate lock UX overlaps with MainLayout lock system. |
| frontend/src/components/GerenteApprovalPanel.jsx | ACTIVE in UI, LEGACY-COMPAT in backend coupling, DANGEROUS-TO-TOUCH | UI exists but depends on legacy websocket / approvals contracts that are not mounted. |
| frontend/src/components/ExecutiveAuditDashboard.jsx | ACTIVE in UI, LEGACY-COMPAT in backend coupling | UI exists but depends on report endpoints that do not match active mounted backend. |
| frontend/src/pages/LoginPage.jsx | ACTIVE, DANGEROUS-TO-TOUCH | PIN login, connectivity checks, kiosk shortcut, theme application, and backend auth contracts. |
| frontend/src/pages/AuthCallback.jsx | ACTIVE | Handles emergent auth callback flow. |
| frontend/src/pages/DashboardPage.jsx | ACTIVE | Main dashboard consuming live stats and rates. |
| frontend/src/pages/SalesPage.jsx | ACTIVE-BUT-MONOLITHIC, DANGEROUS-TO-TOUCH | Large sales workflow, draft orchestration, totals, approvals, print flows, customer/vehicle creation. |
| frontend/src/pages/QuotationsPage.jsx | ACTIVE-BUT-MONOLITHIC, DANGEROUS-TO-TOUCH | Large quotation workflow, draft orchestration, shared SaleForm contract, conversion to sale, totals. |
| frontend/src/pages/CashierPage.jsx | ACTIVE-BUT-MONOLITHIC, DANGEROUS-TO-TOUCH | Cash session, cash movements, invoice states, auth lock, totals, reports, and money handling. |
| frontend/src/pages/HumanResourcesPage.jsx | ACTIVE-BUT-MONOLITHIC, DANGEROUS-TO-TOUCH | Broad HR surface with timeclock, payroll, operations, audits, and personal data. |
| frontend/src/pages/SettingsPage.jsx | ACTIVE | Theme, appearance, vehicle settings, billing settings, draft cleanup. |
| frontend/src/pages/SystemSettingsPage.jsx | ACTIVE | Currency, push, and system-level settings. |
| frontend/src/pages/NotificationsPage.jsx | ACTIVE, DUPLICATED, PATCHWORK | Own tabbed UI but overlaps with followups/approvals and manages theme/sound prefs. |
| frontend/src/pages/ApprovalsPage.jsx | ACTIVE in UI, LEGACY-COMPAT in backend coupling | Simple approvals list with backend endpoints that are not mounted in current server. |
| frontend/src/pages/FollowupsPage.jsx | ACTIVE | Simple page, currently a placeholder but mounted. |
| frontend/src/pages/ReportsPage.jsx | ACTIVE, LEGACY-COMPAT | Mounted and usable, but report contract differs from legacy backend/api/v1/reports.py. |
| frontend/src/pages/HyperVisorPage.jsx | ACTIVE | Uses live backend hypervisor endpoints and is likely the current report/audit surface. |
| frontend/src/pages/PromotionsPage.jsx | ACTIVE | Promotions CRUD and filters. |
| frontend/src/pages/WarrantiesPage.jsx | ACTIVE | Warranty claims workflow. |
| frontend/src/pages/QualityControlPage.jsx | ACTIVE | Quality control workflow. |
| frontend/src/pages/TechnicianMobilePage.jsx | ACTIVE | Mobile technician UI. |
| frontend/src/pages/BranchesPage.jsx | ACTIVE | Branch admin UI. |
| frontend/src/pages/CustomersPage.jsx | ACTIVE-BUT-MONOLITHIC | Large customer management and WhatsApp/template orchestration. |
| frontend/src/pages/CatalogPage.jsx | ACTIVE-BUT-MONOLITHIC | Product/catalog search and draft bridge, complex state. |
| frontend/src/pages/InventoryPage.jsx | ACTIVE | Inventory surface (not fully expanded here, but mounted and used). |
| frontend/src/components/sales/SaleForm.jsx | ACTIVE-BUT-MONOLITHIC, DANGEROUS-TO-TOUCH | Large shared form used by sales and quotations; owns draft, totals, discounts, customer/vehicle flow, animations. |
| frontend/src/components/customers/CustomerVehicleFormTabs.jsx | ACTIVE | Shared customer/vehicle form piece. |
| frontend/src/lib/draftStorage.js | ACTIVE, PATCHWORK | Draft mirroring / scoring helpers used by sales and quotations. |
| frontend/src/lib/serverDrafts.js | ACTIVE, DANGEROUS-TO-TOUCH | Server-side draft CRUD contract. |
| frontend/src/lib/userUiPreferences.js | ACTIVE | Theme sound preferences contract. |
| frontend/src/lib/exchangeRate.js | ACTIVE | Currency rate helper used broadly. |
| frontend/src/lib/taxRate.js | ACTIVE | Tax rate helper used broadly. |
| frontend/src/lib/paymentMethods.js | ACTIVE | Discounts/payment contract helper. |
| frontend/src/lib/vehicleCatalog.js | ACTIVE | Vehicle selection contract helper. |
| frontend/src/lib/branding.js | ACTIVE | Brand-switching based on branch. |
| frontend/src/lib/utils.js | ACTIVE | Shared formatting and status helpers. |
| frontend/src/hooks/useDevice.js | ACTIVE | Responsive device detection. |
| frontend/src/hooks/use-toast.js | ACTIVE | Toast state helper. |
| frontend/src/lib/useRoles.js | ACTIVE, LEGACY-COMPAT | Role fetching helper; fallback cache. |

## High-Risk Buckets

### Dangerous-to-touch now
- backend/server.py
- frontend/src/context/AuthContext.js
- frontend/src/context/ThemeContext.js
- frontend/src/components/layout/MainLayout.jsx
- frontend/src/components/sales/SaleForm.jsx
- frontend/src/pages/SalesPage.jsx
- frontend/src/pages/QuotationsPage.jsx
- frontend/src/pages/CashierPage.jsx
- frontend/src/pages/LoginPage.jsx
- backend auth/session/approval/payment/inventory mutation surfaces

### Likely archive-candidates later
- backend/api/v1/auth.py
- backend/api/v1/approvals.py
- backend/api/v1/reports.py
- backend/api/v1/websockets.py
- backend/services/approval_service.py
- backend/scripts/e2e_quick_approval.py
- frontend/src/components/SessionGuardian.jsx
- frontend/src/components/ExecutiveAuditDashboard.jsx if replaced by HyperVisorPage
- backup artifacts like SaleForm.jsx.bak_2026-05-08_1540

### Safe-now opportunities only after validation
- duplicate connectivity polling
- duplicate draft helpers between sales and quotations
- repeated formatting and helper constants
- inactive debug-only instrumentation if confirmed unused

## Notes

- Unmounted does not mean safe to delete.
- Several frontend UI surfaces still encode contracts for unmounted backend endpoints.
- Draft and totals code is coupled through localStorage, server drafts, and autosave events.
- Visual-critical areas are intentionally kept in the dangerous-to-touch class for now.
