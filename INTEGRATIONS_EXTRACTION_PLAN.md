# INTEGRATIONS EXTRACTION PLAN

## Phase
- Phase 6B-C (Safe Extraction Plan)
- Applied pattern: official 6A wrapper-first extraction

## Rules Enforced
- wrapper-first extraction
- delegation-only migration
- no destructive moves
- no global rewrites
- no route renaming
- no payload drift
- no response drift
- no startup drift

## Plan Structure

### Step 1: Create Integrations Domain Package (Non-destructive)
Create new module layer:
- backend/domains/integrations/stripe.py
- backend/domains/integrations/email.py
- backend/domains/integrations/telegram.py
- backend/domains/integrations/__init__.py

### Step 2: Preserve Compatibility Wrappers in Existing Surfaces
Keep public call points where they already exist:
- backend/server.py keeps route handlers and helper names.
- backend/services/weekly_business_sentinel.py keeps send_executive_summary symbol.

### Step 3: Delegation-only Wiring
- Stripe routes delegate provider creation/symbol loading to integrations domain.
- send_email_notification delegates to integrations domain email provider wrapper.
- weekly_business_sentinel.send_executive_summary delegates to integrations domain telegram wrapper.

### Step 4: Keep Protected Domains Untouched
No extraction in:
- auth core
- sales core
- drafts
- approvals
- session/auth internals
- inventory mutation logic

### Step 5: Preserve Docker & Recovery Compatibility
Must remain compatible with:
- Docker Containers/manifest/BACKUP_RECOVERY_GUIDE.md
- Docker Containers/manifest/backup_inventory.json
- docker-compose.yml
- docker-compose.frontend.yml

No changes allowed in:
- ports
- compose service names
- network topology
- mounts
- Mongo assumptions

### Step 6: Execute Full Parity Suite
Required checks:
- route parity
- route hash parity
- clean-room import parity
- Docker build parity
- integration runtime smoke
- circular import check
- frontend drift check
- HTTP surface check
- operational Docker parity (compose hash/startup/health/restart loops)

## Implemented 6B-D Minimal Safe Extraction
Executed exactly as planned:
- Optional adapters extracted
- Provider wrappers extracted
- External service helpers extracted
- Integration-specific utilities extracted

## GO/NO-GO Gate
- GO only if all mandatory validations PASS.
- NO-GO if any contract drift, startup drift, route drift, Docker drift, or rollback gap.
