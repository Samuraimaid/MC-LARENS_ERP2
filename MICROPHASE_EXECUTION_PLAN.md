# MICROPHASE_EXECUTION_PLAN

Phase 3 safe execution roadmap. This is a planning artifact only: no implementation is included here.

## Guiding rule

- Extract first what is pure, read-only, and low-risk.
- Do not touch auth, drafts, totals, payments, session lock, cashier math, inventory mutations, approvals, websocket runtime, or server.py splitting yet.
- Every phase below assumes the previous one has passed validation.

## Execution order

1. Baseline safety gate.
2. Safe-now helper extraction.
3. Contract freeze for payloads and snapshots.
4. Test-harness-backed extractions.
5. Feature-flagged UX/runtime consolidations.
6. Only then consider adjacent structural work.

## Microphases

### MICROFASE 0 - Baseline snapshot and safety gate
- Objetivo: freeze the current observable behavior before any change, especially login, workbench shell, sales, quotations, cashier, and visual states.
- Archivos afectados: no code changes; baseline artifacts only.
- Riesgo: low, but if skipped, later validation becomes ambiguous.
- Rollback: not applicable; this phase is read-only.
- Validación: screenshot baseline, route baseline, build baseline, and API smoke baseline.
- Tests mínimos: app load, login page render, workbench shell render, sales page render, quotations page render, cashier page render.
- Impacto visual esperado: none.
- Impacto runtime esperado: none.
- Success criteria: baseline artifacts exist and are reproducible.
- Failure criteria: missing baseline route coverage, missing screenshots, or any unexplained console/runtime error.
- Estimated difficulty: low.
- Estimated duration: 0.5 day.

### MICROFASE 1 - Safe-now helper extraction
- Objetivo: extract pure helpers and readonly builders only.
- Archivos afectados: formatting helpers, label builders, connectivity utilities, shared constants, and readonly preview builders in frontend/lib and small adjacent modules.
- Riesgo: low.
- Rollback: restore helper file and revert imports to the original inline logic.
- Validación: import validation, unit-level helper validation, build validation.
- Tests mínimos: helper import tests, pure function output snapshots, build passes.
- Impacto visual esperado: none or identical output.
- Impacto runtime esperado: no behavioral change.
- Success criteria: same UI output, fewer duplicated helper implementations, no new warnings.
- Failure criteria: changed labels, changed formatting, changed polling behavior, or build/type errors.
- Estimated difficulty: low.
- Estimated duration: 0.5-1 day.

### MICROFASE 2 - Readonly consolidation with contract freeze
- Objetivo: consolidate duplicated readonly logic once the payload and snapshot contracts are frozen.
- Archivos afectados: readonly preview builders, list-label generators, shared card metadata helpers, and non-mutating display helpers.
- Riesgo: low-medium because outputs are user-visible even when readonly.
- Rollback: restore original helper call sites and any derived constants.
- Validación: payload snapshot comparison, screenshot diff on affected views, and route smoke tests.
- Tests mínimos: snapshot tests for labels/previews, one visual regression pass on affected pages.
- Impacto visual esperado: identical or intentionally equivalent.
- Impacto runtime esperado: no API or storage writes.
- Success criteria: outputs remain identical across sales, quotations, and shared cards.
- Failure criteria: any divergence in labels, previews, or card metadata.
- Estimated difficulty: medium.
- Estimated duration: 1 day.

### MICROFASE 3 - Connectivity and polling consolidation
- Objetivo: unify duplicate connectivity/status polling into a single safe utility or hook.
- Archivos afectados: MainLayout, LoginPage, ConnectivityBadge, and related connectivity helpers.
- Riesgo: medium because polling affects UX feedback and perceived reliability.
- Rollback: restore page-local polling logic and remove the shared hook from call sites.
- Validación: runtime smoke test, network request count check, and status visual regression.
- Tests mínimos: import validation, periodic polling behavior test, status indicator rendering test.
- Impacto visual esperado: identical status presentation, same timing tolerance.
- Impacto runtime esperado: fewer duplicate requests, same user-facing result.
- Success criteria: one shared source of truth for connectivity without changing status semantics.
- Failure criteria: stale status, missed polling updates, or duplicate flicker.
- Estimated difficulty: medium.
- Estimated duration: 1 day.

### MICROFASE 4 - Shared constants and label builders
- Objetivo: move repeated static mappings into shared constants and label builders.
- Archivos afectados: payment labels, customer/vehicle card labels, status labels, and similar read-only maps.
- Riesgo: low-medium.
- Rollback: revert constant usage and re-inline the original maps.
- Validación: snapshot diff on labels, route smoke, build validation.
- Tests mínimos: mapping tests, UI text snapshot tests for the pages that consume them.
- Impacto visual esperado: none if done correctly.
- Impacto runtime esperado: none.
- Success criteria: identical visible labels and reduced duplication.
- Failure criteria: any label change not explicitly approved.
- Estimated difficulty: low.
- Estimated duration: 0.5-1 day.

### MICROFASE 5 - Test-harness-backed extraction
- Objetivo: extract any helper that is adjacent to calculations or draft state only after regression coverage exists.
- Archivos afectados: draft scoring wrappers, derived totals helpers that are still readonly, and shared payload normalizers not yet mutating state.
- Riesgo: medium-high.
- Rollback: restore old helper placement and revert call-site changes.
- Validación: payload snapshots, runtime validation, and visual regression on the pages using the helper.
- Tests mínimos: regression tests around exact inputs/outputs, plus at least one end-to-end smoke path.
- Impacto visual esperado: identical.
- Impacto runtime esperado: no contract drift.
- Success criteria: behavior equivalence demonstrated by snapshots and runtime checks.
- Failure criteria: changed payload shape, changed totals, changed draft recovery, or changed session behavior.
- Estimated difficulty: medium.
- Estimated duration: 1-2 days.

### MICROFASE 6 - Feature-flagged UX/runtime consolidation
- Objetivo: introduce flag-gated changes for any UX-adjacent runtime consolidation that must be rollbackable instantly.
- Archivos afectados: new feature flags layer, selected runtime adapters, and call sites for opt-in behavior.
- Riesgo: medium-high because user experience is involved, even if logic is small.
- Rollback: disable the feature flag first, then revert code if needed.
- Validación: flag-on and flag-off runtime validation, screenshot comparison, and route smoke tests.
- Tests mínimos: dual-path tests for both flag states.
- Impacto visual esperado: no visible change unless flag enabled.
- Impacto runtime esperado: reversible change controlled by config.
- Success criteria: flag can be toggled safely without redeploying code.
- Failure criteria: flag ignored, partial activation, or hidden UX regression.
- Estimated difficulty: medium.
- Estimated duration: 1-2 days.

### MICROFASE 7 - Adjacent structural readiness review
- Objetivo: decide whether any larger extraction is ready, but do not split server.py or SaleForm yet.
- Archivos afectados: none by default; review-only.
- Riesgo: high if pushed into implementation too early.
- Rollback: not applicable unless a future implementation is started.
- Validación: contract-freeze review, test coverage review, and baseline comparison.
- Tests mínimos: no new tests required beyond existing coverage review.
- Impacto visual esperado: none.
- Impacto runtime esperado: none.
- Success criteria: the next structural slice is justified and safe.
- Failure criteria: attempt to proceed into auth, drafts, totals, session lock, or cashier before readiness.
- Estimated difficulty: low.
- Estimated duration: 0.5 day.

## Phase ordering rationale

- Start with pure helper extraction because it has the highest architectural gain and the lowest runtime risk.
- Move to readonly consolidation only after the contract surface is understood and frozen.
- Require test harnesses before touching anything that can affect payloads, totals, drafts, or visible behavior.
- Use feature flags for any step that may need instant rollback or dual-path validation.

## Hard stop conditions

- If a phase changes totals, auth, drafts, session locks, inventory stock, cashier math, approvals, or websocket behavior, stop and reclassify it.
- If a phase changes visible UX timing, layout, or animation sequencing, it must be postponed until visual regression coverage exists.
