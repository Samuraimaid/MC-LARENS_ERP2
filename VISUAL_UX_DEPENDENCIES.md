# VISUAL_UX_DEPENDENCIES

This document maps the visual and UX coupling that must be preserved during any later consolidation.

## Global UX dependencies

- Theme mode, skin, and watermark opacity are global and user-visible.
- Brand and favicon vary by branch and are updated in the main shell.
- Toaster placement and alert tone affect operational confidence.
- Mobile navigation changes based on viewport width and role.
- Session lock overlays intentionally blur and disable content.

## LoginPage

### Visual dependencies
- Full-screen split layout with decorative left panel.
- Digital clock and motivational message on desktop.
- Calculator and calendar side tools.
- PIN keypad with animated error/success state.
- Device information panel that expands for diagnostics.
- Watermark opacity from theme context.

### UX dependencies
- Keyboard capture for digits, backspace, and enter.
- Numpad normalization.
- Kiosk shortcut PIN path.
- Backend connectivity indicator and polling.
- Fresh session reset flow through `?fresh=1`.

## MainLayout

### Visual dependencies
- Sticky header with branch branding, user identity, role, and build info.
- Workbench tab strip on desktop.
- Bottom navigation on phone.
- Watermark logo fixed in the content area.
- Autosave / connectivity icon changes by role and status.
- Session lock overlay with color tone based on tamper state.

### UX dependencies
- Responsive sidebar collapse / mobile drawer behavior.
- Session lock and unlock pin flow.
- Browser history tamper resistance while locked.
- Connectivity polling for seller status.
- Logout routing and clear session state.

## SaleForm

### Visual dependencies
- Multi-step form with scroll and auto-focus behaviors.
- Customer/vehicle cards with tone changes based on company flow and selected vehicle state.
- Cart transfer animation from catalog result to cart section.
- Long-press product breakdown on touch devices.
- Price editor modal and cart flash feedback.
- Sound cues for cart and undo actions.
- Draft persistence and restoration surface visible in form state.

### UX dependencies
- Customer search and keyboard navigation.
- Product search and keyboard navigation.
- Vehicle flow selection between carryout, registered, and new vehicle.
- VIN decode actions for customer and vehicle creation.
- Discount code application and payment method gating.
- Installation toggles and stock availability tone.

## SalesPage

### Visual dependencies
- Card-based draft board and created-sales board.
- Embedded SaleForm visibility toggle.
- Draft preview images, vehicle labels, and totals.
- Print and WhatsApp share actions.
- Tabs and responsive board switching.
- Modal confirmation for clearing embedded form.

### UX dependencies
- Draft tabs must persist and restore across reloads.
- Embedded form visibility state is user-scoped.
- Conversion to catalog opens from the current draft snapshot.
- Customer and vehicle creation must refresh the list without losing the draft.
- Sale creation may trigger authorization or printing behavior.

## QuotationsPage

### Visual dependencies
- Same embedded SaleForm contract as SalesPage but in quotation tone.
- Draft cards with vehicle thumbnails and totals.
- Quote status badges and validity countdown labels.
- Toggle between drafts and created quotes on narrow screens.
- Conversion buttons for sale draft and sale invoice.

### UX dependencies
- Quote draft persistence must be consistent with SalesPage draft behavior.
- Quote validity must block conversion after expiry.
- Quote to sale draft conversion must preserve customer, vehicle, and cart context.
- Auto-save and server sync status must remain visible and trustworthy.

## CashierPage

### Visual dependencies
- Distinct tone by active tab and open session state.
- Cash denomination grids for opening, movement, and preview flows.
- Floating physical preview panel with drag behavior.
- Session lock overlay that visually blocks the page.
- Operation cards for open, close, collect, cancel, movement, and reports.

### UX dependencies
- Session must be opened before transactions.
- Lock state must disable collection and movement.
- Invoice tabs must remain readable and responsive.
- Preview panel position is draggable and persists during the current session only.
- Mixed payment UI must stay synchronized with authorization requirements.

## ThemeContext and AuthContext

### Visual dependencies
- Auth changes may update theme, skin, and sound preferences.
- Theme changes should not leak visually between users.
- Draft backup / restore runs silently but affects visible form state.
- Sound and theme sync events are part of the user experience even though they are not obvious in the UI.

## High-risk visual coupling areas

- Sales and quotations share the most fragile visual contract with SaleForm.
- Login and MainLayout share session, theme, and connectivity behavior that affects first impression and recovery flows.
- Cashier is visually complex and financially sensitive, so any change there can look minor but still break workflow.
- Notifications / approvals / reports are visually split across multiple pages, but their backend contracts are not equally alive.

## Preservation rule

- Any future consolidation should preserve exact visual sequencing, responsive breakpoints, animation timing, and lock/autosave feedback in these areas.
- A structural cleanup is only safe if the user-facing state machine remains identical.
