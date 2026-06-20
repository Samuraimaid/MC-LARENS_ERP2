# EXPORT DOMAIN INVENTORY (Phase 6A)

## Objective
Extract export/report concerns into a dedicated domain module without changing runtime behavior, route contracts, or startup characteristics.

## Domain Scope
- Export dependency loaders (lazy):
  - openpyxl symbols loader
  - reportlab symbols loader
- PDF document helpers:
  - retention receipt PDF bytes generator
  - logo loading (data URI, HTTP(S), local path)
  - generic sales document PDF drawing

## New Module Structure
- `backend/domains/export/__init__.py`
- `backend/domains/export/dependencies.py`
- `backend/domains/export/pdf_documents.py`

## Endpoints In Scope (Registration/Behavior Preserved)
- Server export/report routes (existing in `backend/server.py`, unchanged path contracts)
- Inventory exports:
  - `/api/inventory/movements/export`
- HR exports:
  - `/api/human-resources/attendance/export`

## Extraction Mapping (Compatibility Wrappers)
- `backend/server.py`
  - `_get_openpyxl_symbols` -> delegates to `export_get_openpyxl_symbols`
  - `_get_reportlab_symbols` -> delegates to `export_get_reportlab_symbols`
  - `_build_retention_receipt_pdf_bytes` -> delegates to `export_build_retention_receipt_pdf_bytes`
  - `_load_logo_image` -> delegates to `export_load_logo_image`
  - `_draw_document_pdf` -> delegates to `export_draw_document_pdf`
- `backend/routes/inventory.py`
  - `_get_reportlab_symbols` now delegates to shared export dependency loader
- `backend/routes/human_resources.py`
  - `_get_reportlab_symbols` now delegates to shared export dependency loader

## Dependencies and Startup Boundary
- Export dependencies remain lazy-loaded at call-time.
- No new top-level import of heavy export libs required for app startup.
- Startup route graph/hash is preserved (validated in parity report).

## Non-Goals in 6A
- No route rename/repath.
- No payload/response shape changes.
- No global modularization outside export domain.
- No auth/role/middleware behavior changes.

## Evidence Pointers
- `temporary_cleanup_validation/phase5_2e/server_probe_fullstack_post6a.json`
- `temporary_cleanup_validation/phase5_2e/server_probe_cleanroom_post6a.json`
- `temporary_cleanup_validation/phase5_2e/post6a_parity.json`
- `temporary_cleanup_validation/phase5_2e/export_dep_smoke_post6a.json`
- `temporary_cleanup_validation/phase6a/docker_parity_post6a.json`
