---
name: coverage-report
description: Generate a Sprint Code Quality Report — runs test coverage, detects duplicate code, identifies code smells (large files, deep nesting, any-casts, console.logs, TODO/FIXME/HACK), and runs ESLint — then produces a single markdown report file. Use whenever the user asks for a coverage report, code quality report, or sprint report.
argument-hint: "[sprint-number]"
allowed-tools: Bash(npx vitest*), Bash(npx eslint*), Bash(mkdir*), Bash(wc *), Bash(grep *), Bash(find *), Bash(sort *), Bash(awk *), Bash(cat *), Bash(node *), Write, Read, Glob, Grep
---

Generate a code quality report for the project. The sprint number comes from $ARGUMENTS (default to the next sprint number if not provided).

This report is meant to complement SonarQube/SonarCloud analysis — it captures local metrics the team can submit alongside the SonarQube dashboard.

## Steps

### 1. Run test coverage

```bash
npx vitest run --coverage 2>&1
```

Parse the text output table for the **All files** summary row and extract:
- Statement %
- Branch %
- Function %
- Line %

Also identify the **5 lowest-coverage files** (by line %) from the per-file rows.

### 2. Run ESLint

```bash
npx eslint src/ --format compact 2>&1 || true
```

Count total warnings and total errors from the output. Identify the top 5 files by issue count.

### 3. Detect duplicate / copy-paste code

Search for structurally repeated patterns across `src/` (excluding `node_modules`, `.next`, `__tests__`, and `src/components/ui/`). Use this approach:

```bash
# Find non-test TS/TSX source files, then for each file extract every 4-line
# window and look for exact duplicates across different files.
node -e "
const fs = require('fs');
const path = require('path');
const glob = require('glob');

const files = glob.sync('src/**/*.{ts,tsx}', {
  ignore: ['**/node_modules/**','**/.next/**','**/__tests__/**','src/components/ui/**','**/*.test.*']
});

const blocks = new Map(); // hash -> [{file, startLine}]
const WINDOW = 4;

for (const file of files) {
  const lines = fs.readFileSync(file,'utf8').split('\n');
  for (let i = 0; i <= lines.length - WINDOW; i++) {
    const block = lines.slice(i, i + WINDOW).map(l => l.trim()).join('\n');
    if (block.replace(/\s/g,'').length < 40) continue; // skip trivial blocks
    if (!blocks.has(block)) blocks.set(block, []);
    blocks.get(block).push({ file, startLine: i + 1 });
  }
}

let dupeCount = 0;
const dupeFiles = new Map();
for (const [block, locs] of blocks) {
  const uniqueFiles = new Set(locs.map(l => l.file));
  if (uniqueFiles.size > 1) {
    dupeCount++;
    for (const f of uniqueFiles) dupeFiles.set(f, (dupeFiles.get(f)||0) + 1);
  }
}

const topFiles = [...dupeFiles.entries()].sort((a,b) => b[1]-a[1]).slice(0,5);
console.log(JSON.stringify({ duplicateBlocks: dupeCount, topFiles }));
"
```

If the node script fails (e.g. glob not available), fall back to a simpler grep-based approach: search for functions/components that appear in multiple files with identical signatures.

Report: total duplicate block count and top 5 files with the most duplication.

### 4. Detect code smells

Run these checks across `src/**/*.{ts,tsx}` (excluding `node_modules`, `.next`, `__tests__`, `src/components/ui/`, and test files):

| Smell | How to detect | Threshold |
|-------|--------------|-----------|
| **Large files** | `wc -l` on each file | > 300 lines |
| **`as any` casts** | grep for `as any` | Any occurrence |
| **`console.log` in production** | grep for `console.log` (exclude test files) | Any occurrence |
| **TODO / FIXME / HACK comments** | grep for `TODO\|FIXME\|HACK` | Any occurrence |
| **Deeply nested code** | grep for lines with 4+ levels of indentation (16+ leading spaces or 4+ tabs) that contain `if\|for\|while\|switch` | Any occurrence |
| **Unused imports** | from ESLint output (no-unused-vars, unused-imports) | Any occurrence |

For each smell, collect: count of occurrences and the top offending files.

### 5. Compute summary scores

Assign a simple letter grade for each area based on these thresholds:

| Area | A | B | C | D |
|------|---|---|---|---|
| Test Coverage (line %) | ≥ 85% | ≥ 75% | ≥ 60% | < 60% |
| ESLint Issues | 0 errors | 0 errors, < 10 warnings | < 5 errors | ≥ 5 errors |
| Code Duplication | 0 blocks | < 10 blocks | < 30 blocks | ≥ 30 blocks |
| Code Smells | 0 `as any` + 0 `console.log` | < 5 total | < 15 total | ≥ 15 total |

### 6. Check for prior reports

Look for existing `Sprint-*-Code-Quality-Report.md` files in `code_quality_reports/` to compare trends. Also check for older `test_coverage_reports/Sprint-*` files.

### 7. Generate the report

Ensure the output directory exists:

```bash
mkdir -p code_quality_reports
```

Write **`code_quality_reports/Sprint-$SPRINT-Code-Quality-Report.md`** using this template:

```markdown
# Sprint $SPRINT — Code Quality Report

**Generated:** $DATE
**Project:** Grad Tracker Frontend

---

## Summary

| Area | Grade | Detail |
|------|-------|--------|
| Test Coverage | $GRADE | $LINE_COV% line · $BRANCH_COV% branch · $FUNC_COV% function · $STMT_COV% statement |
| ESLint | $GRADE | $ERRORS errors · $WARNINGS warnings |
| Code Duplication | $GRADE | $DUPE_BLOCKS duplicate blocks across $DUPE_FILES files |
| Code Smells | $GRADE | $SMELL_TOTAL total findings |

---

## 1. Test Coverage

| Metric | Percentage |
|--------|-----------|
| Line coverage | $LINE% |
| Branch coverage | $BRANCH% |
| Function coverage | $FUNCTION% |
| Statement coverage | $STATEMENT% |

### Lowest-Coverage Files

| # | File | Line % | Branch % |
|---|------|--------|----------|
[Top 5 rows]

### Coverage Trend

[Compare to prior sprint if available, otherwise "Baseline — no prior data."]

---

## 2. ESLint Analysis

| Metric | Count |
|--------|-------|
| Errors | $ERRORS |
| Warnings | $WARNINGS |

### Top Files by Issue Count

| # | File | Errors | Warnings |
|---|------|--------|----------|
[Top 5 rows, or "No issues found."]

---

## 3. Code Duplication

| Metric | Value |
|--------|-------|
| Duplicate code blocks | $COUNT |
| Files with duplication | $FILE_COUNT |

### Top Files with Duplication

| # | File | Duplicate Blocks |
|---|------|-----------------|
[Top 5 rows, or "No duplication detected."]

---

## 4. Code Smells

| Smell | Count | Top Files |
|-------|-------|-----------|
| Large files (> 300 lines) | $N | file1, file2 |
| `as any` casts | $N | file1, file2 |
| `console.log` in production | $N | file1, file2 |
| TODO / FIXME / HACK | $N | file1, file2 |
| Deeply nested logic | $N | file1, file2 |

---

## 5. Scope

**Test coverage includes:**
- [List tested areas from test files]

**Test coverage excludes (via `vitest.config.ts`):**
- [List exclusion patterns]

---

## 6. Evidence

Coverage generated via:
\```bash
npx vitest run --coverage
\```

Lint check via:
\```bash
npx eslint src/ --format compact
\```

HTML coverage report: `coverage/index.html`

---

## 7. Statement of Integrity

This report was generated from automated analysis executed during Sprint $SPRINT.
```

### 8. Show the user the file path and a quick summary

Print the file path, the four letter grades, and the key numbers (coverage %, lint errors, dupe blocks, smell count).

## Important

- Use REAL numbers from actual tool output — never hardcode or guess.
- If any step fails, note the failure in that section of the report but continue with the remaining sections. Only skip report generation if coverage (step 1) completely fails.
- Keep file paths relative to the project root in the report (e.g. `src/components/Foo.tsx`, not the absolute path).
- The "Top Files" tables should show at most 5 rows each to keep the report concise.
