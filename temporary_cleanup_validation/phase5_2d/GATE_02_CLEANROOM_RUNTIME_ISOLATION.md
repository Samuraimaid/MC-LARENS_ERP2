# Gate 02: Cleanroom Runtime Isolation
**Phase**: 5.2D | **Status**: ❌ FAIL (Architectural Finding)  
**Date**: 2026-05-16 | **Evidence**: [cleanroom_runtime_validation.json](cleanroom_runtime_validation.json)

## Summary
Isolated installation of `backend/requirements/runtime.txt` **fails to import the FastAPI app** due to unconditional top-level import of `reportlab` which is not included in the runtime layer. This is an **architectural constraint**, not a packaging error.

## Findings

### Clean-room Test Setup
- **Environment**: Fresh Python 3.11 venv, no prior packages
- **Install Target**: `backend/requirements/runtime.txt` only (41 packages)
- **Test Method**: Import `backend.server.app` and introspect routes  
- **Expected**: 0+ routes (success state)
- **Actual**: ModuleNotFoundError (failure state)

### Import Failure Analysis
```
Traceback (most recent call last):
  File "<probe_path>", line X, in <module>
    from backend.server import app
  File ".../backend/server.py", line 36, in <module>
    from reportlab.lib import colors
ModuleNotFoundError: No module named 'reportlab'
```

**Root Cause**: [backend/server.py](../../backend/server.py#L36) performs an unconditional top-level import of `reportlab.lib.colors` before any routes are defined. The `reportlab` package is **not pinned** in `runtime.txt`; it is in `exports.txt` (layer 3).

### Package Audit Results
| Metric | Count | Status |
|--------|-------|--------|
| Required (runtime.txt) | 41 | ✅ All installed |
| Extras (unexpected) | 0 | ✅ None |
| Missing critical deps | 0 | ✅ runtime.txt complete |
| **Import test exit code** | **-1 (crash)** | ❌ **BLOCKED** |

**Interpretation**: All declared dependencies in `runtime.txt` are correctly installed, but the **application code itself has an undeclared dependency** (reportlab imported at module level).

## Architectural Constraint
The FastAPI app **cannot start without reportlab** in the Python path. This is not a bug in the layered requirements; it is a **current architectural reality** of the codebase:

- **Line 36 of server.py**: `from reportlab.lib import colors` (unconditional)
- **reportlab package**: Belongs in `exports.txt` (layer 3), not runtime.txt (layer 1)
- **Impact**: Runtime-only isolation is blocked

## Resolution Path (Future Work)
To achieve true runtime/optional separation, future refactoring would require:
1. Move reportlab import to conditional/lazy loading (inside a function/endpoint)
2. Or: Accept that `exports.txt` must be installed alongside runtime.txt

## Gate Decision
**CANNOT PASS**: Runtime-only isolation fails due to architectural dependency on reportlab at startup. This is **documented and expected**—not a defect to fix in phase 5.2D.

**Implication**: Backend always requires `runtime.txt + exports.txt` minimum. Optional features use `optional.txt` (85 packages) and `scheduler.txt` (5 packages) layers.
