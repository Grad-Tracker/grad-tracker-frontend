---
name: create-feature-tests
description: Analyze the current feature branch, present a clear test plan to the user before writing tests, then implement Vitest tests for changed behavior and validate 80% minimum coverage thresholds for lines, functions, branches, and statements.
disable-model-invocation: true
argument-hint: "[base-branch]"
allowed-tools: Bash(git*), Bash(rg*), Bash(npx vitest*), Write
---

Create a test plan for the current feature branch and show it to the user before adding tests. Base branch comes from $ARGUMENTS (default: `dev`).

## Steps

1. Detect current branch:
   ```bash
   git branch --show-current
   ```

2. Resolve base branch:
   - Use `$ARGUMENTS` if provided.
   - Otherwise use `dev`.

3. Gather branch diff:
   ```bash
   git diff --name-only <base>...HEAD
   ```

4. Identify test targets from changed feature files:
   - Exclude test files and non-feature config noise.
   - Focus on behavior changes in `src/`.

5. Present a **Plan Preview** to the user **before writing tests**:
   - Files/features to test
   - Scenarios: happy path, error path, edge cases
   - Proposed test files to create/update
   - Risk ranking (High/Medium/Low)
   - Estimated number of tests

6. Pause and wait for user confirmation. Do not write tests until the user explicitly says to proceed.

7. After confirmation, implement tests in `*.test.ts` / `*.test.tsx`.

8. Validate with coverage thresholds:
   ```bash
   npx vitest run --coverage \
     --coverage.thresholds.lines=80 \
     --coverage.thresholds.functions=80 \
     --coverage.thresholds.branches=80 \
     --coverage.thresholds.statements=80
   ```

9. Report final results:
   - Tests added/updated
   - Pass/fail status
   - Actual coverage metrics
   - Remaining gaps (if any)

## Important

- Always show the plan preview first; do not write tests before planning.
- Use real diff and real test output; never guess.
- Keep scope limited to current feature branch changes.
- If coverage or tests fail, report exact failures and continue with targeted fixes.