# EXPORT_DOMAIN_BOUNDARY_MAP

Phase: 5.2E-B
Status: COMPLETE

## Boundary Definition
Export domain = endpoints/utilities that require one or more of:
- reportlab
- openpyxl
- pandas

Runtime core = auth/session/drafts/sales/quotations/cashier/approvals startup and route registration, without export libs.

## Export Endpoints (Server)
- /api/backup/excel
- /api/backup/excel/import
- /api/caja/cierre/{session_id}/excel
- /api/print/invoice-pdf/{sale_id}
- /api/print/quotation-pdf/{quotation_id}
- /api/invoices/{sale_id}/retention-receipt
- /api/notifications/send-invoice/{sale_id}
- /api/reports/export/sales (excel/pdf variants)

## Export Endpoints (Inventory Router)
- /api/inventory/movements/export
  - csv: no export libs required
  - excel: pandas + openpyxl
  - pdf: reportlab

## Export Endpoints (Human Resources Router)
- /api/hr/attendance/reports/biweekly/export
  - csv: no export libs required
  - excel: pandas + openpyxl
  - pdf: reportlab

## Shared Export Helpers
Server-side helpers that are export-domain only:
- _get_openpyxl_symbols()
- _get_reportlab_symbols()
- _draw_document_pdf(...)
- _load_logo_image(...)
- _build_retention_receipt_pdf_bytes(...)

Router-local helpers:
- inventory._get_pandas()
- inventory._get_reportlab_symbols()
- human_resources._get_pandas()
- human_resources._get_reportlab_symbols()

## Runtime Core Endpoints (Protected)
Validated as independent from export startup deps:
- /api/auth/me
- /api/auth/logout
- /api/auth/session/lock
- /api/auth/session/unlock
- /api/drafts/{flow}
- /api/sales
- /api/quotations
- /api/caja/facturas
- /api/approvals

## Boundary Decision
- Keep endpoint contracts unchanged.
- Keep route registration unchanged.
- Move heavy import requirements to execution boundaries only.
