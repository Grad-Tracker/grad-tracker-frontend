# Sprint 5 Jira Report — Arjun Nyein

## Project Information
- **Jira Project:** Grad Tracker (GT)  
- **Project Link:** https://lab-signoff-app.atlassian.net/jira/software/projects/GT/boards/68  
- **Sprint:** Sprint 5  
- **Data captured on:** 2026-04-21  

---

## Sprint Work Completed (Done)
- **GT-174** — Replaced hard-coded hex colors across key auth and landing pages with Chakra semantic tokens; migrated gradient declarations to Chakra v3 props where needed  
- **GT-175** — Cleaned up dead and duplicate files; centralized Gen-Ed bucket and course loading into a shared Supabase query helper used by both the Gen-Ed admin page and client refresh path  
- **GT-177** — Fixed font variable references on error/not-found pages to consistently use the project font (`var(--font-dm-sans)`)  
- **GT-181** — Improved contrast/accessibility by adjusting low-contrast color tokens (e.g., `.400/.500` → `.600`) in password strength, signup indicators, AI advisor status, and planner UI highlights  
- **GT-182** — Added and updated page metadata titles for dashboard and admin routes so browser tabs show the correct page name instead of generic titles  
- **GT-196** — Completed ARIA labels and accessibility audit: added missing `aria-label` attributes on icon-only buttons, improved keyboard activation (Enter/Space) for non-native clickable elements, and verified via tests and Lighthouse browser audit  

---

## Sprint Commitment vs Delivery

| Metric | Count |
|---|---:|
| Issues committed at sprint start | 6 |
| Issues completed | 6 |
| Issues not completed | 0 |
| Issues added mid-sprint | 0 |

---

## Issue Breakdown by Type

| Type | To Do | In Progress | Done |
|---|---:|---:|---:|
| Story | 0 | 0 | 3 |
| Task | 0 | 0 | 2 |
| Bug | 0 | 0 | 1 |

---

## Per-Student Work Allocation

| Student | Issues Assigned | Issues Completed |
|---|---:|---:|
| Arjun Nyein | 6 | 6 |

---

## Estimation & Accuracy

| Metric | Value |
|---|---:|
| Total story points committed | N/A |
| Total story points completed | N/A |
| Completion % | 100% |

---

## Workflow Discipline
- ☑ Issues moved through workflow states (To Do → In Progress → Done)  
- ☑ Issues closed only after acceptance criteria met  
- ☑ Sprint completed/closed in Jira  

---

## Blockers & Scope Changes
- **Major blockers:** Review feedback loops from CodeRabbit (typing, a11y, and UI correctness) and ensuring changes stayed compatible with Chakra UI v3 APIs.  
- **Scope changes:** Several "cleanup" tasks expanded into small refactors to keep behavior consistent while removing duplication (Gen-Ed query helper) and improving production readiness (metadata, a11y, contrast).  
- **Why work spilled over (if any):** N/A — all 6 issues completed within the sprint.  

---

## Jira Evidence Links (No Screenshots)
- **Sprint Report:**  
  https://lab-signoff-app.atlassian.net/jira/software/projects/GT/boards/68/reports/burnup  

- **Backlog:**  
  https://lab-signoff-app.atlassian.net/jira/software/projects/GT/boards/68/backlog  

- **Board (Filtered to Sprint):**  
  https://lab-signoff-app.atlassian.net/jira/software/projects/GT/boards/68  

---

## Required Statement
"This report was generated using Jira sprint artifacts during this sprint."
