# STORAGE REGENERATION DIFF

## Evidence Source
- `temporary_cleanup_validation/storage_diff_data.json`

## Backup Preservation
- Backup folder: `temporary_cleanup_validation/dependency_backup_20260516_095855`
- Backup size: 241.44 MB

## Baseline vs Current (MB)
| Path | Baseline | Current | Delta |
|---|---:|---:|---:|
| `frontend/node_modules` | 223.49 | 214.41 | -9.08 |
| `.venv` | 8.01 | 179.23 | +171.22 |
| `backend/.venv` | 0.00 | 0.00 | 0.00 |
| `node_modules` | 7.96 | 0.00 | -7.96 |

## Totals
- Total baseline dependency footprint: 239.46 MB
- Total current dependency footprint: 393.64 MB
- Net delta: +154.18 MB

## Interpretation
Current workspace dependency footprint increased due to partial/expanded backend venv state while root `node_modules` remains absent and frontend deps were regenerated.

This confirms that moving dependencies to backup is reversible and inspectable, but regeneration is not yet optimized/stable on backend.
