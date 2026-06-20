# NEXT_DOMAIN_READINESS_ANALYSIS

## Objective
Select the next low-risk, high-value extraction candidate without touching critical transactional domains.

## Out of Scope (Blocked for now)
- Sales Core
- Drafts
- Cashier
- Approvals
- Sessions/Auth extraction
- Inventory mutations

## Candidate Evaluation

### 1) Notifications
- Risk: Medium.
- Value: Medium-High.
- Why: event/report surfaces are partly coupled with invoice/report routes.
- Concern: can accidentally overlap with sales/approval side effects.

### 2) Shared Utilities
- Risk: Low-Medium.
- Value: Medium.
- Why: extraction can reduce duplication safely if utility contracts are pure.
- Concern: uncontrolled utility extraction can become a hidden global rewrite.

### 3) Connectivity
- Risk: Low.
- Value: Medium.
- Why: infrastructure adapter extraction (HTTP clients, external connectors) usually has clear seams.
- Concern: retry/timeouts behavior must stay identical.

### 4) Optional Integrations
- Risk: Low.
- Value: Medium-High.
- Why: best candidate for pattern hardening with minimal transaction coupling.
- Concern: keep startup optionality and lazy loading semantics.

### 5) Background Jobs
- Risk: Low-Medium.
- Value: Medium.
- Why: separable scheduling domain with bounded side effects.
- Concern: startup scheduler hooks and environment flags must not drift.

## Recommended Next Candidate
**Optional Integrations**

### Why this is the safest next step
- Lowest coupling with sales/drafts/cashier transaction paths.
- High reuse of Phase 6A pattern:
  - wrappers
  - lazy dependency boundaries
  - clean-room startup parity
  - Docker parity
- Strong rollback simplicity through adapter-level commits.

## Readiness Gate for Next Extraction
Proceed only if all are true:
- Phase 6A stabilization report remains PASS.
- Baseline route hash remains unchanged.
- Extraction plan remains wrapper-first and delegation-only.
- No touches to blocked critical domains.

## Decision
Next safe domain candidate: **Optional Integrations**.
No extraction executed in this phase.
