# Sprint 2 – Jira Report

## Project Information
- **Jira Project:** Grad Tracker  
- **Project Link:** https://lab-signoff-app.atlassian.net/jira/software/projects/GT  
- **Sprint:** Sprint 2  

---

## Sprint Commitment vs Delivery

| Metric | Count |
|--------|--------|
| Issues committed at sprint start | 3 |
| Issues completed | 3 |
| Issues not completed | 0 |
| Issues added mid-sprint | 0 |

---

## Issue Breakdown by Type

| Type | To Do | In Progress | Done |
|------|-------|-------------|------|
| Story | 0 | 0 | 0 |
| Task | 0 | 0 | 3 |
| Bug | 0 | 0 | 0 |

---

## Per-Student Work Allocation

| Student | Issues Assigned | Issues Completed |
|---------|------------------|------------------|
| Arjun Nyein | 3 | 3 |

---

## Estimation & Accuracy

| Metric | Value |
|--------|-------|
| Total story points committed | 0 |
| Total story points completed | 0 |
| Completion % | N/A (No story points estimated) |

---

## Workflow Discipline

- ☑ Issues moved through workflow states (To Do → In Progress → Done)  
- ☑ Issues closed only after acceptance criteria met  
- ☑ Sprint completed/closed in Jira  

---

## Blockers & Scope Changes

- Prerequisite chain logic required extra time to understand and map correctly (req sets → nodes → atoms).
- No scope changes were introduced mid-sprint.
- No work spilled over past the sprint (all assigned tasks were completed).

---

## Work Completed (Sprint 2)

### 1) Build Requirements page (/dashboard/requirements)
- Built the Requirements page UI and organized degree requirements into blocks:
  - General Ed
  - Major Core
  - Major Electives
  - Free Electives
- Displayed required courses with status colors:
  - Completed (green)
  - In progress (yellow)
  - Remaining (gray)
- Added a progress bar for each block.

### 2) Add gen-ed requirement tracking
- Implemented Gen Ed progress using:
  - `gen_ed_buckets` (3 buckets, 12 credits each)
  - `gen_ed_bucket_courses` (course mappings)
- Calculated completed credits and remaining credits per bucket based on student course history.

### 3) Show prerequisite chains on requirement items
- Added prerequisite warnings on requirement courses the student has not unlocked yet.
- Used prerequisite chain tables:
  - `course_req_sets`
  - `course_req_nodes`
  - `course_req_atoms`
- Displayed a “Prereq not met” warning on courses where prerequisites are not satisfied (based on student completed courses).

---

## Jira Evidence Links (no screenshots)

- **Sprint Report:** https://lab-signoff-app.atlassian.net/jira/software/projects/GT/boards/68/reports/burnup  
- **Backlog:** https://lab-signoff-app.atlassian.net/jira/software/projects/GT/boards/68/backlog  
- **Board (Filtered to Sprint 2):** https://lab-signoff-app.atlassian.net/jira/software/projects/GT/boards/68