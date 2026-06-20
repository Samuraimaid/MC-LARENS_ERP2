# RUNTIME_ISOLATION_RETEST

Phase: 5.2E Retest
Status: PASS

## Mandatory Validation Checklist

1. runtime.txt clean-room import
- PASS
- Evidence: server_probe_cleanroom.json import_ok=true

2. backend.server startup
- PASS
- clean-room and full-stack both import backend.server.app successfully

3. login/auth smoke
- PASS (route registration)
- /api/auth/me, /api/auth/logout, /api/auth/session/lock, /api/auth/session/unlock present

4. drafts smoke
- PASS (route registration)
- /api/drafts/{flow} present

5. sales smoke
- PASS (route registration)
- /api/sales present

6. quotations smoke
- PASS (route registration)
- /api/quotations present

7. export PDF smoke
- PASS (dependency availability + route registration)
- reportlab available in fullstack (.venv)
- PDF routes registered

8. export Excel smoke
- PASS (dependency availability + route registration)
- pandas/openpyxl available in fullstack (.venv)
- Excel routes registered

9. Docker rebuild
- PASS
- Evidence: docker_rebuild.json build_ok=true, exit_code=0

10. route count parity
- PASS
- cleanroom route_count=230
- fullstack route_count=230
- both hashes equal
- hash matches phase 5.2D baseline

## Retest Evidence Summary
From runtime_isolation_retest.json:
- cleanroom_import_ok: true
- fullstack_import_ok: true
- cleanroom_route_count: 230
- fullstack_route_count: 230
- cleanroom_hash = fullstack_hash = 73588cf755302b4ca47a51c032caeaefa0918fa9cd6774bc6412bc532ee3ece5
- hashes_equal: true
- matches_phase52d_baseline: true

## Result
Runtime startup is isolated from export domain dependencies without route/contract regressions.
