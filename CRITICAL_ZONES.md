# CRITICAL_ZONES

Phase 2 risk matrix for areas that should not be touched casually. This is a discovery document only.

| Zona | Riesgo | Razón | Impacto | Nivel |
|------|--------|--------|---------|--------|
| backend/server.py auth | High | Inline auth/session logic is the live entry point for login, permissions, and session invalidation. | Breaks login, session persistence, and access control. | CRITICAL |
| backend/server.py drafts backup | High | Draft backup endpoints are directly coupled to frontend autosave recovery. | Sales and quotations draft recovery can silently fail. | CRITICAL |
| backend/server.py middleware chain | High | CORS and static mounting are established at startup and affect app bootstrapping. | App may stop loading or lose browser access. | CRITICAL |
| backend/routes/inventory.py | High | Inventory mutations and read models are shared by sales, quotations, and warehouse flows. | Stock counts and availability can become inconsistent. | HIGH |
| backend/routes/human_resources.py | High | HR data, attendance, payroll, and audits are mixed in a large mounted router. | Employee workflows and audit trails can break. | HIGH |
| backend/api/v1/approvals.py | High | Legacy approval flow depends on websocket delivery and approval service semantics. | Manager approval workflows and notifications fail if reactivated incorrectly. | HIGH |
| backend/api/v1/websockets.py | High | WebSocket lifecycle and role gating are tightly coupled to frontend assumptions. | Real-time alerts and approval notifications are lost. | HIGH |
| backend/api/v1/reports.py | Medium-High | Legacy report endpoints overlap with current reporting UI and collections. | Conflicting reports or dead UI links. | HIGH |
| frontend/src/context/AuthContext.js | High | Controls auth checks, logout, permission cache, theme sync, and draft sync. | Session invalidation or draft recovery can break across the app. | CRITICAL |
| frontend/src/context/ThemeContext.js | High | Controls global theme, skin, watermark, and storage synchronization. | Visual bleed, user theme cross-contamination, and branding regressions. | CRITICAL |
| frontend/src/components/layout/MainLayout.jsx | High | Central shell manages session lock, device responsiveness, autosave status, and navigation. | App shell can become unusable or visually inconsistent. | CRITICAL |
| frontend/src/pages/LoginPage.jsx | High | PIN login has keyboard capture, connectivity polling, and theme application. | Users may be locked out or see incorrect login behavior. | CRITICAL |
| frontend/src/components/sales/SaleForm.jsx | High | Shared form powers sales and quotations, with totals, customer/vehicle flows, and drafts. | Wrong totals, broken cart flow, or UI regressions. | CRITICAL |
| frontend/src/pages/SalesPage.jsx | High | Uses SaleForm and owns draft orchestration, payload contract, and print/approval flows. | Sales creation, conversion, and invoice flows can break. | CRITICAL |
| frontend/src/pages/QuotationsPage.jsx | High | Shares SaleForm and draft model with sales, plus conversion to sale. | Quote-to-sale conversion and quote totals can break. | CRITICAL |
| frontend/src/pages/CashierPage.jsx | High | Money handling, session lock, invoice states, and cash movements. | Financial control and cash management can break. | CRITICAL |
| frontend/src/pages/NotificationsPage.jsx | Medium-High | Embeds followups, approvals, preferences, and theme/sound persistence. | Notification UX or preference persistence may regress. | HIGH |
| frontend/src/components/GerenteApprovalPanel.jsx | High | Depends on unmounted websocket and approval resolve contracts. | Manager approval UI can appear live but fail at runtime. | HIGH |
| frontend/src/components/ExecutiveAuditDashboard.jsx | Medium-High | Report UI depends on endpoints that do not match active backend wiring. | Audit/report data may be stale or unavailable. | HIGH |
| frontend/src/pages/HyperVisorPage.jsx | Medium | Strong operational audit tool, but depends on specialized hypervisor endpoints and filters. | Reporting and audit visibility could degrade. | HIGH |
| frontend/src/lib/serverDrafts.js | High | Drafts are persisted through server endpoints; this is the source of truth for flow sync. | Silent data loss or duplication if changed incorrectly. | CRITICAL |
| frontend/src/lib/draftStorage.js | Medium-High | Local draft scoring and mirror logic is part of recovery semantics. | Wrong draft precedence could overwrite newer data. | HIGH |
| frontend/src/lib/userUiPreferences.js | Medium-High | Theme sound prefs are synchronized across UI and backend settings. | User-facing sounds or appearance preferences can drift. | HIGH |
| frontend/src/components/layout/KDSLayout.jsx | Medium-High | Theme API usage appears partially mismatched and touches special fullscreen routes. | KDS/attendance display or navigation can degrade. | HIGH |
| frontend/src/index.js axios interceptors | Medium-High | Global logging and error instrumentation are active side effects at bootstrap. | Debugging changes can create noisy or recursive effects. | HIGH |
| frontend/src/pages/PromotionsPage.jsx | Medium | Uses CRUD and validation flows but is not a central system primitive. | Limited to promotions management. | MEDIUM |
| frontend/src/pages/WarrantiesPage.jsx | Medium | Warranty workflow depends on backend collections and filters but is isolated. | Localized workflow regressions. | MEDIUM |
| frontend/src/pages/QualityControlPage.jsx | Medium | QC flow touches task data and rating payloads, but not core accounting. | Localized workflow regressions. | MEDIUM |
| frontend/src/pages/CustomersPage.jsx | Medium-High | Customer CRUD and WhatsApp template UX are broad and stateful. | Customer management UX could degrade. | HIGH |
| frontend/src/pages/CatalogPage.jsx | Medium-High | Catalog and draft handoff logic interacts with sales/quotations. | Draft handoff and catalog flow can break. | HIGH |
| frontend/src/pages/SettingsPage.jsx | Medium-High | Can clear drafts, update theme, and mutate billing/vehicle settings. | Can impact global appearance and configuration. | HIGH |
| frontend/src/pages/SystemSettingsPage.jsx | Medium-High | Currency/push configuration affects system-wide behavior. | Can affect notification and currency behavior. | HIGH |
| frontend/src/pages/ReportsPage.jsx | Medium | Reporting UI is mounted and operational but not core transaction flow. | Reporting UX only, unless it is used operationally. | MEDIUM |
| frontend/src/components/ConnectivityBadge.jsx | Medium | Duplicate connectivity polling is redundant but not business-critical. | Noise, extra API calls, and possible UX confusion. | MEDIUM |
| frontend/src/components/SessionGuardian.jsx | Medium | Not mounted now, but duplicate lock UX could conflict if reintroduced. | Conflict with main lock system. | MEDIUM |

## Critical zone interpretation

- Zones marked CRITICAL are sensitive enough that even non-functional edits can create hidden regressions.
- The biggest runtime risk is not just the file size; it is the number of implicit contracts around storage, timers, and totals.
- Unmounted legacy endpoints should be treated as dangerous-to-touch because UI and scripts may still be waiting on them.
- Visual-critical files are included here because the user explicitly requires zero UX regression during normalization.
