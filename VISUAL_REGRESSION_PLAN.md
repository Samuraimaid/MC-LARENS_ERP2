# VISUAL_REGRESSION_PLAN

Protection plan for UX/UI fidelity during the first execution phases.

## Baseline capture workflow

1. Capture screenshots before any refactor.
2. Capture the same routes after each microphase.
3. Compare the exact same viewport sizes.
4. Keep the same browser scale, theme, and user role during comparison.

## Baseline route set

- `/login`
- `/workbench?tab=sales`
- `/workbench?tab=quotations`
- `/cashier`
- any page touched by a helper extraction that affects visible labels or cards

## Required viewports

- desktop large
- desktop compact
- mobile portrait
- mobile landscape where the route supports it

## What to compare

- spacing and alignment
- typography and truncation
- icon placement
- card density
- animation presence and timing
- responsive breakpoints
- overlay behavior
- toast placement
- theme colors and watermark opacity
- workbench tab presentation

## Visual safety rules

- Do not accept silent layout drift.
- Do not accept animation removal unless explicitly approved.
- Do not accept responsive breakpoint changes without sign-off.
- Do not accept text wrapping or truncation changes that alter the user flow.
- Do not accept changes in lock overlays, dark/light mode application, or branching brand visuals.

## High-risk visual zones

- LoginPage
- MainLayout
- SalesPage
- QuotationsPage
- SaleForm
- CashierPage
- ThemeContext-driven appearance and watermark behavior

## Regression checks by phase

### Microphase 1
- helper extraction should produce no screenshot differences.

### Microphase 2
- readonly consolidation must preserve visual output exactly.

### Microphase 3
- connectivity consolidation must preserve status icons, pulses, and alerts.

### Microphase 4
- label builder consolidation must preserve visible text, badges, and tone.

### Microphase 5
- test-harness-backed extraction must preserve card layout and form sequencing.

### Microphase 6
- flag-gated runtime consolidation must be compared in both flag states.

## Animation preservation checks

- Keep the same entry animations on sales and quotations panels if they are already active.
- Keep lock overlay transitions unchanged.
- Keep mobile drawer and bottom navigation motion unchanged.
- Keep toast presentation and status pulse behavior intact.

## Responsive preservation checks

- Validate desktop and mobile layouts separately.
- Validate orientation-dependent controls on touch devices.
- Validate that button density and tab wrapping do not regress.

## Screenshot failure criteria

- Any unintended shift in component position.
- Any unexpected color shift.
- Any missing icon or badge.
- Any change in overlay timing or opacity.
- Any shift in the amount of visible content on a target viewport.

## Practical rule

- If a change cannot pass screenshot parity on the baseline route set, it is not ready for Phase 3 execution.
