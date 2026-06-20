# Dependency Audit Plan

## Current Snapshot

- Frontend audit after Vite migration and lockfile cleanup: 0 findings.
- Frontend production-only audit after migration: 0 findings.
- Frontend audit after security remediation (2026-05-04): 0 findings.
- Backend audit before patching: 19 vulnerabilities across 15 packages.
- Backend audit after the first patch round: 4 vulnerabilities across 3 packages.
- Backend audit after the framework/tooling round: 0 known vulnerabilities.
- Immediate infrastructure cleanup already applied: removed obsolete `version` from Compose files.

## Applied In This Round

### Backend

- Updated `cryptography`, `ecdsa`, `filelock`, `pillow`, `protobuf`, `pyasn1`, `PyJWT`, `pymongo`, `python-multipart`, `requests`, `urllib3`, and `Werkzeug`.
- Removed duplicate `sendgrid` entries from the default and local manifests.
- Updated the framework/tooling lane to `fastapi 0.121.3`, `starlette 0.49.1`, `black 26.3.1`, and `Pygments 2.20.0`.
- Verified backend import against `backend/server.py` and reran `pip-audit` with a clean result.

### Frontend

- Updated `axios` to `^1.14.0`.
- Updated `axios` again to `^1.16.0` to remediate GHSA-3p68-rc4w-qgx5 and GHSA-fvcv-3m26-pcqx.
- Updated `serve` to `^14.2.6`.
- Updated `ajv` to `^8.18.0`.
- Migrated the frontend build pipeline from CRA/CRACO to Vite.
- Removed legacy CRA/CRACO files and validated Docker frontend builds with the Vite output.
- Aligned `date-fns` to `^3.6.0` to satisfy `react-day-picker@8.10.1`.
- Added route-level code splitting and a shared environment helper for Vite-compatible configuration.
- Verified lint, production build, Docker build, and `npm audit` with clean results.
- Verified that transitive `follow-redirects` vulnerability GHSA-r4q5-vmmm-2653 is no longer reported after dependency refresh.

## Runtime Validation (2026-05-04)

- Docker stack validated with three services up: `mongodb`, `backend`, and `frontend`.
- Health checks validated:
	- Frontend `http://localhost:3000` responding `200`.
	- Backend docs `http://localhost:8001/docs` responding `200`.
- Live UI validation executed in VS Code integrated browser:
	- Login screen loaded at `/login`.
	- Status badge showed `Conexion con servidor: OK`.
	- PIN keypad accepted 8-digit input and enabled submit flow.
	- Invalid PIN login attempt produced controlled `401` response without UI crash.

## Priority 1: Apply Now

These are direct or near-direct updates with clear fix versions and relatively low migration risk.

### Backend

- Completed in this round.

### Frontend

- Completed in this round.

## Priority 2: Schedule Soon

These have fixes, but they are framework-sensitive or may affect application behavior.

### Backend

- Completed in this round.

### Frontend

- `react-router-dom` can move from `7.13.0` to `7.13.2` with low expected risk.
- `autoprefixer`, `postcss`, `recharts`, `tailwind-merge`, `react-hook-form`, `react-to-print`, `eslint-plugin-import`, and `eslint-plugin-react` are suitable for a normal maintenance batch.

## Priority 3: Treat As Migration Work

These should not be mixed into a security patch round.

- `react-scripts` migration: completed.
- `@craco/craco` removal: completed.
- `react` and `react-dom` `18 -> 19` require dedicated regression testing.
- `tailwindcss` `3 -> 4`, `zod` `3 -> 4`, `lucide-react` `0.x -> 1.x`, and `eslint` `8 -> 10` are breaking-change upgrades.

## Practical Reading Of The Frontend Audit

- The frontend no longer carries CRA/webpack audit noise in the application build path.
- Remaining package work is now normal maintenance or major-version modernization, not security remediation pressure.

## Recommended Next Sequence

1. Move deployment and Compose defaults to `VITE_*` naming while keeping the compatibility shim temporarily.
2. Add bundle-size monitoring or a CI budget for the Vite output.
3. Evaluate major-version upgrade lanes separately: React 19, Tailwind 4, ESLint 9/10, and Zod 4.