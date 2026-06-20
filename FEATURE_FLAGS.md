# FEATURE_FLAGS

Feature flag strategy for safe incremental normalization.

## Naming strategy

- Use uppercase with a `FEATURE_` prefix.
- Prefer one flag per architectural slice, not one flag per file.
- Name flags by capability, not by implementation detail.
- Keep names stable once introduced; do not reuse retired names for different behavior.

### Suggested initial flags
- `FEATURE_SHARED_FORMATTERS`
- `FEATURE_NEW_CONNECTIVITY_HOOK`
- `FEATURE_UNIFIED_LABELS`
- `FEATURE_SHARED_READONLY_BUILDERS`
- `FEATURE_DRAFT_ENGINE_V2`
- `FEATURE_VISUAL_CONTRACT_BASELINE`
- `FEATURE_INTERVENTION_SYSTEM`

## Rollout strategy

1. Start disabled by default.
2. Enable only in local development first.
3. Validate on a single page or route family.
4. Expand to a second route family after snapshot parity.
5. Promote to staging.
6. Promote to production only after rollback has been proven.

## Activation rules

- Use flags for UX-adjacent or rollback-sensitive changes.
- Keep safe-now helper extraction unflagged when it is truly pure and behavior-preserving.
- Use flags when the same code path might need old/new behavior coexistence.
- Prefer runtime config that can be toggled without a code redeploy.

## Rollback strategy

- First rollback action should be flag disablement, not code deletion.
- If the flag is not enough, revert the feature branch commit or restore the previous helper wiring.
- Preserve the old code path until the new one has passed at least one full validation cycle.

## Safe activation model

- Local dev: enable one flag at a time.
- Staging: enable only after snapshots, build checks, and smoke tests pass.
- Production: enable gradually, starting with the least risky page or route.
- For anything visual, pair activation with screenshot comparison before and after.

## Operational guidance

- Do not hide critical business logic behind a flag without a proven fallback.
- Do not use flags to postpone validation.
- Use flags to reduce blast radius, not to avoid testing.
- Retire flags only after the new path is permanently stable.

## Flag-by-flag intent

### FEATURE_SHARED_FORMATTERS
- Controls extraction of pure formatting and display helpers.
- Low risk.
- Candidate for early activation only if a visible consumer needs it.

### FEATURE_NEW_CONNECTIVITY_HOOK
- Controls shared connectivity polling consolidation.
- Medium risk because it affects status indicators and polling.
- Must have runtime validation and network-count comparison.

### FEATURE_UNIFIED_LABELS
- Controls shared label builders and static text mappings.
- Low risk but visually observable.
- Must pass screenshot parity.

### FEATURE_SHARED_READONLY_BUILDERS
- Controls readonly preview and metadata helpers.
- Medium risk because it touches user-visible cards and previews.
- Must have snapshot coverage.

### FEATURE_DRAFT_ENGINE_V2
- Reserved for any future draft engine evolution.
- High risk.
- Must remain disabled until draft contract freeze and regression harnesses exist.

### FEATURE_VISUAL_CONTRACT_BASELINE
- Controls safety checks rather than business logic.
- Can be used to gate baseline comparison flows.
- Should not affect production behavior directly.

### FEATURE_INTERVENTION_SYSTEM
- Reserved for future higher-risk interventions and should not be activated during Phase 3.
- Keep off until the entire contract and rollback story is mature.

## Do not use flags for

- auth logic
- drafts mutations
- totals and financial calculations
- session lock handling
- cashier math
- inventory mutations
- websocket runtime
- approval logic

## Minimal environment exposure

- Keep flags in a small config surface, ideally a single source for frontend and one for backend if needed.
- Prefer reading from environment variables for deployment safety.
- Log the resolved flag state at startup in development and staging only.
