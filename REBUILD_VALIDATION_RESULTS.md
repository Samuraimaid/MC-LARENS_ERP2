# REBUILD VALIDATION RESULTS

## Scope
Validation of clean dependency regeneration behavior for frontend/backend with temporary dependency move only.

## Evidence Sources
- `temporary_cleanup_validation/move_manifest.json`
- `temporary_cleanup_validation/regeneration_validation_results.json`
- `temporary_cleanup_validation/storage_diff_data.json`

## Validation Matrix
| Check | Result | Evidence |
|---|---|---|
| Dependencies moved to temporary backup (not deleted) | PASS | `move_manifest.json` |
| Frontend install from zero dependency state | PASS | `regeneration_validation_results.json` (`frontend.status=pass`) |
| Frontend production build from regenerated deps | PASS | `regeneration_validation_results.json` + build output logs |
| Backend venv recreation | FAIL | `regeneration_validation_results.json` (`backend.status=failed`) |
| Backend dependency install + import probe | FAIL | `regeneration_validation_results.json` + baseline probe errors |
| Docker full rebuild after move/regeneration | PASS | `regeneration_validation_results.json` (`docker.status=pass`) |
| Lock/integrity drift check execution | PASS (executed) | `regeneration_validation_results.json` (`integrity.status=checked`) |
| Fully regenerable criterion | FAIL | `fullyRegenerable=false` |

## Timings (seconds)
From `regeneration_validation_results.json`:
- Frontend: 36.67
- Backend: 1.64 (failed flow)
- Docker rebuild: 127.90

## Gate Status
HALTED - NOT APPROVED FOR NEXT CLEANUP STEP

## Why Halted
The backend regeneration path is not stable/complete, therefore full project regeneration from zero cannot be certified.
