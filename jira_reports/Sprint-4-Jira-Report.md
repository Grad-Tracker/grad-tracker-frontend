# Sprint 4 Jira Report — Arjun Nyein

## Project Information
- **Jira Project:** Grad Tracker (GT)  
- **Project Link:** https://lab-signoff-app.atlassian.net/jira/software/projects/GT/boards/68
- **Sprint:** Sprint 4  
- **Data captured on:** 2026-04-07  

---

## Sprint Work Completed (Done)
- Implemented **role-based Sign In UX** (Student vs Advisor) with clear role selection, role-specific copy, and correct redirects  
- Added **advisor signup gating** using an access code + server verification (prevents direct access to advisor signup without verification)  
- Enforced **email domain rules** (students: `@rangers.uwp.edu`, advisors: `@uwp.edu`) across auth flows to reduce mis-logged accounts  
- Added/updated **Vitest coverage** for role switching, redirect behavior, access-code verification, and guard behavior  

---

## Sprint Commitment vs Delivery

| Metric | Count |
|---|---:|
| Issues committed at sprint start | 2 |
| Issues completed | 1 |
| Issues not completed | 1 |
| Issues added mid-sprint | 0 |

---

## Issue Breakdown by Type

| Type | To Do | In Progress | Done |
|---|---:|---:|---:|
| Story | 0 | 0 | 0 |
| Task | 0 | 1 | 1 |
| Bug | 0 | 0 | 0 |

---

## Per-Student Work Allocation

| Student | Issues Assigned | Issues Completed |
|---|---:|---:|
| Arjun Nyein | 2 | 1 |

---

## Estimation & Accuracy

| Metric | Value |
|---|---:|
| Total story points committed | N/A |
| Total story points completed | N/A |
| Completion % | N/A |

---

## Workflow Discipline
- ☑ Issues moved through workflow states (To Do → In Progress → Done)  
- ☑ Issues closed only after acceptance criteria met  
- ☑ Sprint completed/closed in Jira  

---

## Blockers & Scope Changes
- **Major blockers:** CI/coverage gate feedback loops and iteration on auth edge-cases (role mismatch + access-code gating).  
- **Scope changes:** Advisor onboarding was improved beyond the original UI-only request by adding server-side access-code verification + route gating to prevent bypassing `/admin/signup` directly.  
- **Why work spilled over (if any):** Search/sort work for Programs/Gen-Ed is still in review and not fully completed/merged in this sprint.  

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
“This report was generated using Jira sprint artifacts during this sprint.”