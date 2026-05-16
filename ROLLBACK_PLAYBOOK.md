# ROLLBACK_PLAYBOOK

Rollback guidance for Phase 3 microphases.

## General rollback rules

- Prefer the smallest revert that restores the last known-good behavior.
- Never roll back by deleting unrelated files.
- Restore baseline behavior before investigating the next cause.
- If data may have been written, verify it before re-running the app.

## Rollback checklist by microphase

### MICROFASE 1 - Safe-now helper extraction
- Revert helper file changes and restore inline logic at the original call sites.
- Validate that imports still resolve.
- Check: build passes, helper outputs match baseline, and visible labels/formatting have not changed.
- Logs to review: frontend build output, runtime console, lint/typecheck output.
- Corruption signal: changed formatting output or import cycles.

### MICROFASE 2 - Readonly consolidation with contract freeze
- Restore original readonly helper implementations.
- Remove any derived shared constants introduced for the consolidation.
- Validate screenshots and label snapshots against the baseline.
- Logs to review: visual diff output, browser console, route smoke output.
- Corruption signal: any label, preview, or card metadata mismatch.

### MICROFASE 3 - Connectivity and polling consolidation
- Re-enable page-local polling logic and disable the shared hook wiring.
- Validate that status indicators still update and that network traffic returns to baseline behavior.
- Logs to review: browser network panel, API request logs, console warnings.
- Corruption signal: stale connectivity state, duplicate timers, or no status updates.

### MICROFASE 4 - Shared constants and label builders
- Restore inline maps or previous constant definitions.
- Re-run screenshot diff and text snapshot comparison.
- Logs to review: build output, UI snapshots, console text warnings.
- Corruption signal: changed labels or unexpected text wrapping.

### MICROFASE 5 - Test-harness-backed extraction
- Restore the previous helper placement and the old call wiring.
- Re-run payload snapshots and smoke tests before proceeding anywhere else.
- Logs to review: failing regression tests, API responses, diff outputs.
- Corruption signal: payload shape drift or altered derived values.

### MICROFASE 6 - Feature-flagged UX/runtime consolidation
- Disable the feature flag first.
- If the old behavior is not restored, revert the code change as well.
- Validate both flag-off and flag-on paths separately after rollback.
- Logs to review: flag resolution logs, runtime console, browser screenshots.
- Corruption signal: partial flag activation or mixed old/new behavior.

## What to restore first

- For visual or helper changes, restore the smallest helper or component slice first.
- For any runtime change, restore the old code path before attempting to repair a new one.
- For any data-adjacent change, verify the backing store or snapshot before continuing.

## Logs to check

- Frontend build output.
- Browser console errors and warnings.
- Network request status for the touched route family.
- Backend startup logs if a helper touches startup wiring.
- Mongo write/read logs if the change is data-adjacent.

## Corruption detection

- Changed payload shape.
- Changed snapshot restoration order.
- Changed visual spacing, timing, or responsive layout.
- Changed status indicators or polling cadence.
- New console errors on pages that were previously clean.

## Recovery priority

1. Stop the rollout or disable the feature flag.
2. Revert the narrowest helper or adapter.
3. Re-run the baseline validations.
4. Only then reintroduce the next microphase.
