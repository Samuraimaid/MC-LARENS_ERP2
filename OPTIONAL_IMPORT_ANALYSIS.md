# PHASE 5.2C - OPTIONAL IMPORT ANALYSIS

## Objective
Identify imports that should be treated as optional, lazy, or feature-flagged, without changing code yet.

## Evidence
- backend/server.py
- temporary_cleanup_validation/phase5_2c/dependency_ownership_trace.json
- temporary_cleanup_validation/phase5_2c/optional_import_candidates.json

## Confirmed optional runtime import pattern
1. emergentintegrations is imported inside endpoint functions, not at top-level startup.
2. Endpoint scope observed: payments checkout and stripe webhook flows.
3. Current behavior on missing integration: explicit HTTP 501 response.

## Imports that should not be startup-loaded (classification finding)
1. reportlab currently imported at module level in backend/server.py and route modules.
2. openpyxl currently imported at module level in backend/server.py.
3. pandas imported in export/report related routes.

These are export/report oriented and should be considered for lazy loading in future implementation phase.

## Optional import candidate groups

### Integration candidates
- emergentintegrations
- openai
- google-genai
- google-generativeai
- google-ai-generativelanguage
- litellm
- stripe
- boto3
- botocore
- huggingface-hub
- tiktoken
- tokenizers

### Scheduler candidate
- apscheduler

### Export/report candidates for deferred load
- pandas
- openpyxl
- reportlab

## Required future safeguards (design only, no implementation in this phase)
1. Feature flags for each optional integration family.
2. Lazy import at function boundary for non-core paths.
3. Explicit fallback error contracts consistent with runtime contracts.
4. Startup path isolation so core auth, sessions, sales, quotations, cashier, approvals do not require optional stacks.

## Current status
1. Classification complete.
2. No import wrapping changes made.
3. No runtime behavior changed.
