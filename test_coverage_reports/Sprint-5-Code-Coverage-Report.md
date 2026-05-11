# Sprint 5 — Code Coverage Report

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
| Line coverage | 80.29% |
| Branch coverage | 79.86% |
| Function / Method coverage | 80.32% |
| Statement coverage | 80.29% |

## 3. Scope of Coverage

**Included:**

- Auth pages — signin, signup, forgot-password, reset-password, callback route
- Dashboard page (reset progress & change major flows)
- Course catalog (CoursesClient)
- Onboarding wizard (multi-step flow, program/class selection, review)
- Landing page
- Planner — plan CRUD, semester management, course drag-and-drop, breadth/graduate selectors, gen-ed progress, plan sharing
- Gen-ed and degree requirements display
- Dashboard shell, sidebar, and layout components
- AI Advisor (Sage) — chat interface, sidebar, tools, persistence, prompt construction, chat API route
- Admin pages — admin dashboard, courses, gen-ed, programs editor, program detail, admin signup, advisor signup, assignments, students list and overview, layout auth guard
- Settings page (name, email, graduation info, class history, course search, checklists)
- Shared plans — share picker, shared plan page, shared plans hub
- Supabase query helpers (`src/lib/supabase/queries/` — onboarding, planner, courses, classHistory, activity, advisor-students, gen-ed, helpers, schema)
- Prerequisite parsing and graph (`src/lib/prereq.ts`, `prereq-graph.ts`)
- Plan validation, auto-generation, and orchestration (`src/lib/planner/`)
- Academic term, validation, auth helpers, role/subject/program color utilities

**Excluded (configured in `vitest.config.ts`):**

- `src/components/ui/**` — auto-generated Chakra UI v3 wrappers
- `src/__tests__/**` and co-located `*.test.{ts,tsx}` — test files themselves
- `**/*.d.ts` — TypeScript type declarations
- `**/*.config.*`, `next.config.*` — configuration files
- `src/types/**` — type definitions
- `src/proxy.ts` — dev proxy utility
- `src/app/auth/**/route.ts` — server-side auth route handlers
- `src/app/**/layout.tsx` — Next.js layout components
- `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`, `src/lib/supabase/admin.ts` — Supabase client factories
- `src/lib/supabase/queries/shared-plans.ts` — large seed/fallback dataset (static branches would dominate totals)
- `src/lib/supabase/queries/view-types.ts` — pure type declarations
- `src/utils/supabase/**` — Supabase utility wrappers

## 4. Coverage Trend

| Metric | Sprint 1 | Sprint 2 | Sprint 3 | Sprint 5 | Change (S3→S5) |
|--------|----------|----------|----------|----------|----------------|
| Line coverage | 85.32% | 93.19% | 86.45% | 80.29% | -6.16% |
| Branch coverage | 76.88% | 81.88% | 81.30% | 79.86% | -1.44% |
| Function / Method coverage | 70.11% | 87.28% | 84.93% | 80.32% | -4.61% |
| Statement coverage | 85.32% | 93.19% | 86.45% | 80.29% | -6.16% |

Coverage declined across all metrics relative to Sprint 3. The primary cause is new server-side surface area: a suite of AI Advisor API route handlers (`src/app/api/ai-advisor/**/route.ts` — chat stream, conversations, messages, plans, context) plus advisor gate and student mutation routes were added without accompanying tests, and they all register at 0% coverage. The `CollaborateDialog.tsx` and `PlanDrawer.tsx` planner components also remain untested and continue to weigh on the planner folder average. Existing tested areas (auth, dashboard, onboarding, requirements, most of the AI Advisor client) remain healthy at 90%+.

## 5. Weak Areas

| # | File | Coverage | Reason |
|---|------|----------|--------|
| 1 | `src/app/api/ai-advisor/**/route.ts` (chat/stream, conversations, messages, plans, context) | 0% Stmts across the set | New AI Advisor HTTP endpoints added this sprint — no route-level tests yet; the client is tested but the server routes aren't exercised |
| 2 | `src/components/planner/CollaborateDialog.tsx` | 1.75% Stmts | Large collaboration dialog (~850 lines) carried over from Sprint 3 untested; continues to drag down planner folder average |
| 3 | `src/components/planner/PlanDrawer.tsx` | 0% Stmts | Planner drawer component with no tests; large file adds significant uncovered lines |

## 6. Evidence

Coverage report generated via:

```bash
npx vitest run --coverage
```

HTML report available at `coverage/index.html` after running the command above.

## 7. Statement of Integrity

This coverage was generated from automated tests executed during this sprint.
