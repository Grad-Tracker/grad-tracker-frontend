# Auto-Generate Algorithm

The auto-generate system builds a complete graduation plan by selecting courses from program requirements and gen ed buckets, ordering them by prerequisites, and packing them into semesters. It runs entirely client-side with Supabase data fetches and produces a validated result.

## Architecture

```
src/lib/planner/
├── auto-generate-orchestrator.ts   ← 7-step pipeline (entry point)
├── auto-generate.ts                ← Course selection, scheduling, availability
├── prereq-graph.ts                 ← Prerequisite tree extraction from Supabase
└── validate-plan.ts                ← Post-generation validation (pure function)

src/types/auto-generate.ts          ← All type definitions
```

## Pipeline Overview

The orchestrator (`autoGeneratePlan`) runs 7 sequential steps:

```
1. Gather data         → Fetch requirements, completed courses, gen eds, existing plan
2. Analyze prereqs     → Extract prereq edges for ALL candidate courses
3. Select courses      → Pick courses from each requirement block + fill gen ed gaps
4. Build precise graph → Re-extract prereqs for just the selected courses + fetch offerings
5. Schedule courses    → Topological sort → greedy bin-packing into semesters
6. Validate plan       → Check prereqs, availability, credit caps, requirement satisfaction
7. Save to Supabase    → Batch-save all scheduled courses to plan terms
```

## Two Modes

- **`new`** — Creates a fresh plan and schedules everything from scratch. User provides a start season/year.
- **`fill`** — Works with an existing plan. Fills empty capacity in existing semesters first, then appends new semesters for remaining courses.

---

## Step 1: Gather Data

Fetches in parallel:
- **Requirement blocks** (`fetchAvailableCourses`) — program requirement blocks with their eligible courses, filtered to the plan's programs
- **Completed course IDs** (`fetchCompletedCourseIds`) — courses the student has already passed
- **Gen ed buckets** (`fetchGenEdBucketsWithCourses`) — general education categories with their eligible courses and credit requirements
- **Existing terms and courses** (fill mode only) — the plan's current semester structure and placed courses

**Breadth package handling:** If the user selected a specific breadth package (e.g., "Social Sciences"), the breadth block is narrowed to only that package's courses and its rule is changed to `ALL_OF`.

## Step 2: Analyze Prerequisites

Runs `extractPrereqEdges` on ALL candidate course IDs (from blocks + gen ed buckets). This is done early so the course selection heuristics can use real prereq counts.

### Prerequisite Tree Structure

Prerequisites are stored as a tree in Supabase across three tables:

```
course_req_sets    → top-level container (one per course, set_type = "PREREQ")
  └── course_req_nodes  → tree nodes (AND / OR / ATOM)
        └── course_req_atoms  → leaf values (atom_type = "COURSE", required_course_id)
```

**Tree walking rules:**
- **AND nodes** → union all children (all branches required)
- **OR nodes** → pick the branch with the fewest prerequisites (greedy — prefers branches within the scheduled course set)
- **ATOM nodes** → return the `required_course_id` if `atom_type = "COURSE"`

**Cycle breaking:** If course A requires B and B requires A, the edge to the higher-numbered course is removed.

**Output:** `Map<courseId, Set<prereqCourseIds>>` — only edges between courses in the candidate set.

### Cross-Listings

Fetched in parallel with prereqs. When a course is selected, all its cross-listed equivalents are marked as selected too (e.g., CSCI 231 and MATH 231 are the same class).

## Step 3: Select Courses

Two phases: program requirements, then gen ed gap filling.

### Phase A: Program Requirement Blocks

For each requirement block, `selectCoursesForBlock` picks courses based on the block's rule:

| Rule | Behavior |
|------|----------|
| `ALL_OF` | Take every course not already completed/selected |
| `ANY_OF` | Take the single best course |
| `N_OF` | Take N courses (and/or enough credits), with same-subject companion pulling |
| `CREDITS_OF` | Take courses until credit target is met |

**Selection heuristic** (for flexible rules — `ANY_OF`, `N_OF`, `CREDITS_OF`):

Candidates are sorted by three criteria in priority order:
1. **Gen ed overlap** — prefer courses that also satisfy a gen ed bucket (double-counting)
2. **Fewer prerequisites** — prefer courses with lower prereq in-degree (simpler dependency chains)
3. **Lower course number** — prefer intro courses (100-level before 400-level)

**N_OF companion pulling:** After selecting a course, the algorithm pulls in same-subject companions before moving to unrelated courses. This keeps lab+lecture pairs together (e.g., CHEM 103 lab after CHEM 101).

### Phase B: Gen Ed Gap Resolution

After program course selection, `resolveGenEdGaps` checks each gen ed bucket:

1. Count credits already covered by selected + completed courses
2. If bucket still needs credits, pick additional courses from that bucket
3. Additional courses are sorted by: fewer prereqs → lower course number

This fills gaps without double-selecting courses already chosen for program requirements.

## Step 4: Build Precise Graph + Availability

After course selection is finalized, two parallel fetches:
- **Re-extract prereq edges** for just the selected courses (precise edge set for scheduling)
- **Fetch course offerings** — term codes from the `course_offerings` table

### Availability Map

Course offerings use term codes that map to seasons/years:

| Term Code | Meaning |
|-----------|---------|
| `FALL`, `SPRING`, `SUMMER` | Every year |
| `YEARLY` | Fall and Spring every year |
| `FALL_EVEN`, `SPRING_ODD`, etc. | Alternating years |
| `OCCASIONALLY` | Treated as available any semester |
| `2026FA`, `2026SP` | Specific term only |

**Courses with no offerings data are treated as available every semester.**

## Step 5: Schedule Courses

### Topological Sort (Kahn's Algorithm)

`computeTopologicalLevels` assigns each course a level:
- **Level 0** — no prerequisites (or prereqs outside the scheduled set)
- **Level 1** — depends only on level-0 courses
- **Level N** — depends on courses at level N-1 or lower
- **Level 999** — unreachable (cycle)

### Co-requisite Detection

`buildCoreqMap` detects lab+lecture pairs using a heuristic:
- Find 1-credit courses with "Lab" in the title
- Match them to same-subject courses within 5 course numbers that have more credits
- These pairs must be scheduled in the same semester

### Greedy Bin-Packing Scheduler

`scheduleCourses` packs courses into semesters:

```
1. Sort courses by: topological level → subject name → course number
2. Generate a sequence of semester slots (Fall → Spring → [Summer] → Fall → ...)
3. For each semester slot:
   a. Iterate ALL remaining unscheduled courses
   b. For each course, check:
      - Not already scheduled
      - Adding it won't exceed credit cap (default: 15)
      - Course is offered in this season/year
      - All prerequisites are already scheduled or completed
   c. If placed, eagerly co-schedule any lab/lecture partners
4. Skip empty semesters (no courses placed)
5. Collect any courses that couldn't be placed as "unscheduled"
```

**Key design choice:** The inner loop iterates ALL remaining courses each semester, not just courses at the current topological level. This means a 3-credit level-2 course can fill a gap in a semester that's already at 12 credits from level-0 courses. This achieves ~15 credit semesters with subject variety.

**Sorting by subject+number** (not credits descending) prevents semesters from clustering all 5-credit courses together. Instead, courses naturally interleave: CSCI 5cr, ENGL 3cr, MATH 4cr, etc.

### Fill Existing Plan Mode

`fillExistingPlan` has two passes:

**Pass 1 — Fill existing semesters:**
- Sort existing terms chronologically
- For each term with remaining capacity (credits < cap):
  - Try to place new courses, checking prereqs against semester indices
  - A prereq must be in a strictly earlier term (not just "exists somewhere")

**Pass 2 — Append new semesters:**
- Calculate the next season/year after the last existing term
- Run `scheduleCourses` for any remaining unplaced courses

## Step 6: Validate Plan

`validatePlan` is a pure function (no Supabase calls) that checks the scheduler's output. It runs 7 checks:

| # | Check | Severity | Code |
|---|-------|----------|------|
| 1 | All selected courses were actually scheduled | error | `COURSE_NOT_SCHEDULED` |
| 2 | All prereqs are in strictly earlier semesters | error | `PREREQ_VIOLATION` |
| 3 | All courses are offered in their scheduled semester | error | `AVAILABILITY_VIOLATION` |
| 4 | No semester exceeds the credit cap | warning | `CREDIT_CAP_EXCEEDED` |
| 5 | All program requirement blocks are satisfied | warning | `BLOCK_UNSATISFIED` |
| 6 | All gen ed buckets are satisfied | warning | `GENED_UNSATISFIED` |
| 7 | Average credit load is reasonable (12–18) | info/warning | `LOW_CREDIT_AVERAGE` / `HIGH_CREDIT_AVERAGE` |

**Output:** `ValidationResult` with:
- `valid: boolean` — true if zero errors (warnings are OK)
- `issues[]` — all problems found
- `blockStatuses[]` — per-block satisfaction (credits scheduled vs. required)
- `genEdStatuses[]` — per-bucket satisfaction
- `unscheduledCourses[]` — courses that were selected but couldn't be placed

## Step 7: Save to Supabase

`batchSavePlanCourses` writes all scheduled courses to the plan's terms. The plan is always saved, even with validation warnings — a partial plan is better than nothing.

## Result

The final `AutoGenerateResult` contains:

```typescript
{
  planId: number;
  semesters: ScheduledSemester[];   // season, year, courses[], totalCredits
  totalCourses: number;
  totalCredits: number;
  validation: ValidationResult;     // issues, block/genEd statuses, unscheduled
}
```

## Constants

| Constant | Value | Location |
|----------|-------|----------|
| Default credit cap | 15 | `auto-generate-orchestrator.ts` |
| Max semester slots | `courses.length * 3 + 10` | `auto-generate.ts` |
| Lab detection | 1-credit + "Lab" in title, same subject within 5 numbers | `buildCoreqMap` |
| Cycle-breaking | Remove edge to higher-numbered course | `extractPrereqEdges` |
| No-offering fallback | Treat as available every semester | `isAvailable` |
