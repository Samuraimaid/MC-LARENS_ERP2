# TESTING_MINIMUMS

Minimum validation required before and after each Phase 3 microphase.

## Baseline tests required before any change

- Import validation for the touched files.
- Build validation for the affected frontend bundle or backend module.
- Route smoke validation for the affected route family.
- Browser console check for unexpected errors.
- Screenshot baseline for any visual page that might change.

## Test types by risk level

### Low risk
- import validation
- build validation
- one route smoke test
- snapshot test for helper output if the helper is pure

### Medium risk
- import validation
- build validation
- route smoke test
- payload snapshot or output snapshot
- one browser screenshot comparison
- basic responsive check for desktop and mobile

### High risk
- import validation
- build validation
- payload snapshots
- route validation
- browser smoke on the target page family
- visual regression comparison
- optional Mongo validation if the phase touches read/write data paths

## Minimal test menu per microphase

### Microphase 1
- import validation
- helper output snapshot
- build validation

### Microphase 2
- payload snapshot or readonly output snapshot
- visual regression on affected pages
- build validation

### Microphase 3
- network request count comparison
- connectivity state smoke test
- visual regression for status indicators
- build validation

### Microphase 4
- label snapshot test
- screenshot comparison where labels are visible
- build validation

### Microphase 5
- payload snapshots
- route validation
- browser smoke on the dependent flow
- build validation

### Microphase 6
- flag-off validation
- flag-on validation
- screenshot comparison in both modes
- route smoke test in both modes

## Validation order

1. import validation.
2. build validation.
3. route or browser smoke.
4. snapshot or visual regression.
5. only then consider wider test coverage.

## What counts as pass

- No new runtime errors.
- No new build errors.
- No payload shape drift.
- No unexpected screenshot diffs.
- No new warnings in console or network traces.

## What counts as fail

- Any broken import.
- Any new console error.
- Any altered payload contract.
- Any altered visible layout or timing.
- Any extra data write or missing state restore.

## Pragmatic rule

- Do not add broad test suites just to look thorough.
- Add the smallest test that can disprove the current hypothesis or prove parity.
