# Sprint 3 — Code Coverage Report

## 1. Tool & Setup

| Item | Detail |
|------|--------|
| Language | TypeScript |
| Framework | Next.js 16 (App Router), React 19 |
| Test Framework | Vitest 3.2.4 + @testing-library/react |
| Coverage Tool | @vitest/coverage-v8 (V8 provider) |

## 2. Coverage Metrics

| Metric | Percentage |
|--------|-----------|
| Line coverage | 86.45% |
| Branch coverage | 81.30% |
| Function / Method coverage | 84.93% |
| Statement coverage | 86.45% |

## 3. Scope of Coverage

**Included:**

- Auth pages — signin, signup, forgot-password, reset-password
- Dashboard page (with reset progress & change major flows)
- Course catalog (CoursesClient)
- Onboarding wizard (multi-step flow, program/class selection, review)
- Landing page
- Planner — plan CRUD, semester management, course drag-and-drop, breadth/graduate selectors, gen-ed progress
- Gen-ed and degree requirements display
- Dashboard shell, header, and sidebar
- Admin pages — admin dashboard, courses management, gen-ed management, programs editor, program detail, admin signup, admin layout auth guard
- Settings page (name, email, graduation info, class history, course search, checklists)
- Supabase query helpers (`src/lib/supabase/queries/` — onboarding, planner, courses, classHistory, schema)
- Prerequisite parsing logic (`src/lib/prereq.ts`, `prereq-graph.ts`)
- Plan validation and auto-generation (`src/lib/planner/`)

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

| Metric | Sprint 1 | Sprint 2 | Sprint 3 | Change (S2→S3) |
|--------|----------|----------|----------|----------------|
| Line coverage | 85.32% | 93.19% | 86.45% | -6.74% |
| Branch coverage | 76.88% | 81.88% | 81.30% | -0.58% |
| Function / Method coverage | 70.11% | 87.28% | 84.93% | -2.35% |
| Statement coverage | 85.32% | 93.19% | 86.45% | -6.74% |

Coverage dipped across all metrics compared to Sprint 2. The primary cause is newly added pages that lack test coverage — most notably the AI Advisor page (`app/dashboard/ai-advisor/page.tsx` at 0% coverage), the onboarding pages (`app/dashboard/onboarding/` at 0%), and the `CollaborateDialog.tsx` planner component (0% / 854 lines). These large untested files pulled down the overall averages despite existing tests remaining healthy.

## 5. Weak Areas

| # | File | Coverage | Reason |
|---|------|----------|--------|
| 1 | `src/app/dashboard/ai-advisor/page.tsx` | 0% Stmts | Newly added page with no tests at all |
| 2 | `src/components/planner/CollaborateDialog.tsx` | 0% Stmts (854 lines) | Large new dialog component with no tests, significantly dragging down planner folder coverage |
| 3 | `src/lib/supabase/queries/planner.ts` | 73.06% Stmts / 87.4% Branch | Many untested query helper functions for newer planner features (lines 583–703) |

## 6. Evidence

Coverage report generated via:

```bash
npx vitest run --coverage
```

HTML report available at `coverage/index.html` after running the command above.

## 7. Statement of Integrity

This coverage was generated from automated tests executed during this sprint.
