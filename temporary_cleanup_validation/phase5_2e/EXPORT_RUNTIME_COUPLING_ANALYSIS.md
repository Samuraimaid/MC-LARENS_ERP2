# EXPORT_RUNTIME_COUPLING_ANALYSIS

Phase: 5.2E-C / 5.2E-D
Status: COMPLETE

## Problem Statement
Phase 5.2D identified startup coupling where export/report dependencies were imported during backend startup.

Coupling risks:
- runtime.txt clean-room startup failed if export libs were absent.
- core runtime domains were blocked by non-core dependencies.

## Coupling Sources Found
1. backend/server.py top-level imports (reportlab/openpyxl).
2. backend/routes/inventory.py top-level imports (pandas/reportlab).
3. backend/routes/human_resources.py top-level imports (pandas/reportlab).
4. timezone init sensitivity in HR router when tzdata is missing.

## Coupling Classification
- startup-time coupling:
  - module top-level imports
  - router factory initialization constants
- execution-time coupling:
  - export endpoints with format=excel/pdf

## 5.2E Minimal Isolation Applied
- Replaced top-level export imports with lazy getters.
- Preserved route definitions and endpoint names.
- Preserved request/response contracts.
- Added timezone fallback in HR router to avoid startup failure without tzdata.

## Validation Evidence
From phase5_2e artifacts:
- server_probe_cleanroom.json:
  - import_ok = true
  - route_count = 230
  - route_hash = 73588cf755302b4ca47a51c032caeaefa0918fa9cd6774bc6412bc532ee3ece5
- server_probe_fullstack.json:
  - import_ok = true
  - route_count = 230
  - same hash as cleanroom
- runtime_isolation_retest.json:
  - hashes_equal = true
  - matches_phase52d_baseline = true
- contract_smoke_routes.json:
  - core_smoke_pass = true
  - export_route_registration_pass = true

## Runtime Core Protection Result
The following domains remain startup-safe and route-stable without requiring export libs at import time:
- auth/session
- drafts
- sales
- quotations
- cashier
- approvals

## Conclusion
Startup coupling between runtime core and export domain has been isolated with minimal, contract-safe changes.
