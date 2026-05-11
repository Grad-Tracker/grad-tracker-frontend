# GradTracker — Frontend

[![Coverage Gate](https://github.com/Grad-Tracker/grad-tracker-frontend/actions/workflows/coverage-gate.yml/badge.svg?branch=dev)](https://github.com/Grad-Tracker/grad-tracker-frontend/actions/workflows/coverage-gate.yml)
[![Maestro E2E](https://github.com/Grad-Tracker/grad-tracker-frontend/actions/workflows/maestro.yml/badge.svg?branch=dev)](https://github.com/Grad-Tracker/grad-tracker-frontend/actions/workflows/maestro.yml)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=Grad-Tracker_grad-tracker-frontend&metric=alert_status)](https://sonarcloud.io/project/overview?id=Grad-Tracker_grad-tracker-frontend)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=Grad-Tracker_grad-tracker-frontend&metric=coverage)](https://sonarcloud.io/project/overview?id=Grad-Tracker_grad-tracker-frontend)

GradTracker is a university graduation planning application. Students use it to track degree requirements, build semester-by-semester course plans, and get AI-powered academic advising. Academic advisors use the admin portal to oversee their students' progress, manage programs, and administer the course catalog.

This repo is the **frontend**. A separate backend repo handles server-side data processing. This README is written for developers taking over or joining the project.

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [Getting Started](#getting-started)
3. [Environment Variables](#environment-variables)
4. [npm Scripts](#npm-scripts)
5. [Project Structure](#project-structure)
6. [Features](#features)
7. [Atlas AI Advisor](#atlas-ai-advisor)
8. [User Roles](#user-roles)
9. [Branching, PRs, and CI](#branching-prs-and-ci)
10. [Testing](#testing)
11. [End-to-End Testing (Maestro)](#end-to-end-testing-maestro)
12. [Cross-Agent Skills](#cross-agent-skills)
13. [Resources](#resources)

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| Framework | Next.js 16.2 (App Router, Turbopack) |
| UI | React 19, Chakra UI v3, Emotion |
| Language | TypeScript 5 |
| Database / Auth | Supabase (PostgreSQL + Auth) |
| AI | Anthropic SDK (`@anthropic-ai/sdk`) |
| Drag-and-Drop | dnd-kit (`@dnd-kit/core`, `@dnd-kit/sortable`) |
| Rich Text | TipTap v3 |
| Testing | Vitest 3 + Testing Library + jsdom |
| E2E Testing | Maestro (Chromium browser flows) |
| Linting | ESLint 9 |
| CI | GitHub Actions, SonarCloud, CodeRabbit |

> **Chakra UI v3 note:** The API is substantially different from v2. Do not follow v2 docs or examples. Use semantic tokens (`bg.subtle`, `fg.muted`, `border`) rather than hard-coded colors. Import components from `src/components/ui/` wrappers when available.

---

## Getting Started

**Prerequisites:** Node.js 20+, npm 9+

```bash
# 1. Clone and install
git clone <repository-url>
cd grad-tracker-frontend
npm install

# 2. Set up environment variables
cp .env.example .env.local
# Fill in your Supabase and Anthropic credentials (see below)

# 3. Start the dev server
npm run dev
```

The app runs at `http://localhost:3000`.

---

## Environment Variables

Create `.env.local` at the project root:

```bash
# Supabase — required
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=<your-publishable-key>

# Atlas AI Advisor — server-side only, never prefix with NEXT_PUBLIC_
ANTHROPIC_API_KEY=<your-anthropic-api-key>

# Optional: override the model Atlas uses (defaults to claude-haiku-4-5-20251001)
# ANTHROPIC_MODEL=claude-sonnet-4-6
```

`ANTHROPIC_API_KEY` is consumed only in server-side API routes. Never expose it to the browser.

---

## npm Scripts

### Development

| Script | What it does |
| --- | --- |
| `npm run dev` | Start Next.js dev server with Turbopack |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | Run ESLint |

### Test Scripts

| Script | What it does |
| --- | --- |
| `npm test` | Run Vitest once |
| `npm run test:watch` | Vitest in watch mode |
| `npm run test:coverage` | Run tests with V8 coverage report |

### Data Scripts

These scripts maintain academic data integrity in the database. Run them when seeding or auditing course/major data.

**Majors**

| Script | What it does |
| --- | --- |
| `npm run majors:audit` | Audit major records for inconsistencies |
| `npm run majors:link-fix` | Fix broken major-to-course mappings |
| `npm run majors:verify` | Verify major structure is valid |

**Courses**

| Script | What it does |
| --- | --- |
| `npm run courses:audit` | Audit course records |
| `npm run courses:link-audit` | Audit course link integrity |
| `npm run courses:link-fix` | Fix broken course links |
| `npm run courses:sync` | Sync course data |

**Skills**

| Script | What it does |
| --- | --- |
| `npm run skills:sync` | Mirror `.agents/skills/` → `.claude/skills/` |
| `npm run skills:validate` | Validate skill metadata |
| `npm run skills:check` | Assert generated skills are in sync (used by CI) |

---

## Project Structure

```text
src/
├── app/                          # Next.js App Router
│   ├── layout.tsx                # Root layout (Chakra Provider, fonts)
│   ├── page.tsx                  # Landing page (/)
│   ├── error.tsx
│   ├── not-found.tsx
│   │
│   ├── signin/                   # /signin
│   ├── signup/                   # /signup
│   ├── forgot-password/          # /forgot-password
│   ├── reset-password/           # /reset-password
│   ├── auth/callback/            # /auth/callback — Supabase OAuth redirect handler
│   │
│   ├── dashboard/                # Student-facing area (requires auth)
│   │   ├── layout.tsx
│   │   ├── page.tsx              # /dashboard — home with progress summary
│   │   ├── courses/              # /dashboard/courses — course catalog
│   │   ├── planner/              # /dashboard/planner — semester planner
│   │   ├── requirements/         # /dashboard/requirements — degree audit
│   │   │   └── [id]/             # /dashboard/requirements/:id — requirement detail
│   │   ├── settings/             # /dashboard/settings
│   │   └── onboarding/wizard/    # /dashboard/onboarding/wizard — first-run wizard
│   │
│   ├── admin/                    # Advisor/admin portal
│   │   ├── signin/               # /admin/signin
│   │   ├── (public)/signup/      # /admin/signup — advisor sign-up with gate code
│   │   └── (protected)/          # Gate-protected admin routes
│   │       ├── page.tsx          # /admin — admin dashboard
│   │       ├── programs/         # /admin/programs
│   │       │   └── [programId]/  # /admin/programs/:id
│   │       ├── courses/          # /admin/courses
│   │       ├── gen-ed/           # /admin/gen-ed
│   │       ├── assignments/      # /admin/assignments
│   │       └── students/         # /admin/students
│   │           └── [studentId]/  # /admin/students/:id (+ /planner sub-route)
│   │
│   ├── shared/                   # Public plan-sharing viewer
│   │   ├── plans/                # /shared/plans
│   │   └── plan/[shareToken]/    # /shared/plan/:token
│   │
│   └── api/                      # Server-side API routes
│       ├── ai-advisor/
│       │   ├── chat/stream/      # POST — Atlas streaming chat
│       │   ├── context/          # GET — Atlas student context
│       │   ├── conversations/    # GET/POST conversation list
│       │   │   └── [id]/messages/
│       │   └── plans/            # Atlas plan mutation endpoints
│       ├── advisor/
│       │   ├── verify-signup-code/
│       │   └── consume-signup-gate/
│       ├── shared-plans/         # Shared plan CRUD
│       └── student/
│           ├── change-major/
│           └── reset-progress/
│
├── components/
│   ├── admin/                    # AdminShell, AdminHeader, AdminSidebar
│   ├── auth/                     # AuthPageLayout, PasswordStrength, RoleSignInForm
│   ├── dashboard/                # DashboardShell, DashboardHeader, DashboardSidebar, AtlasFAB, AtlasPanel
│   │   └── ai-advisor/           # ChatInterface, AdvisorSidebar, ConversationList, PlanSwitcher
│   ├── onboarding/               # OnboardingWizard, ProgramSelectionStep, ClassSelectionStep, ReviewStep, WizardNavigation
│   ├── planner/                  # 20+ components: SemesterGrid, SemesterColumn, DraggableCourseCard,
│   │                             #   AutoGenerateDialog, CreatePlanDialog, CourseDetailDrawer, PlanSwitcher…
│   ├── requirements/             # RequirementsDashboard, GenEdRequirements, RequirementsSkeleton
│   ├── settings/                 # ClassHistoryTab, MajorChecklist, GenEdChecklist, AdditionalCourses,
│   │                             #   CourseSearchDialog, ManualCourseForm
│   ├── shared/                   # BaseSidebar, LayoutShell, ConfirmationDialog, RequirementCard, SkeletonParts
│   ├── shared-plans/             # ComparePlanPicker, SharedPlanComparePicker
│   ├── ui/                       # 80+ Chakra UI snippet wrappers (dialog, drawer, menu, toaster, select…)
│   └── LandingPage.tsx
│
├── lib/
│   ├── ai-advisor/               # Atlas AI subsystem
│   │   ├── prompt.ts             # System prompt
│   │   ├── data.ts               # Context data fetching for Atlas
│   │   ├── persistence.ts        # Conversation storage (Supabase)
│   │   ├── plan-mutations.ts     # Plan write operations called by tools
│   │   └── tools/                # 51 individual tool implementations
│   │       └── shared/           # Shared tool utilities (deps, names, response, utils)
│   ├── planner/                  # Planning engine (client-side)
│   │   ├── auto-generate.ts      # Course scheduling algorithm
│   │   ├── auto-generate-orchestrator.ts
│   │   ├── prereq-graph.ts       # Prerequisite DAG construction
│   │   ├── prereq-validation.ts  # Real-time prerequisite warnings
│   │   └── validate-plan.ts      # Full plan validation
│   ├── supabase/                 # Database layer
│   │   ├── client.ts             # Browser Supabase client
│   │   ├── server.ts             # Server Supabase client (SSR)
│   │   ├── admin.ts              # Service-role client (server only)
│   │   └── queries/              # Typed query functions
│   │       ├── courses.ts
│   │       ├── planner.ts
│   │       ├── classHistory.ts
│   │       ├── gen-ed.ts
│   │       ├── shared-plans.ts
│   │       ├── advisor-students.ts
│   │       ├── onboarding.ts
│   │       ├── activity.ts
│   │       ├── schema.ts
│   │       └── view-types.ts
│   ├── hooks/
│   │   └── useUserProfile.ts
│   ├── prereq.ts                 # Prerequisite expression parsing and evaluation (22 KB)
│   ├── auth-helpers.ts           # Client-side auth utilities
│   ├── auth-helpers.server.ts    # Server-side auth utilities
│   ├── academic-term.ts          # Term/semester utilities
│   ├── advisor-signup-gate.ts    # Advisor gate-code logic
│   ├── email-validation.ts
│   └── constants.ts
│
├── types/                        # Shared TypeScript types
│   ├── advisor.ts
│   ├── ai-advisor.ts
│   ├── auto-generate.ts
│   ├── course.ts
│   ├── onboarding.ts
│   ├── planner.ts
│   └── shared-plan.ts
│
├── contexts/
│   └── AtlasPanelContext.tsx     # Atlas panel open/close state
│
├── constants/
│   └── planner.ts
│
└── __tests__/                    # 136 test files mirroring src/ structure
    ├── app/
    ├── components/
    ├── lib/
    ├── helpers/
    ├── mocks/
    └── types/

scripts/
├── courses/                      # Course data integrity scripts
├── majors/                       # Major data integrity scripts
├── skills/                       # Skills sync/validate scripts
├── perf/                         # Performance benchmarking
└── coverage/                     # Coverage analysis

.agents/skills/                   # Canonical skill definitions (edit these)
.claude/skills/                   # Generated mirror (never edit directly)
```

---

## Features

### Authentication

Email/password sign-in and sign-up via Supabase Auth. Includes forgot-password and reset-password flows. Route protection is enforced by `src/proxy.ts` (Next.js 16's replacement for `middleware.ts`). After first sign-up, students are redirected to the onboarding wizard.

> **Supabase sign-up quirk:** `supabase.auth.signUp()` does not return an error when the email already exists (to prevent enumeration). Detect duplicates by checking `data.user?.identities?.length === 0`.

### Onboarding Wizard

Three-step wizard at `/dashboard/onboarding/wizard` for new students: select a degree program, mark completed coursework, and confirm. Runs once on first login; students can revisit from Settings.

### Dashboard

Student home at `/dashboard`. Shows a progress summary (credits completed, requirement-block completion), a breakdown of requirement categories, current-semester courses, and quick-action shortcuts.

### Requirements View

Full degree audit at `/dashboard/requirements`. Lists every requirement block (major core, gen-ed categories, electives) and shows which courses satisfy each block. Drill into a specific block at `/dashboard/requirements/:id`.

### Course Catalog

Searchable, filterable course browser at `/dashboard/courses`. Displays course title, credits, subject, and prerequisite status relative to the student's history.

### Semester Planner

Multi-plan drag-and-drop planner at `/dashboard/planner`. Students can:

- Create and switch between named plans
- Add and remove semesters
- Drag courses between semesters (dnd-kit)
- Run **auto-generate** to build a full schedule that respects prerequisites and credit-load limits
- See inline prerequisite warnings
- Share a read-only link to any plan

**Atlas AI Advisor** — AI chat assistant embedded in the dashboard. See the [Atlas AI Advisor](#atlas-ai-advisor) section for full details.

### Admin Portal

Advisor-facing area at `/admin`. Advisors must sign up at `/admin/signup` with a one-time gate code. Features:

- **Students** — list all assigned students; open any student's planner in read/write mode
- **Programs** — create and edit degree programs and requirement blocks
- **Courses** — manage the course catalog
- **Gen-Ed** — manage general education requirement categories
- **Assignments** — assign students to specific advisors

### Plan Sharing

Students can generate a shareable link to a plan. Anyone with the link can view it at `/shared/plan/:token` and compare two shared plans side-by-side.

---

## Atlas AI Advisor

Atlas is the AI academic advisor embedded in the student dashboard. It is built on the **Anthropic SDK** and uses **streaming responses**.

**Architecture:**

- The floating action button (`AtlasFAB`) opens a slide-in panel (`AtlasPanel`) from any dashboard page
- The panel hosts `ChatInterface`, which streams from `/api/ai-advisor/chat/stream`
- Conversations are stored in Supabase and listed in `ConversationList`
- Before each conversation, Atlas loads the student's profile, course history, active plan, and degree requirements (`src/lib/ai-advisor/data.ts`)

**Tools — 51 total:**

| Category | Example tools |
| --- | --- |
| Course search | `search-courses`, `get-course-details`, `get-course-prerequisites` |
| Degree progress | `get-degree-progress`, `get-remaining-requirements`, `get-program-requirements` |
| Planning | `recommend-next-semester`, `validate-plan`, `get-plan-snapshot`, `identify-plan-gaps` |
| Prerequisite analysis | `check-course-prereqs`, `find-prereq-bottlenecks`, `find-shortest-prereq-path`, `get-full-prereq-chain` |
| Graduation | `check-graduation-readiness`, `project-graduation-date`, `estimate-credits-per-term-needed` |
| Plan mutations | `add-course-to-plan`, `remove-course-from-plan`, `move-course-in-plan`, `create-plan`, `delete-plan`, `duplicate-plan`, `rename-plan` |
| History mutations | `add-course-to-history`, `remove-course-from-history`, `update-course-history` |
| Advising | `generate-advising-summary`, `suggest-course-substitutions`, `find-compatible-minors` |

**Key source files:**

| File | Purpose |
| --- | --- |
| [src/lib/ai-advisor/prompt.ts](src/lib/ai-advisor/prompt.ts) | Atlas system prompt |
| [src/lib/ai-advisor/tools/index.ts](src/lib/ai-advisor/tools/index.ts) | All tool definitions (aggregated) |
| [src/lib/ai-advisor/data.ts](src/lib/ai-advisor/data.ts) | Context fetching |
| [src/lib/ai-advisor/persistence.ts](src/lib/ai-advisor/persistence.ts) | Conversation storage |
| [src/app/api/ai-advisor/chat/stream/route.ts](src/app/api/ai-advisor/chat/stream/route.ts) | Streaming endpoint |
| [src/components/dashboard/ai-advisor/](src/components/dashboard/ai-advisor/) | UI components |

---

## User Roles

| Role | Sign-up URL | Access |
| --- | --- | --- |
| **Student** | `/signup` | Dashboard, planner, requirements, settings, Atlas |
| **Advisor / Admin** | `/admin/signup` (gate code required) | Admin portal + student oversight |

Students sign up with an email and password. Advisors must enter a one-time gate code provisioned by an existing admin. After sign-up, advisors land on the admin dashboard at `/admin`.

---

## Branching, PRs, and CI

**Branch strategy:**

```text
feature/* → dev → main
```

- No direct pushes to `dev` or `main` — all changes go through pull requests.
- Name feature branches `feature/<short-description>`.

**CI on PRs to `dev`:**

- **Coverage gate:** 80% lines, functions, branches, and statements (enforced by Vitest coverage). Failing coverage blocks merge.
- **Maestro E2E:** All five browser flows run against a locally built app. Failing flows block merge.

**CI on PRs/pushes to `main`:**

- **SonarCloud** static analysis runs automatically.
- **CodeRabbit** posts an automated code review on every PR.

---

## Testing

Tests live in `src/__tests__/` and mirror the structure of `src/app/` and `src/components/`.

```bash
npm test                  # Run once
npm run test:watch        # Watch mode
npm run test:coverage     # With V8 coverage report
```

**Key conventions:**

1. **`getAllByText` not `getByText` for Chakra components.** Chakra UI renders accessible duplicates of text nodes in jsdom. `getByText` throws "found multiple elements." Use `getAllByText` and index into the result.

2. **Wrap in `<Provider>`.** Any component that uses Chakra UI must be wrapped in the project's Chakra `Provider` (from `src/components/ui/provider.tsx`) in the test render.

3. **136 test files** cover app routes, components, lib utilities, Supabase queries, and shared types.

4. **Test file placement:** a test for `src/components/planner/SemesterGrid.tsx` lives at `src/__tests__/components/planner/SemesterGrid.test.tsx`.

---

## End-to-End Testing (Maestro)

UI/browser flows are tested with [Maestro](https://maestro.mobile.dev), which drives a real Chromium browser against the running Next.js app.

### Flows

| Flow | File | What It Tests |
| --- | --- | --- |
| Sign In | `.maestro/flows/sign-in.yaml` | Student login → dashboard redirect |
| Auth Redirect | `.maestro/flows/auth-redirect.yaml` | Unauthenticated access to `/dashboard` redirects to `/signin` |
| Dashboard Nav | `.maestro/flows/dashboard-nav.yaml` | Sidebar: Dashboard → Requirements → Planner → Dashboard |
| Requirements View | `.maestro/flows/requirements-view.yaml` | Requirements page renders after authentication |
| Planner View | `.maestro/flows/planner-view.yaml` | Planner page renders after authentication |

### Running Locally

Install the Maestro CLI:

```bash
curl -Ls "https://get.maestro.mobile.dev" | bash
```

Start the app, then in a separate terminal run all flows:

```bash
MAESTRO_BASE_URL=http://localhost:3000 \
MAESTRO_TEST_EMAIL=your@email.com \
MAESTRO_TEST_PASSWORD=yourpassword \
maestro test .maestro/flows/
```

Run a single flow:

```bash
maestro test .maestro/flows/sign-in.yaml
```

### CI Behavior

The `maestro.yml` workflow runs on every pull request to `dev`. It starts the Next.js dev server on port 3000, waits for it to be ready, then runs all five flows using a headless Chromium browser. The JUnit report is uploaded as an artifact (retained 14 days).

### Test Account Setup

The flows require a pre-seeded Supabase test user. Create one in your Supabase dashboard, complete onboarding for that user, then add these GitHub Actions secrets:

- `MAESTRO_TEST_EMAIL` — the test user's email
- `MAESTRO_TEST_PASSWORD` — the test user's password
- `NEXT_PUBLIC_SUPABASE_URL` — same as your `.env.local`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — same as your `.env.local`

---

## Cross-Agent Skills

Claude Code skills are defined canonically in `.agents/skills/` and automatically mirrored to `.claude/skills/`.

**Never hand-edit files in `.claude/skills/`** — they are overwritten on the next sync.

**Workflow:**

1. Edit skill definitions in `.agents/skills/<skill-name>/SKILL.md`
2. Keep `.agents/skills/manifest.json` updated with every skill folder name
3. Validate: `npm run skills:validate`
4. Sync: `npm run skills:sync`
5. Commit both `.agents/skills/` and `.claude/skills/` together

CI enforces sync via `npm run skills:check`. A failed check on a PR means `.agents/skills/` was edited without running `skills:sync`.

**Available skills:**

| Skill | Purpose |
| --- | --- |
| `coverage-report` | Generate a test coverage report summary |
| `create-feature-tests` | Scaffold tests for a new feature |
| `github-report` | Generate a GitHub activity report |

---

## Resources

| Resource | Link |
| --- | --- |
| Next.js Docs | [nextjs.org/docs](https://nextjs.org/docs) |
| Chakra UI v3 Docs | [chakra-ui.com/docs](https://www.chakra-ui.com/docs/get-started/installation) |
| Supabase Docs | [supabase.com/docs](https://supabase.com/docs) |
| Vitest Docs | [vitest.dev/guide](https://vitest.dev/guide/) |
| Anthropic SDK Docs | [docs.anthropic.com](https://docs.anthropic.com/en/api/getting-started) |
| dnd-kit Docs | [docs.dndkit.com](https://docs.dndkit.com) |
| TipTap Docs | [tiptap.dev/docs](https://tiptap.dev/docs/introduction) |
| Maestro Docs | [maestro.mobile.dev/docs](https://maestro.mobile.dev/docs) |
