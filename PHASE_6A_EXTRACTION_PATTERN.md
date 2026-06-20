# PHASE 6A EXTRACTION PATTERN

## Purpose
This document formalizes the official ERP extraction pattern validated in Phase 6A.

## Scope
- Reference extraction: Export domain.
- Objective: isolate domain logic without changing runtime contracts.
- Constraint: preserve startup behavior, route graph, and frontend behavior.

## 1) Wrapper Strategy
- Keep historical helper names at original call sites.
- Convert old helpers into thin compatibility wrappers.
- Delegate wrappers to domain module functions.
- Preserve module-level imports expected by current runtime code.

### Phase 6A blueprint
- `backend/server.py` keeps:
  - `_get_openpyxl_symbols`
  - `_get_reportlab_symbols`
  - `_build_retention_receipt_pdf_bytes`
  - `_load_logo_image`
  - `_draw_document_pdf`
- These wrappers delegate to:
  - `backend/domains/export/dependencies.py`
  - `backend/domains/export/pdf_documents.py`

## 2) Delegation Strategy
- Extract implementation first, keep contracts where they already live.
- Do not move route handlers while extracting helper logic.
- Keep route registration untouched in `backend.server.app`.
- Keep endpoint paths unchanged.
- Migrate one helper at a time, then re-run parity checks.

### Delegation sequence used in 6A
1. Create domain package and extracted helper implementations.
2. Redirect server helper wrappers to domain helpers.
3. Redirect route-local export dependency wrappers to shared domain dependencies.
4. Re-run startup and route parity checks.

## 3) Lazy Import Strategy
- Keep export libs lazy to avoid startup coupling.
- Restrict heavy imports to execution-time helper calls.
- On missing optional dependencies, return explicit HTTP 503 semantics.

### Phase 6A lazy boundary
- `get_openpyxl_symbols()` lazy-loads openpyxl.
- `get_reportlab_symbols()` lazy-loads reportlab.
- Startup import of `backend.server.app` succeeds without forcing export libs at module import boundaries.

## 4) Clean-Room Validation Strategy
- Validate in both full and runtime-only environments.
- Compare route count and route hash.
- Validate required core/export route presence.
- Validate Docker rebuild.
- Validate export dependency smoke and runtime helper smoke.

### Minimum evidence set
- full-stack probe json
- clean-room probe json
- parity json (hash and count)
- export dependency smoke json
- export runtime smoke json
- Docker status json

## 5) Rollback Strategy
- Rollback must be granular and reversible.
- Keep wrappers in place so rollback is mostly delegation reversal.

### Rollback procedure
1. Revert wrapper delegation commits (domain wiring only).
2. Restore previous helper implementations in original module.
3. Keep route registration untouched.
4. Re-run parity suite to confirm baseline restoration.

### Rollback acceptance
- Route hash matches approved baseline.
- Required core and export routes remain registered.
- Startup import still passes in clean-room.
- Docker build passes.

## 6) Safe Domain Extraction Rules (Mandatory)
- no route renaming
- no payload drift
- no response drift
- no startup drift
- no frontend contract drift
- no destructive moves
- no global rewrites

## Enforcement
Any extraction that fails one mandatory rule is blocked until parity evidence is restored.
