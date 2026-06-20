# INTEGRATIONS DOMAIN INVENTORY

## Phase
- Phase 6B-A (Integration Inventory)
- Pattern source: PHASE_6A_EXTRACTION_PATTERN.md + DOMAIN_EXTRACTION_CHECKLIST.md

## Extraction Target
- Domain destination: backend/domains/integrations/
- Scope type: optional integrations, external providers, optional adapters, integration wrappers, external service connectors

## Inventory Map

### 1) Stripe (Optional external payment integration)
- Current runtime entrypoints:
  - backend/server.py
    - POST /api/payments/checkout
    - GET /api/payments/status/{session_id}
    - POST /api/webhook/stripe
- External dependency:
  - emergentintegrations.payments.stripe.checkout (optional import)
- Startup coupling risk:
  - Low (already lazy-imported inside route handlers)
- Extraction classification:
  - SAFE for wrapper-first extraction (provider wrapper + symbol loader)

### 2) SendGrid (Optional external email provider)
- Current runtime entrypoints:
  - backend/server.py
    - send_email_notification helper used by:
      - POST /api/notifications/send-invoice/{sale_id}
      - POST /api/alerts/send-low-stock
- External dependency:
  - sendgrid package + sendgrid.helpers.mail classes
- Startup coupling risk:
  - Low (import sendgrid occurs only when API key exists)
- Extraction classification:
  - SAFE for wrapper-first extraction (provider wrapper)

### 3) Telegram Webhook (Optional alert connector)
- Current runtime entrypoints:
  - backend/services/weekly_business_sentinel.py
    - send_executive_summary
    - weekly_business_sentinel scheduled workflow
  - backend/api/v1/auth.py imports send_executive_summary on failed PIN threshold
- External dependency:
  - HTTP webhook via requests.post
- Startup coupling risk:
  - Low for import, medium for auth overlap (must preserve function name in service layer)
- Extraction classification:
  - SAFE with compatibility wrapper in service (no auth flow changes)

## Integration-Specific Dependency Inventory
- Optional/external packages detected:
  - stripe==14.1.0 (requirements optional/runtime variants)
  - sendgrid==6.12.5
  - emergentintegrations (documented optional import path)
  - openai / s3transfer present in optional layer (not extracted in 6B-D)

## Startup/Lazy Loading Inventory
- Lazy loading already present and preserved:
  - Stripe symbols imported at runtime in integration wrapper
  - SendGrid imported only when key is present
  - Telegram uses runtime webhook call and env-based gating

## Explicitly Out of Scope in 6B
- auth core
- notifications core business rules
- sales logic
- approval logic
- session logic
- inventory mutations

## Implemented 6B Minimal Extraction Units
- backend/domains/integrations/stripe.py
- backend/domains/integrations/email.py
- backend/domains/integrations/telegram.py
- backend/domains/integrations/__init__.py

## Compatibility Wrappers Preserved
- backend/server.py
  - _get_stripe_checkout_symbols
  - _create_stripe_checkout
  - send_email_notification (delegation-only wrapper)
- backend/services/weekly_business_sentinel.py
  - send_executive_summary (delegation-only wrapper)
