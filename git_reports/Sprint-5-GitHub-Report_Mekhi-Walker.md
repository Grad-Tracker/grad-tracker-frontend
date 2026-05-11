# Sprint 5 — GitHub Activity Report

**Student:** Mekhi Walker
**GitHub Username:** walke111
**Sprint Dates:** 2026-04-08 — 2026-04-21

---

## Repository

https://github.com/Grad-Tracker/grad-tracker-frontend

---

## Pull Requests Merged This Sprint

| PR Title | Link | Author | Reviewers | Merge Date |
|----------|------|--------|-----------|------------|
| feat(GT-178/186/189): add Atlas UI, conversation history, plan creation, test coverage to 80%+ | [#108](https://github.com/Grad-Tracker/grad-tracker-frontend/pull/108) | walke111 | coderabbitai, mjack6182 | 2026-04-21 |
| feat(atlas): expand advisor capabilities and fix UI bugs (max_tokens, maxTurns, onboarding gate, PlanSwitcher) | [#112](https://github.com/Grad-Tracker/grad-tracker-frontend/pull/112) | walke111 | coderabbitai, mjack6182 | 2026-04-21 |
| docs: add Sprint 4 GitHub and Jira reports for Mekhi Walker | [#92](https://github.com/Grad-Tracker/grad-tracker-frontend/pull/92) | walke111 | coderabbitai | 2026-04-19 |

_Total PRs merged: 3_

---

## PR Summaries

### PR #108 — Atlas UI, conversation history, plan creation + test coverage

**Changes (+10,856 / −424):**
- Built `ConversationList` component for browsing and resuming prior Atlas conversations
- Built `PlanSwitcher` component for switching active plans from within the Atlas drawer
- Updated `ChatInterface` and `AdvisorSidebar` with richer loading/status indicators and history-aware rendering
- Added AI advisor API routes: `conversations/[id]/messages` and `plans`
- Expanded `plan-mutations.ts`, `tools.ts`, and `data.ts` with Atlas plan management tooling
- Fixed tsconfig `jsx` setting (`react-jsx` → `preserve`) for Next.js 16 compatibility; removed `baseUrl` incompatible with `moduleResolution: bundler`
- Added 189 new Vitest tests across 5 files (`plan-mutations`, `activity`, `classHistory`, `onboarding`, `planner` queries) to push all 4 coverage metrics above 80%
- Resolved merge conflicts with `dev` across `dashboard/page.tsx`, `ChatInterface.tsx`, `PlannerSummary.tsx`, and `tsconfig.json`

---

### PR #112 — Atlas advisor bug fixes and pre-onboarding catalog access

**Changes (+67 / −24):**
- Raised `max_tokens` from 1024 → 5000 and `maxTurns` from 6 → 20 in both the stream route and `runClaudeToolCalling` to prevent JSON truncation and tool-call timeouts on complex workflows
- Removed the `hasCompletedOnboarding` 409 gate; replaced with tool-set filtering: pre-onboarding students get `CATALOG_TOOL_DEFINITIONS` (11 read-only catalog tools), fully-onboarded students get all tools
- Added `CATALOG_TOOL_NAMES` and `CATALOG_TOOL_DEFINITIONS` exports to `tools.ts`; added intentions, tone, escalation, and history-use guidance to the Atlas system prompt in `prompt.ts`
- Fixed `PlanSwitcher` dropdown rendering above the viewport (`bottom` → `top` positioning)
- Updated `chat.route.test.ts`: added missing mock exports (`CLAUDE_TOOL_DEFINITIONS`, `CATALOG_TOOL_DEFINITIONS`) and updated stale 409 onboarding test to expect 200

---

### PR #92 — Sprint 4 documentation

**Changes (+147 / −0):**
- Added Sprint 4 GitHub and Jira reports for Mekhi Walker to the `git_reports/` and `jira_reports/` directories

---

## Commit Activity

| Metric | Value |
|--------|-------|
| Total Commits | 13 |
| First Commit | 2026-04-08 |
| Last Commit | 2026-04-21 |

---

## Notes

- Only PRs **merged** to any branch are counted; closed/unmerged PRs are excluded.
- Direct pushes to `main` are not counted per project rules.
- Commit count includes all commits authored by walke111 in the sprint window, including merge commits.
- PR #108 and PR #112 are sequential iterations of the same feature branch (`feature/GT-178-186-189-atlas-ui`); each was a separate merge into `dev`.
