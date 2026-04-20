# Planner Data + Auto-Generate Reliability Plan

## Scope
- Validate mapping correctness (prereqs + major/elective links).
- Move planner read paths to canonical database views.
- Fix semester underfill behavior in auto-generation while preserving constraints.

## Implementation
- Add DB cleanup migration for `NON_PLANNABLE` flags and uniqueness on `(block_id, flag_type)`.
- Extend `v_program_block_courses` (additive) with:
  - `is_plannable`
  - `planner_exclusion_reason`
- Add `DB_VIEWS` constants and typed view row contracts.
- Refactor planner read helpers to use:
  - `v_plan_meta`
  - `v_plan_terms`
  - `v_plan_courses`
  - `v_program_block_courses`
  - `v_gened_bucket_courses`
- Keep all writes on base tables.
- Exclude non-plannable/empty blocks from course-selection input and emit warning issues (`BLOCK_EXCLUDED_NON_PLANNABLE`).
- Keep empty-semester skipping; add rebalancing pass to move eligible courses from earlier full terms into trailing underfilled terms.
- Ensure rebalancing preserves prerequisite and offering constraints.

## Test Coverage
- Query helper tests for view callsites and shape mapping.
- Auto-generate tests for:
  - non-plannable exclusion warning emission
  - tail-term rebalancing behavior
- Regression checks for write helpers staying on base tables.
