# STARTUP_IMPORT_TRACE

Phase: 5.2E-A
Status: COMPLETE

## Scope
Trace startup-time vs execution-time dependencies for:
- reportlab
- openpyxl
- pandas

## Direct Import Trace

### backend/server.py
- Startup-time (before 5.2E):
  - reportlab symbols imported at module load.
  - openpyxl symbols imported at module load.
- Startup-time (after 5.2E):
  - export libs are loaded through lazy loaders only:
    - _get_reportlab_symbols()
    - _get_openpyxl_symbols()
  - no top-level reportlab/openpyxl import remains.

Execution-time usage in server:
- Excel backup/export/import:
  - /api/backup/excel
  - /api/backup/excel/import
  - /api/caja/cierre/{session_id}/excel
- PDF generation:
  - /api/print/invoice-pdf/{sale_id}
  - /api/print/quotation-pdf/{quotation_id}
  - /api/invoices/{sale_id}/retention-receipt
  - /api/notifications/send-invoice/{sale_id}
  - /api/reports/export/sales?format=pdf

### backend/routes/inventory.py
- Startup-time (before 5.2E):
  - pandas/reportlab imported at module load.
- Startup-time (after 5.2E):
  - lazy loaders:
    - _get_pandas()
    - _get_reportlab_symbols()
- Execution-time dependency:
  - /api/inventory/movements/export
    - excel branch uses pandas/openpyxl
    - pdf branch uses reportlab

### backend/routes/human_resources.py
- Startup-time (before 5.2E):
  - pandas/reportlab imported at module load.
  - ZoneInfo("America/Managua") created at router factory initialization.
- Startup-time (after 5.2E):
  - lazy loaders:
    - _get_pandas()
    - _get_reportlab_symbols()
  - timezone fallback added if tzdata is absent.
- Execution-time dependency:
  - /api/hr/attendance/reports/biweekly/export
    - excel branch uses pandas/openpyxl
    - pdf branch uses reportlab

## Indirect Import Chain

Critical startup chain in server registration:
- backend.server imports route factories
- backend.server builds routers and includes them at startup
- any top-level import inside route modules becomes startup dependency

5.2E removed export libs from that startup chain by moving them to function-level lazy boundaries.

## Result
- runtime startup no longer requires reportlab/openpyxl/pandas.
- export/report features still resolve dependencies at execution time.
