# Sprint 2 — Code Coverage Report

## 1. Tool & Setup

| Item | Detail |
|------|--------|
| Language | TypeScript |
| Framework | Next.js 16 (App Router), React 19 |
| Test Framework | Vitest 3.2.4 + @testing-library/react 16.3.2 |
| Coverage Tool | @vitest/coverage-v8 (V8 provider) |

## 2. Coverage Metrics

| Metric | Percentage |
|--------|-----------|
| Line coverage | 93.19% |
| Branch coverage | 81.88% |
| Function / Method coverage | 87.28% |
| Statement coverage | 93.19% |

## 3. Scope of Coverage

**Included:**

- Auth pages — signin, signup, forgot-password, reset-password
- Dashboard page (with reset progress & change major flows)
- Course catalog (CoursesClient)
- Onboarding wizard (multi-step flow, program/class selection, review)
- Landing page
- Planner — plan CRUD, semester management, course drag-and-drop, breadth/graduate selectors
- Gen-ed and degree requirements display
- Dashboard shell, header, and sidebar
- Supabase query helpers (`src/lib/supabase/queries/` — onboarding, planner, schema)
- Prerequisite parsing logic (`src/lib/prereq.ts`)
- Settings page (name, email, graduation info, notification preferences)

**Excluded (configured in `vitest.config.ts`):**

- `src/components/ui/**` — auto-generated Chakra UI v3 wrappers
- `src/__tests__/**` — test files themselves
- `**/*.d.ts` — TypeScript type declarations
- `**/*.config.*` — configuration files
- `src/types/**` — type definitions
- `src/proxy.ts` — dev proxy utility
- `src/app/auth/**/route.ts` — server-side auth route handlers
- `src/app/**/layout.tsx` — Next.js layout components
- `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts` — Supabase client factories
- `src/utils/supabase/**` — Supabase utility wrappers

## 4. Coverage Trend

| Metric | Sprint 1 | Sprint 2 | Change |
|--------|----------|----------|--------|
| Line coverage | 85.32% | 93.19% | +7.87% |
| Branch coverage | 76.88% | 81.88% | +5.00% |
| Function / Method coverage | 70.11% | 87.28% | +17.17% |
| Statement coverage | 85.32% | 93.19% | +7.87% |

All four categories now exceed 80%, up from only two in Sprint 1. Function coverage saw the largest gain (+17.17%), driven by new planner component tests and fixes to dashboard state-setter wiring.

## 5. Weak Areas

| # | File | Coverage | Reason |
|---|------|----------|--------|
| 1 | `src/app/dashboard/page.tsx` | 80.86% Stmts / 65% Branch | Complex dashboard with many conditional branches for reset, change-major, and loading states |
| 2 | `src/lib/supabase/queries/onboarding.ts` | 86.75% Stmts / 62.29% Branch | Deep error-handling paths and edge cases in multi-step save logic not fully exercised |
| 3 | `src/components/requirements/RequirementsDashboard.tsx` | 91.22% Stmts / 70.73% Branch | Conditional rendering for elective/requirement block display not fully branched |

## 6. Evidence

Coverage report generated via:

```bash
npx vitest run --coverage
```

HTML report available at `coverage/index.html` after running the command above.

## 7. Statement of Integrity

This coverage was generated from automated tests executed during this sprint.
