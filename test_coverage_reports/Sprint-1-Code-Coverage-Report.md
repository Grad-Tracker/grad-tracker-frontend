# Sprint 1 — Code Coverage Report

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
| Line coverage | 85.32% |
| Branch coverage | 76.88% |
| Function / Method coverage | 70.11% |
| Statement coverage | 85.32% |

## 3. Scope of Coverage

**Included:**

- Auth pages — signin, signup, forgot-password, reset-password
- Dashboard page
- Course catalog
- Onboarding wizard (multi-step flow)
- Landing page
- Gen-ed requirements display
- Supabase query helpers (`src/lib/supabase/queries/`)

**Excluded (configured in `vitest.config.ts`):**

- `src/components/ui/**` — auto-generated Chakra UI v3 wrappers
- `**/*.d.ts` — TypeScript type declarations
- `**/*.config.*` — configuration files
- `.next/**` — Next.js build output

## 4. Coverage Trend

Baseline sprint — no prior data for comparison.

## 5. Weak Areas

| # | File | Coverage | Reason |
|---|------|----------|--------|
| 1 | `src/proxy.ts` | 0% | Dev-only proxy utility with no runtime logic to test |
| 2 | `src/app/auth/callback/route.ts` | 0% | Server-side OAuth callback; requires integration test setup not yet in place |
| 3 | `src/components/onboarding/OnboardingWizard.tsx` | 64.54% | Complex multi-step wizard with many conditional branches |

## 6. Evidence

Coverage report generated via:

```bash
npx vitest run --coverage
```

HTML report available at `coverage/index.html` after running the command above.

## 7. Statement of Integrity

This coverage was generated from automated tests executed during this sprint.
