---
name: coverage-report
description: Generate a Sprint Code Coverage Report by running the test suite with coverage and producing a markdown report file.
disable-model-invocation: true
argument-hint: "[sprint-number]"
allowed-tools: Bash(npx vitest*)
---

Generate a code coverage report for the project. The sprint number comes from $ARGUMENTS (default to the next sprint number if not provided).

## Steps

1. **Run the test suite with coverage:**
   ```
   npx vitest run --coverage
   ```

2. **Parse the coverage output** and extract the actual percentages for:
   - Statement coverage
   - Branch coverage
   - Function coverage
   - Line coverage

3. **Identify the 2-3 weakest files** (lowest coverage percentages) from the output. For each, note the file path, coverage %, and a brief reason why coverage is low.

4. **Identify the scope** by looking at what test files exist and what the coverage exclusions are in `vitest.config.ts`.

5. **Generate `Sprint-$SPRINT-Code-Coverage-Report.md`** in the repo root using this exact template format:

```markdown
# Sprint $SPRINT — Code Coverage Report

## 1. Tool & Setup

| Item | Detail |
|------|--------|
| Language | TypeScript |
| Framework | Next.js 16 (App Router), React 19 |
| Test Framework | Vitest + @testing-library/react |
| Coverage Tool | @vitest/coverage-v8 (V8 provider) |

## 2. Coverage Metrics

| Metric | Percentage |
|--------|-----------|
| Line coverage | $LINE% |
| Branch coverage | $BRANCH% |
| Function / Method coverage | $FUNCTION% |
| Statement coverage | $STATEMENT% |

## 3. Scope of Coverage

**Included:**

- [List tested areas based on test files found]

**Excluded (configured in `vitest.config.ts`):**

- [List exclusion patterns from vitest.config.ts]

## 4. Coverage Trend

[Compare to prior sprint report if one exists in the repo root, otherwise note "Baseline sprint — no prior data for comparison."]

## 5. Weak Areas

| # | File | Coverage | Reason |
|---|------|----------|--------|
| 1 | `path/to/file` | X% | Brief reason |
| 2 | `path/to/file` | X% | Brief reason |
| 3 | `path/to/file` | X% | Brief reason |

## 6. Evidence

Coverage report generated via:

\```bash
npx vitest run --coverage
\```

HTML report available at `coverage/index.html` after running the command above.

## 7. Statement of Integrity

This coverage was generated from automated tests executed during this sprint.
```

6. **Show the user** the generated file path and a summary of the key metrics.

## Important

- Use REAL numbers from the actual coverage run — never hardcode or guess percentages.
- If the coverage run fails, report the error and do not generate the file.
- For the coverage trend (section 4), look for any existing `Sprint-*-Code-Coverage-Report.md` files in the repo root and compare against the most recent one.
