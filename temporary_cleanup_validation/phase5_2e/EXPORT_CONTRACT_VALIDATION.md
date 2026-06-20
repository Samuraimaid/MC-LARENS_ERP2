# EXPORT_CONTRACT_VALIDATION

Phase: 5.2E-E
Status: COMPLETE

## Contract Categories

### Critical Exports
Must remain stable and available:
- /api/backup/excel
- /api/backup/excel/import
- /api/print/invoice-pdf/{sale_id}
- /api/print/quotation-pdf/{quotation_id}
- /api/caja/cierre/{session_id}/excel
- /api/invoices/{sale_id}/retention-receipt
- /api/notifications/send-invoice/{sale_id}

### Optional/Format-driven Exports
Feature branches in existing endpoints:
- /api/inventory/movements/export
  - csv, excel, pdf
- /api/hr/attendance/reports/biweekly/export
  - csv, excel, pdf
- /api/reports/export/sales
  - csv, excel, pdf

## Startup Preload Requirement Matrix

- reportlab:
  - startup preload required: NO
  - execution-time required: YES (pdf branches)

- openpyxl:
  - startup preload required: NO
  - execution-time required: YES (excel branches)

- pandas:
  - startup preload required: NO
  - execution-time required: YES (excel shaping/export branches)

## Contract Preservation Check
- Endpoint names: unchanged
- Route prefixes: unchanged
- Payload contracts: unchanged
- Response media types: unchanged
- Routing registration: preserved (contract_smoke_routes.json shows no missing core/export required routes)

## Runtime-Core Independence Check
- Core route registration passes without startup loading export libraries.
- Export dependencies resolve in fullstack environment when export routes are exercised.

## Final Contract Decision
PASS

The export/report domain remains functionally available while runtime startup core is now isolated from export dependency preload.
