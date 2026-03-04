# Sprint 2 — Code Coverage Report

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
| Line coverage | 84.88% |
| Branch coverage | 80.05% |
| Function / Method coverage | 81.3% |
| Statement coverage | 84.88% |

## 3. Scope of Coverage

**Included:**

- Auth flows: sign in, sign up, forgot password, reset password (`src/app/signin`, `src/app/signup`, `src/app/forgot-password`, `src/app/reset-password`)
- Main dashboard page with onboarding banner, quick actions, reset progress, and change major flows (`src/app/dashboard/page.tsx`)
- Course catalog with search, filter, pagination, and drawer detail view (`src/app/dashboard/courses/CoursesClient.tsx`)
- Degree planner page, plan hub, plan cards, semester columns, course panel, and all dialogs (`src/app/dashboard/planner/`, `src/components/planner/`)
- Requirements dashboard and Gen Ed requirements display (`src/components/requirements/`)
- Onboarding wizard steps: program selection, class selection, review, and navigation (`src/components/onboarding/`)
- Dashboard shell, sidebar, and header (`src/components/dashboard/`)
- Landing page including sign-in dialog (`src/components/LandingPage.tsx`)
- Supabase query functions for planner and onboarding (`src/lib/supabase/queries/`)
- Prerequisite logic utility (`src/lib/prereq.ts`)

**Excluded (configured in `vitest.config.ts`):**

- `node_modules/**`
- `.next/**`
- `dist/**`, `coverage/**`
- `**/*.d.ts`, `**/*.config.*`, `next.config.*`
- `src/components/ui/**` — auto-generated Chakra UI wrapper components (not project logic)
- `src/__tests__/**`, `**/*.test.ts`, `**/*.test.tsx` — test files themselves

## 4. Coverage Trend

Baseline sprint — no prior data for comparison.

## 5. Weak Areas

| # | File | Coverage | Reason |
|---|------|----------|--------|
| 1 | `src/types/planner.ts` | 62.54% stmts / 69.23% branch | Type utility functions (e.g. helper transforms) not exercised by unit tests; type-only exports counted as uncovered lines |
| 2 | `src/app/dashboard/planner/page.tsx` | 74.96% stmts / 36.36% funcs | Several internal handlers (drag-and-drop callbacks, course move/remove logic) are not reached by the current page-level tests |
| 3 | `src/app/dashboard/page.tsx` | 80.35% stmts / 64.89% branch | Several conditional branches around graduation status display and multi-step quick-action flows (lines 857–931) are not tested |

## 6. Evidence

Coverage report generated via:

```bash
npx vitest run --coverage
```

HTML report available at `coverage/index.html` after running the command above.

## 7. Statement of Integrity

This coverage was generated from automated tests executed during this sprint.
