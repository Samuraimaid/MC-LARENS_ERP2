# RUNTIME_CONTRACTS

This document captures the implied runtime contracts discovered in Phase 2.

## Auth and Session

### Frontend expects
- `GET /api/auth/me`
- `GET /api/permissions/me`
- `POST /api/auth/login`
- `POST /api/auth/pin/login`
- `POST /api/auth/session`
- `POST /api/auth/logout`
- `POST /api/auth/session/lock`
- `POST /api/auth/session/unlock`

### Expected response semantics
- User identity, branch, and role information should be stable enough to drive layout, branding, and permissions.
- Theme mode and theme skin may be returned by login/session responses.
- PIN flows may return lockout metadata such as remaining attempts or lockout expiration.
- Session invalidation should be detectable as a 401 with invalid session semantics.

## Drafts

### Server-backed endpoints
- `GET /api/drafts/backup`
- `POST /api/drafts/backup`
- `GET /api/drafts/sale`
- `PUT /api/drafts/sale/{draftId}`
- `DELETE /api/drafts/sale/{draftId}`
- `PUT /api/drafts/sale/state`
- `GET /api/drafts/quotation`
- `PUT /api/drafts/quotation/{draftId}`
- `DELETE /api/drafts/quotation/{draftId}`
- `PUT /api/drafts/quotation/state`

### Draft snapshot contract
- selected customer id
- selected vehicle id and optional vehicle data
- selected warehouse
- cart items with quantity, unit price, discount, installation fields, and history fields
- payment method and mixed payment methods
- global discount mode and value
- notes
- IVA and retention flags and rates
- currency and exchange rate
- applied discounts
- customer/product search text
- new customer / new vehicle dialogs and partial data
- updatedAt timestamp

    ### Contract risk
    - The draft precedence rule depends on completeness scoring, so a poorer snapshot must not overwrite a richer one.

    ## Sales

    ### Expected payload fields
    - `customer_id`
    - `vehicle_id`
    - `warehouse_id`
    - `items`
    - `discount`
    - `payment_type`
    - `payment_method`
    - `mixed_payment_methods`
    - `credit_days`
    - `delivery_required`
    - `delivery_address`
    - `apply_iva`
    - `iva_rate`
    - `apply_retention`
    - `retention_rate`
    - `retention_amount`
    - `exchange_rate`
    - `currency`
    - `discount_codes`
    - `applied_discounts`
    - `total_amount`
    - `notes`

    ### Semantic rules
    - Discounts may be blocked by payment method.
    - Mixed payment must include at least one valid subpayment when selected.
    - Cashier and invoice workflows assume sale totals match backend validation.
    - Quote conversion to sale must preserve the business meaning of items, discounts, and vehicle linkage.

    ## Quotations

    ### Expected payload fields
    - same core sales fields minus sale-specific delivery or manager authorization concerns
    - `valid_days`
    - `notes`
- `currency`
- `exchange_rate`

### Semantic rules
- Quote validity is date-based and must be checked before conversion.
- Conversion to sale draft must preserve the original vehicle and customer context.
- Quote and sale draft flows are tightly coupled through shared form state.

## Cashier

### Expected endpoints
- `POST /api/caja/apertura`
- `POST /api/caja/cierre`
- `GET /api/caja/facturas`
- `POST /api/caja/facturas/{saleId}/cobrar`
- `POST /api/caja/facturas/{saleId}/anular`
- `POST /api/caja/movimiento`
- `POST /api/caja/arqueo/preview-fisico`
- `GET /api/caja/cierre/{sessionId}/reporte-gerencia`
- `GET /api/caja/cierre/{sessionId}/excel`

### Semantic rules
- Session must be opened before operational actions.
- Session lock prevents money operations and must be enforced both visually and logically.
- Denomination totals and physical preview must stay aligned.

## Theme and Appearance

### Expected storage keys
- `theme_mode`
- `theme_skin`
- `theme`
- `watermark_opacity`
- UI sound preference keys managed by userUiPreferences

### Semantic rules
- Theme changes should not leak between users during login.
- Branch-specific defaults may apply on auth/session load.
- Custom event `theme:sync` is part of the runtime contract.

## Notifications / Approvals / Reports

### Legacy contracts still implied by UI or scripts
- approval request and resolve payloads
- websocket-based gerencia updates
- audit summary and staff performance reports
- CSV exports for audit/report views

### Risk note
- These contracts are visible in the UI and codebase, but their backing runtime wiring is not fully active in the main server entry.

## Summary

- Runtime contracts are encoded in payload shapes, not only endpoint names.
- Draft and totals contracts are the most fragile because they combine localStorage, timers, and backend persistence.
- Visual and UX behavior is part of the runtime contract in this codebase, especially for login, sales, quotations, cashier, and theme flows.
