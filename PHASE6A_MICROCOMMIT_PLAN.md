# PHASE6A_MICROCOMMIT_PLAN

## Objective
Split Phase 6A into atomic, reviewable commits to support granular rollback and auditability.

## Atomic Commit Plan
1. create export domain folder
- Add `backend/domains/export/` package scaffold.
- Files:
  - `backend/domains/export/__init__.py`
  - `backend/domains/export/dependencies.py`
  - `backend/domains/export/pdf_documents.py`

2. add dependency wrappers
- Wire `backend/server.py` wrappers:
  - `_get_openpyxl_symbols`
  - `_get_reportlab_symbols`
- Delegate to domain dependency helpers.

3. add pdf helper delegation
- Wire `backend/server.py` wrappers:
  - `_build_retention_receipt_pdf_bytes`
  - `_load_logo_image`
  - `_draw_document_pdf`
- Delegate to domain PDF helpers.

4. add inventory export wrappers
- Update `backend/routes/inventory.py` local reportlab wrapper to delegate to domain dependency helper.

5. add HR export wrappers
- Update `backend/routes/human_resources.py` local reportlab wrapper to delegate to domain dependency helper.

6. parity validation artifacts
- Generate/commit:
  - `temporary_cleanup_validation/phase5_2e/server_probe_fullstack_post6a.json`
  - `temporary_cleanup_validation/phase5_2e/server_probe_cleanroom_post6a.json`
  - `temporary_cleanup_validation/phase5_2e/post6a_parity.json`
  - `temporary_cleanup_validation/phase5_2e/export_dep_smoke_post6a.json`

7. Docker parity validation
- Generate/commit:
  - `temporary_cleanup_validation/phase6a/docker_parity_post6a.json`

8. stabilization validation
- Generate/commit:
  - `temporary_cleanup_validation/phase6a/server_probe_fullstack_stab.json`
  - `temporary_cleanup_validation/phase6a/server_probe_cleanroom_stab.json`
  - `temporary_cleanup_validation/phase6a/stabilization_parity.json`
  - `temporary_cleanup_validation/phase6a/export_dep_smoke_stab.json`
  - `temporary_cleanup_validation/phase6a/export_runtime_smoke_stab.json`
  - `temporary_cleanup_validation/phase6a/contract_routes_stab.json`
  - `temporary_cleanup_validation/phase6a/docker_stabilization.json`
  - `temporary_cleanup_validation/phase6a/http_surface_probe.json`
  - `temporary_cleanup_validation/phase6a/frontend_drift_check.json`

## Commit Discipline
- One concern per commit.
- No mixed refactor + behavior changes.
- Run parity checks after each wiring commit.
- Block merge if parity evidence is missing.

## Rollback Mapping
- Revert latest failing commit first.
- Validate parity after each revert.
- Stop rollback once baseline parity is restored.
