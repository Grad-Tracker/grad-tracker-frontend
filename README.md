# GradTracker

A graduation progress tracking application that helps university students visualize their path to graduation. Track completed credits, monitor degree requirements, browse course catalogs, and plan future semesters.

## Features

- **Dashboard** - View overall graduation progress, credits completed/in-progress/remaining, and quick access to all features
- **Degree Requirements** - Track progress across General Education, Major Core, Major Electives, and Free Electives
- **Course Catalog** - Browse courses with search and subject filtering, organized by undergraduate and graduate levels
- **Onboarding Wizard** - Guided setup for new students to configure their degree program
- **Dark/Light Mode** - Full theme support

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **UI Library**: Chakra UI v3
- **Backend**: Supabase
- **Language**: TypeScript

## Getting Started

### Prerequisites

- Node.js 18+ (recommended: 20+)
- npm 9+

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd grad-tracker-frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

## Project Structure

```
src/
├── app/
│   ├── dashboard/
│   │   ├── courses/        # Course catalog
│   │   ├── onboarding/     # Onboarding wizard
│   │   └── page.tsx        # Main dashboard
│   ├── layout.tsx          # Root layout with Chakra Provider
│   └── page.tsx            # Landing page
├── components/
│   └── ui/                 # Chakra UI component wrappers
├── lib/                    # Utilities and helpers
└── types/                  # TypeScript types
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run skills:validate` | Validate canonical skill metadata and structure |
| `npm run skills:sync` | Regenerate `.claude/skills` from `.agents/skills` |
| `npm run skills:check` | Fail if generated Claude skills drift from canonical skills |

## Cross-Agent Skills

This repo uses a shared skills model so Claude and Codex can use the same project skills.

- Canonical source: `.agents/skills`
- Generated mirror: `.claude/skills`
- Do not hand-edit generated files under `.claude/skills`

### Skill workflow

1. Edit or add skills only in `.agents/skills/<skill-name>/SKILL.md`.
2. Keep `.agents/skills/manifest.json` updated with every skill folder name.
3. Run `npm run skills:validate`.
4. Run `npm run skills:sync`.
5. Commit both `.agents/skills` and generated `.claude/skills` changes.

CI runs `npm run skills:check` to enforce sync.

## Contributing

1. Create a feature branch
2. Make your changes
3. Run `npm run lint` to check for issues
4. Submit a pull request

## Resources

- [Chakra UI v3 Docs](https://chakra-ui.com/docs)
- [Next.js Docs](https://nextjs.org/docs)
- [Supabase Docs](https://supabase.com/docs)
