# Sprint 4 — Code Quality Report

**Generated:** 2026-04-07
**Project:** Grad Tracker Frontend

---

## Summary

| Area | Grade | Detail |
|------|-------|--------|
| Test Coverage | **A** | 85.51% line · 82.00% branch · 85.92% function · 85.51% statement |
| ESLint | **A** | 0 errors · 0 warnings |
| Code Duplication | **D** | 2,097 duplicate blocks across 117 files |
| Code Smells | **C** | 31 total findings |

---

## 1. Test Coverage

| Metric | Percentage |
|--------|-----------|
| Line coverage | 85.51% |
| Branch coverage | 82.00% |
| Function coverage | 85.92% |
| Statement coverage | 85.51% |

**1,226 tests** across **109 test files** — all passing.

### Lowest-Coverage Files

| # | File | Line % | Branch % |
|---|------|--------|----------|
| 1 | `src/app/admin/page.tsx` | 0% | 0% |
| 2 | `src/constants/planner 2.ts` | 0% | 0% |
| 3 | `src/lib/supabase/admin.ts` | 0% | 0% |
| 4 | `src/lib/supabase/queries/view-types.ts` | 0% | 0% |
| 5 | `src/lib/ai-advisor/tools.ts` | 70.65% | 72.86% |

### Coverage Trend

| Metric | Sprint 1 | Sprint 2 | Sprint 3 | Sprint 4 | Change (S3→S4) |
|--------|----------|----------|----------|----------|----------------|
| Line coverage | 85.32% | 93.19% | 86.45% | 85.51% | -0.94% |
| Branch coverage | 76.88% | 81.88% | 81.30% | 82.00% | +0.70% |
| Function coverage | 70.11% | 87.28% | 84.93% | 85.92% | +0.99% |
| Statement coverage | 85.32% | 93.19% | 86.45% | 85.51% | -0.94% |

Line coverage dipped slightly (-0.94%) due to new files added late in the sprint (e.g., `admin.ts`, `view-types.ts`, `planner 2.ts`). Branch and function coverage both improved, reflecting better test quality on existing code. The Sprint 3 weak areas (AI Advisor page at 0%, CollaborateDialog at 0%) have been addressed — AI Advisor now has dedicated tests and the Collaborate dialog was removed during the deduplication campaign.

---

## 2. ESLint Analysis

| Metric | Count |
|--------|-------|
| Errors | 0 |
| Warnings | 0 |

No ESLint issues found — the codebase is fully lint-clean.

---

## 3. Code Duplication

| Metric | Value |
|--------|-------|
| Duplicate code blocks | 2,097 |
| Files with duplication | 117 |

### Top Files with Duplication

| # | File | Duplicate Blocks |
|---|------|-----------------|
| 1 | `src/app/admin/(protected)/courses/CoursesAdminClient.tsx` | 675 |
| 2 | `src/app/admin/courses/CoursesAdminClient.tsx` | 675 |
| 3 | `src/app/admin/(protected)/page.tsx` | 222 |
| 4 | `src/app/admin/page.tsx` | 222 |
| 5 | `src/app/dashboard/courses/CoursesClient.tsx` | 196 |

**Note:** The top 4 entries are mirror copies — `admin/` and `admin/(protected)/` contain duplicate versions of the same files from the protected route group migration. These two pairs alone account for ~1,794 of the 2,097 duplicate blocks. Removing the stale `admin/` copies would significantly reduce the duplication count.

---

## 4. Code Smells

| Smell | Count | Top Files |
|-------|-------|-----------|
| Large files (> 300 lines) | 36 | `planner/page.tsx` (1,184), `ProgramAdminDetailClient.tsx` (1,064), `CoursesClient.tsx` (1,031) |
| `as any` casts | 20 | `GenEdAdminClient.tsx` (8), `gen-ed/page.tsx` (8), `server-helpers.ts` (3) |
| `console.log` in production | 0 | — |
| TODO / FIXME / HACK | 1 | `settings/page.tsx` (notification preferences TODO) |
| Deeply nested logic | 10 | `ProgramAdminDetailClient.tsx` (2), `ProgramsClient.tsx` (1), `SharedPlanComparePicker.tsx` (2) |

**`as any` context:** All 20 occurrences are working around Supabase view types that lack proper TypeScript definitions. Defining typed interfaces for these views would eliminate them.

---

## 5. Scope

**Test coverage includes:**
- Auth pages — signin, signup, forgot-password, reset-password, auth callback
- Dashboard — home, courses, requirements, planner, settings, error/not-found
- Admin pages — dashboard, courses, gen-ed, programs, program detail, signup, layout guard
- AI Advisor — chat route, context route, data helpers, persistence, prompt, tools
- Planner — plan CRUD, semester management, course drag-and-drop, auto-generation, validation
- Shared plans — browse, compare, share token pages
- Onboarding wizard — multi-step flow, program/class selection, review
- Landing page
- Supabase query helpers — onboarding, planner, courses, classHistory, schema, activity, shared-plans
- Prerequisite parsing — `prereq.ts`, `prereq-graph.ts`
- Utility libraries — academic-term, advisor-signup-gate, auth-helpers, program-colors, subject-colors, email-validation

**Test coverage excludes (via `vitest.config.ts`):**
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
- `src/lib/supabase/queries/shared-plans.ts` — large seed/fallback dataset

---

## 6. Evidence

Coverage generated via:

```bash
npx vitest run --coverage
```

Lint check via:

```bash
npx eslint src/
```

Code duplication and smells detected via local static analysis scripts scanning `src/**/*.{ts,tsx}` (excluding `node_modules`, `.next`, `__tests__`, `src/components/ui/`, and test files).

HTML coverage report: `coverage/index.html`

---

## 7. Statement of Integrity

This report was generated from automated analysis executed during Sprint 4.
