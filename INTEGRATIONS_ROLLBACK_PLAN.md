# INTEGRATIONS ROLLBACK PLAN

## Scope
Rollback only Phase 6B integration extraction changes.

## Rollback Objectives
- restore pre-6B delegation paths if needed
- preserve route map and runtime contracts
- preserve Docker/compose recoverability
- avoid touching protected domains

## Rollback Cut Line (6B Files)

### New files introduced in 6B
- backend/domains/integrations/__init__.py
- backend/domains/integrations/stripe.py
- backend/domains/integrations/email.py
- backend/domains/integrations/telegram.py

### Existing files modified in 6B
- backend/server.py
- backend/services/weekly_business_sentinel.py

## Atomic Rollback Sequence

1. Revert delegation wiring in backend/server.py
- restore direct Stripe import blocks in:
  - /api/payments/checkout
  - /api/payments/status/{session_id}
  - /api/webhook/stripe
- restore original send_email_notification implementation body

2. Revert delegation wiring in backend/services/weekly_business_sentinel.py
- restore original send_executive_summary webhook implementation body

3. Remove integration domain package files
- remove backend/domains/integrations/*

4. Re-run mandatory parity suite
- route parity/hash
- clean-room import
- Docker build
- integration smoke (legacy path)
- circular import check
- frontend drift check
- operational Docker parity check

## Emergency Fast Rollback (Git)
If using git rollback for Phase 6B only:
- revert commit set corresponding to 6B extraction
- do not touch unrelated 6A or backup artifacts

## Rollback Acceptance Criteria
- route hash returns to approved baseline:
  - 73588cf755302b4ca47a51c032caeaefa0918fa9cd6774bc6412bc532ee3ece5
- required routes still registered
- backend and clean-room import PASS
- docker build PASS
- compose parity vs backup snapshot PASS
- frontend drift unchanged from pre-6B state

## Explicit Non-Targets During Rollback
Do not modify:
- Sales Core
- Drafts
- Cashier
- Approvals
- Sessions/Auth core
- Inventory mutations
- docker-compose.yml / docker-compose.frontend.yml contract surface

## Recovery Compatibility Guard
Rollback must remain compatible with:
- Docker Containers/manifest/BACKUP_RECOVERY_GUIDE.md
- Docker Containers/manifest/backup_inventory.json
- existing compose startup/recovery workflows

## Rollback Verdict Rule
- If any parity gate fails after rollback attempt: stop and escalate.
- If all gates pass: rollback complete and system restored.
