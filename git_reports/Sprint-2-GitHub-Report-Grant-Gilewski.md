# Sprint-2-GitHub-Report.md

## Repository
- **Repo:** Grad-Tracker / grad-tracker-frontend  
- **Repo URL:** https://github.com/Grad-Tracker/grad-tracker-frontend

## Sprint Info
- **Sprint Name:** Sprint 2
- **Date Range:** Feb 17, 2026 – Mar 3, 2026
- **Contributor (focus):** GrantGilewski

---

## Summary of What Changed This Sprint (GitHub View)

During Sprint 2, the frontend repo saw a heavy focus on:
- Requirements UI improvements + prerequisite visibility
- Settings / dashboard enhancements
- Test suite + coverage improvements
- Planner page iteration
- Reliability/performance work tied to onboarding + dashboard query patterns

---

## PR Activity (Sprint Window)

> Filter used: PRs closed between **2026-02-17..2026-03-03**

| PR | Title | Author | Result | Date |
|---:|---|---|---|---|
| #30 | Dev | mjack6182 | Merged | Mar 3, 2026 |
| #29 | Khi dev | walke111 | Merged | Mar 3, 2026 |
| #28 | Grant dev | mjack6182 | Merged | Mar 3, 2026 |
| #27 | Add settings page, improve dashboard, and enhance test coverage | walke111 | Closed | Mar 3, 2026 |
| #26 | Add settings page, improve dashboard, and fix test suite | walke111 | Closed | Mar 3, 2026 |
| #25 | Parallelized and Onboarding Wizard updates | **GrantGilewski** | Closed | Mar 3, 2026 |
| #24 | test: exclude app wrappers from coverage | ArjunNyein | Closed | Mar 3, 2026 |
| #23 | Khi dev | walke111 | Closed | Mar 3, 2026 |
| #22 | Requirements: prereq warnings + UI improvements + tests | ArjunNyein | Merged | Mar 3, 2026 |
| #21 | refactor: update font families across components to use new CSS variables | mjack6182 | Merged | Mar 2, 2026 |
| #20 | Test/coverage improvement | mjack6182 | Merged | Mar 1, 2026 |
| #19 | Add settings page, dashboard improvements, and fix test suite | walke111 | Closed | Mar 3, 2026 |
| #18 | Planner page | mjack6182 | Closed | Mar 1, 2026 |
| #17 | Planner page | mjack6182 | Closed | Feb 28, 2026 |
| #16 | Refine completed course styling and restore clean success state | ArjunNyein | Merged | Feb 25, 2026 |
| #15 | Sprint2 requirements blocks | ArjunNyein | Merged | Feb 25, 2026 |
| #14 | Sprint 2 – Requirements dashboard + layout fixes | ArjunNyein | Merged | Feb 23, 2026 |
| #13 | Dev | mjack6182 | Merged | Feb 18, 2026 |
| #12 | Sprint 1 Finished | mjack6182 | Merged | Feb 17, 2026 |
| #11 | Connect Dashboard with Real Data | **GrantGilewski** | **Merged** | Feb 17, 2026 |

---

## Your Sprint 2 PRs (GrantGilewski)

| PR | Title | Result | Notes |
|---:|---|---|---|
| #11 | Connect Dashboard with Real Data | **Merged** | Switched dashboard from mock → real data (linked to Jira tasks noted in PR discussion). |
| #25 | Parallelized and Onboarding Wizard updates | Closed | PR proposed dashboard query parallelization + onboarding reliability + expanded tests (work may have been rebased/superseded depending on merge strategy). |

---

## Notable Engineering Contributions (from your PR descriptions)

### PR #11 — Connect Dashboard with Real Data
- Connected dashboard to production Supabase-backed data instead of mock data.
- Merged into `dev` on Feb 17, 2026.

### PR #25 — Parallelized and Onboarding Wizard updates (Closed)
This PR bundled several improvements:
- Parallelized dashboard data fetching to reduce “waterfall” latency.
- Improved onboarding save reliability (cleanup + idempotent upserts) and added better error handling.
- Hardened planner page error handling and added loading overlays.
- Significantly expanded tests and mocking scaffolding (dashboard, onboarding, planner, and DnD flows).
- Adjusted UI typography in onboarding/dashboard.

---

## Evidence Links

### Repo
- https://github.com/Grad-Tracker/grad-tracker-frontend

### PR list (Sprint window)
- https://github.com/Grad-Tracker/grad-tracker-frontend/pulls?q=is%3Apr+is%3Aclosed+closed%3A2026-02-17..2026-03-03

### Your PR list (Sprint window)
- https://github.com/Grad-Tracker/grad-tracker-frontend/pulls?q=is%3Apr+author%3AGrantGilewski+is%3Aclosed+closed%3A2026-02-17..2026-03-03

### Direct PR links
- PR #11: https://github.com/Grad-Tracker/grad-tracker-frontend/pull/11
- PR #25: https://github.com/Grad-Tracker/grad-tracker-frontend/pull/25
