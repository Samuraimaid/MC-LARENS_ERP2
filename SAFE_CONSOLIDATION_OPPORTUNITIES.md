# SAFE CONSOLIDATION OPPORTUNITIES

Phase 2 discovery of low-risk opportunities only. These are not implementation instructions.

## SAFE NOW

These are the smallest candidates that appear structurally safe once validated in a later phase:

1. Duplicate connectivity polling helpers.
- MainLayout checks API connectivity for seller status.
- LoginPage checks backend connectivity.
- ConnectivityBadge checks the same API root again.
- Safe later: one consolidated connectivity helper and one shared status hook.

2. Repeated draft scoring and completeness helpers.
- Logic exists in AuthContext, draftStorage, SalesPage, and QuotationsPage.
- Safe later: extract a shared scoring helper so draft precedence is consistent.

3. Repeated payment method normalization.
- normalizePaymentMethodCode and normalizePaymentMethodList are already shared, but pages still repeat contract logic around discounts and mixed payment behavior.
- Safe later: centralize the rules, not the UI.

4. Repeated vehicle label / thumbnail helpers.
- SalesPage and QuotationsPage both compute vehicle labels, preview cards, and thumbnails.
- Safe later: shared read-only formatter/helper module.

5. Repeated formatting helpers.
- Currency, date, phone, cedula, RUC, chassis, and plate formatting are repeated across SaleForm, SalesPage, QuotationsPage, CustomersPage, and CustomerVehicleFormTabs.
- Safe later: unify shared formatting helpers where a single source already exists.

6. Duplicate localStorage visibility keys for embedded sale/quote forms.
- Sales and quotations each store show/hide state separately but in a very similar pattern.
- Safe later: unify key naming conventions and persistence helper.

7. Repeated autosave status event usage.
- Sales and quotations both emit AUTOSAVE_STATUS events.
- Safe later: shared autosave status hook or adapter.

8. Duplicate theme/sound preference sync paths.
- AuthContext, ThemeContext, NotificationsPage, and userUiPreferences all participate.
- Safe later: merge the sound preference persistence logic behind one contract.

## SAFE LATER

These are promising, but only after the normalization blueprint and runtime contract validation:

- Split read-only helpers from large feature pages.
- Extract pure calculation helpers from SaleForm and the page shells.
- Consolidate product/vehicle preview builders.
- Consolidate customer/vehicle card pattern constants.
- Consolidate API root health checks into a single shared hook.
- Consolidate draft server sync wrapper and localStorage mirror policy.
- Consolidate action label / status label maps.

## DANGEROUS FOR NOW

Do not touch these yet even if they look repetitive:

- Sales totals and discounts.
- Quotations totals and conversion logic.
- Cashier balances, denominations, and session state.
- Auth and session lock flows.
- Draft sync/restore order.
- Theme and branding initial load.
- Approval and websocket legacy contracts.
- Inventory mutations and stock availability calculations.

## Why these are safe-only-later

- They are cross-cutting and often feed visible UI behavior.
- Many are entangled with localStorage side effects or timer-driven state updates.
- A "simple cleanup" here can produce a silent runtime contract break.
- The safest path is to extract only after the contract map is frozen.
