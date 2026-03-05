# GradTracker Frontend

GradTracker is a graduation planning app for university students. It helps users set up their program, track requirement progress, and build semester-by-semester plans.

## Current Features

- Authentication: sign up, sign in, forgot password, and reset password flows (Supabase Auth)
- Onboarding wizard: select program and completed coursework to initialize tracking
- Dashboard: progress summary, requirement breakdown, current courses, and quick actions
- Requirements view: detailed requirement progress by category
- Course catalog: searchable/filterable course list
- Planner: multi-plan semester planner with drag-and-drop course scheduling
- Settings: profile, email update, expected graduation term/year, and notification preferences

## Tech Stack

- Next.js 16 (App Router)
- React 19
- TypeScript 5
- Chakra UI v3
- Supabase (`@supabase/supabase-js` + SSR helpers)
- Vitest + Testing Library

## Getting Started

### Prerequisites

- Node.js 20+
- npm 9+

### Installation

```bash
git clone <repository-url>
cd grad-tracker-frontend
npm install
```

### Environment Variables

Create a `.env.local` file:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
# Optional fallback key used in some auth/session paths:
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=your_supabase_publishable_key
```

### Run Locally

```bash
npm run dev
```

Open `http://localhost:3000`.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build production app |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run test` | Run unit/integration tests once |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run skills:validate` | Validate canonical skill metadata/structure |
| `npm run skills:sync` | Regenerate `.claude/skills` from `.agents/skills` |
| `npm run skills:check` | Fail if generated Claude skills drift from canonical skills |

## Branching, PR, and Quality Gates

- Branch flow: `feature/* -> dev -> main`
- Direct pushes to `dev` and `main` are not allowed; all changes must go through pull requests
- Coverage gate workflow runs on pull requests to `dev` and enforces 80% thresholds for lines/functions/branches/statements
- Main branch PRs run SonarCloud analysis and test coverage
- CodeRabbit auto-reviews pull requests targeting `dev` (and `main`)

## Project Structure

```text
src/
  app/
    auth/                # Auth callback routes
    dashboard/           # Dashboard pages (planner, courses, requirements, settings, onboarding)
    signin|signup|forgot-password|reset-password
  components/
    dashboard/           # Dashboard shell, header, sidebar
    onboarding/          # Onboarding wizard steps
    planner/             # Planner dialogs, grids, cards, summaries
    requirements/        # Requirements dashboard UI
    ui/                  # Chakra UI wrappers/primitives
  lib/
    supabase/            # Supabase clients + query modules
  __tests__/             # App, component, query, and lib tests
```

## Cross-Agent Skills

This repo uses a shared skills model so Claude and Codex can use the same project skills.

- Canonical source: `.agents/skills`
- Generated mirror: `.claude/skills`
- Do not hand-edit generated files under `.claude/skills`

### Skill Workflow

1. Edit or add skills only in `.agents/skills/<skill-name>/SKILL.md`.
2. Keep `.agents/skills/manifest.json` updated with every skill folder name.
3. Run `npm run skills:validate`.
4. Run `npm run skills:sync`.
5. Commit both `.agents/skills` and generated `.claude/skills` changes.

CI runs `npm run skills:check` to enforce sync.

## Resources

- [Next.js Docs](https://nextjs.org/docs)
- [Chakra UI Docs](https://chakra-ui.com/docs)
- [Supabase Docs](https://supabase.com/docs)
- [Vitest Docs](https://vitest.dev)
