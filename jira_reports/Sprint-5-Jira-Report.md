# Sprint 5 Jira Report — Arjun Nyein

## Project Information
- **Jira Project:** Grad Tracker (GT)  
- **Project Link:** https://lab-signoff-app.atlassian.net/jira/software/projects/GT/boards/68  
- **Sprint:** Sprint 5  
- **Data captured on:** 2026-04-21  

---

## Sprint Work Completed (Done)
- Cleaned up dead/duplicate logic by **centralizing Gen-Ed bucket + course loading** into a shared Supabase query helper and updating both the Gen-Ed admin page + client refresh path to use it  
- Replaced **hard-coded hex colors** across key auth + landing pages with **Chakra semantic tokens**, including gradients migrated to Chakra v3 props where needed  
- Fixed **font variable references** on error/not-found pages to consistently use the project font (`var(--font-dm-sans)`)  
- Improved **contrast/accessibility** by adjusting low-contrast color tokens (e.g., `.400/.500` → `.600`) in password strength, signup indicators, AI advisor status, and planner UI highlights  
- Added/updated **page metadata titles** for dashboard + admin routes so browser tabs show the correct page name instead of generic titles  
- Completed **ARIA labels & accessibility audit**:
  - Added missing aria-labels on icon-only buttons
  - Improved keyboard activation for non-native “button-like” clickable elements (Enter/Space)
  - Verified via tests + browser audit (Lighthouse)

---

## Sprint Commitment vs Delivery

| Metric | Count |
|---|---:|
| Issues committed at sprint start | N/A |
| Issues completed | N/A |
| Issues not completed | N/A |
| Issues added mid-sprint | N/A |

---

## Issue Breakdown by Type

| Type | To Do | In Progress | Done |
|---|---:|---:|---:|
| Story | N/A | N/A | N/A |
| Task | N/A | N/A | N/A |
| Bug | N/A | N/A | N/A |

---

## Per-Student Work Allocation

| Student | Issues Assigned | Issues Completed |
|---|---:|---:|
| Arjun Nyein | N/A | N/A |

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
- **Major blockers:** Review feedback loops from CodeRabbit (typing, a11y, and UI correctness) and ensuring changes stayed compatible with Chakra UI v3 APIs.  
- **Scope changes:** Several “cleanup” tasks expanded into small refactors to keep behavior consistent while removing duplication (Gen-Ed query helper) and improving production readiness (metadata, a11y, contrast).  
- **Why work spilled over (if any):** N/A  

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