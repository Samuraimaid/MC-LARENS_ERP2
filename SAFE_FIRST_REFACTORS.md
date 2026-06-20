# SAFE_FIRST_REFACTORS

The first refactors recommended for Phase 3. These are intentionally small and low-risk.

## 1. Pure formatting helpers

- Extract duplicated phone, cedula, RUC, chassis, and plate formatting helpers only if the output is already identical across call sites.
- Good targets: shared formatting functions used read-only in SalesPage, QuotationsPage, LoginPage, and customer forms.
- Do not touch any validation that changes business logic.

## 2. Readonly label builders

- Extract builders for labels such as customer display labels, vehicle display labels, payment labels, and status labels.
- Keep the functions pure and deterministic.
- Do not move any logic that depends on live state or storage writes.

## 3. Connectivity helpers

- Consolidate duplicate API-root ping logic into a small helper or hook.
- Keep return shape minimal: connected, disconnected, checking, and last checked if needed.
- Do not merge auth-related checks into the same helper.

## 4. Shared constants

- Extract repeated static arrays and maps: payment labels, tab labels, tone maps, and responsive labels.
- Use only when the constant is used in multiple places with identical semantics.
- Do not extract anything that encodes a business rule.

## 5. Readonly preview builders

- Extract builders for vehicle preview cards, quote preview metadata, or list items as readonly output.
- Use after contract freeze and snapshot coverage.
- Do not include totals, persistence, or mutation.

## 6. Utility normalization

- Normalize helper functions that only transform strings, ids, or display labels.
- Keep them side-effect free.
- Do not include draft loading, session state, or submission payload logic.

## What not to include in first refactors

- auth and permissions
- draft restore or backup logic
- totals and calculations
- cashier and session lock state
- inventory logic
- approvals and websocket runtime
- any mutation path or server write path

## Recommended first PR shape

- One helper family per PR.
- One affected page family per PR where possible.
- Prefer read-only and pure code first.
- Keep visual output unchanged and validate it with snapshots.

## Ranking of first refactors

1. shared formatting helpers
2. connectivity helpers
3. readonly label builders
4. shared constants
5. readonly preview builders
6. utility normalization

## Success condition for each refactor

- Same output.
- Smaller duplication surface.
- No new console warnings.
- No new layout shifts.
- No changes in runtime payloads.
