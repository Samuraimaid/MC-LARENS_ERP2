# SAFE_EXPORT_ISOLATION_PLAN

Phase: 5.2E-C / 5.2E-F
Status: APPLIED (Minimal)

## Constraints Honored
- No massive refactor.
- No route migration.
- No endpoint rename.
- No payload/response contract changes.
- No UX changes.

## Isolation Strategy

### 1) Lazy Import Boundaries
- server export libs moved to lazy loaders:
  - _get_openpyxl_symbols()
  - _get_reportlab_symbols()
- inventory/hr export libs moved to local lazy loaders.

### 2) Route-level Deferred Loading
- For excel/pdf branches, dependencies are resolved only when route branch is executed.
- csv and core paths remain independent from export libs.

### 3) Startup-safe Loading
- route modules are importable under runtime-only environment.
- HR router now has timezone fallback when zone database is unavailable.

## Minimal Implementation Diff (Conceptual)
- backend/server.py
  - removed top-level reportlab/openpyxl imports
  - added lazy helper functions
  - updated export PDF/Excel call sites to resolve symbols at execution-time
- backend/routes/inventory.py
  - removed top-level pandas/reportlab imports
  - added _get_pandas and _get_reportlab_symbols helpers
- backend/routes/human_resources.py
  - removed top-level pandas/reportlab imports
  - added lazy helpers
  - added timezone fallback for startup resilience

## Fallback Behavior
If export dependencies are missing during an export request:
- endpoint raises HTTP 503 with explicit dependency message.
- startup is not blocked.

## Why This Is Safe
- core route registration unchanged
- export routes remain present
- export functionality preserved when deps are installed
- deterministic route hash preserved
