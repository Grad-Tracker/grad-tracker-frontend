# GT-180 — Advisor Student Visibility & Read-only Plan View

**Status:** Design complete, awaiting implementation plan
**Jira:** [GT-180](https://lab-signoff-app.atlassian.net/browse/GT-180)
**Branch:** `feat/GT-180-advisor-students`
**Date:** 2026-04-13

## Goal

Give advisors first-class visibility into the students enrolled in their assigned programs: who they are, how they're tracking against major and gen-ed requirements, and what plans they're exploring. Read-only for this iteration; editing student plans from the advisor side is a future ticket.

## Scope

In:

- A "Students" nav item in the advisor sidebar
- A list page showing every student enrolled in an advisor's assigned programs, with major and gen-ed progress
- A per-student overview page (profile, progress decomposition, plans list)
- A read-only view of any of the student's plans, reusing the existing planner
- Refactor of the planner to accept `studentId` + `mode` props instead of resolving the student from the auth user inline

Out (future tickets):

- Editing student plans from the advisor side
- Course suggestions for empty semester slots (overlaps GT-179)
- Notes / messaging between advisor and student
- Bulk actions on students

## Architecture

Three new admin routes, plus a planner refactor:

```
/admin/students                                 [new] List page (server component)
/admin/students/[studentId]                     [new] Student overview (server)
/admin/students/[studentId]/planner?planId=…    [new] Read-only planner (server shell, client view)
/dashboard/planner                              [refactor] Resolves studentId from auth, renders <PlannerView mode="edit" />
```

The student-side `/dashboard/planner` route becomes a thin server component that resolves the student from auth and renders the new shared `<PlannerView studentId={…} mode="edit" />`. The advisor route resolves `studentId` from URL params (after access check) and renders `<PlannerView studentId={…} mode="readonly" planId={…} />`.

### Authorization

Every advisor route calls `requireAdvisorAccess(supabase)` (already exists in `src/app/admin/(protected)/programs/server-helpers.ts`) to confirm the user has the advisor role and a `staff` row, then verifies the requested student is enrolled in at least one of the advisor's assigned programs.

A new helper `requireAdvisorCanViewStudent(supabase, staffId, studentId)` lives next to the existing helpers. It joins `student_programs` ↔ `program_advisors` filtered by `staff_id` and the requested student. If no row, redirect to `/admin/students`.

If the existing `programs/server-helpers.ts` file starts to feel program-specific with the new helper, move shared functions (`requireAdvisorAccess`, `fetchAdvisorAssignments`) into a new `src/app/admin/(protected)/server-helpers.ts` shared module. Decision deferred to implementation — make the call when writing the helper.

## Data Layer

New module: `src/lib/supabase/queries/advisor-students.ts`.

```ts
type AdvisorStudentRow = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  primaryProgramId: number | null;
  primaryProgramName: string | null;
  primaryProgramType: string | null;
  expectedGradSemester: string | null;
  expectedGradYear: number | null;
  majorProgressPct: number;       // 0–100
  genEdProgressPct: number;       // 0–100
};

type StudentOverview = {
  profile: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    expectedGradSemester: string | null;
    expectedGradYear: number | null;
    breadthPackageId: string | null;
  };
  programs: {
    id: number;
    name: string;
    programType: string;
    progressPct: number;
    completedReqs: number;
    totalReqs: number;
  }[];
  genEdProgress: {
    progressPct: number;
    completed: number;
    total: number;
  };
  plans: {
    id: number;
    name: string;
    description: string | null;
    createdAt: string;
    updatedAt: string;
    totalCredits: number;
    termCount: number;
  }[];
};

export async function listStudentsForAdvisor(
  supabase: SupabaseLike,
  staffId: number
): Promise<AdvisorStudentRow[]>;

export async function getStudentOverview(
  supabase: SupabaseLike,
  staffId: number,
  studentId: number
): Promise<StudentOverview>;
```

### Computing progress

For each `(student, program)` pair, intersect:

- **Completed-or-in-progress course IDs** for the student — derived from `student_course_history` (rows where the student has a grade or completion) plus `student_planned_courses` with `status` in `(COMPLETED, IN_PROGRESS)`. Implementation can reuse the logic in `fetchCompletedCourseIds` (`src/lib/supabase/queries/planner.ts:449`).
- **Required course IDs** for the program — from `program_requirement_courses` joined to `program_requirement_blocks` filtered by `program_id`.
- `progressPct = round(intersection.size / required.size * 100)` (returns 0 when `required.size === 0`).

Gen-ed progress: same approach against `gen_ed_bucket_courses` filtered by the student's `breadth_package_id`.

### Performance for the list page

Batch queries to keep round-trips to ≤3 regardless of student count:

1. One query for all `(student, program)` rows for students enrolled in the advisor's programs (joins `student_programs` ↔ `students` ↔ `programs`)
2. One query for completed/in-progress courses across all those students
3. One query for gen-ed bucket courses grouped by the breadth packages those students use

Compute the percentages in-memory in the helper. No N+1.

### Primary program

`primary program` for the list view = first row in `student_programs` ordered by `program_id ASC` (the schema has no `is_primary` flag — keep it deterministic, revisit if advisors need explicit primary selection). Multi-program handling on the overview page is richer (one progress card per enrolled program).

## UI

### `/admin/students` — list page

Server component fetches via `listStudentsForAdvisor`, renders client `<StudentsListClient students={…} />`.

Layout:

- Page header: "Students" + count badge
- Search box — filters by name / email, client-side. If a deployment grows past ~200 students per advisor, push to server. Out of scope for v1.
- Sort: name (default), expected graduation, major progress
- Optional program filter dropdown — only renders if the advisor has 2+ assigned programs
- Card grid (1/2/3 col responsive). Each card:
  - Name + email subtitle
  - Program badge (color from `getProgramColor`)
  - Expected grad ("Spring 2027" formatting)
  - Two thin progress bars side by side: **Major** *(67%)* / **Gen-Ed** *(45%)* — semantic colors using thresholds (≥75% green, 40–74% yellow, <40% red)
  - Whole card is a `<Link>` to `/admin/students/[id]`
- Empty state: "No students enrolled in your programs yet."

### `/admin/students/[studentId]` — overview page

Calls `requireAdvisorCanViewStudent` then `getStudentOverview`. Renders `<StudentOverviewClient overview={…} />`.

Layout:

- Breadcrumbs: Admin › Students › {Name}
- Header card: name, email, program badges, expected graduation
- Progress section: row of cards, one per enrolled program plus one for gen-ed. Each card shows `X of Y requirements complete` + a ring or bar visualization
- "Plans" section: heading + grid of plan cards, sorted by `updated_at DESC`. Each plan card shows name, description, term range, total credits, and a "Last updated …" timestamp. The most recently updated plan gets a subtle "Latest" badge to draw the eye. Whole card is a `<Link>` to `/admin/students/[studentId]/planner?planId=…`. Empty state: "{First name} hasn't created a plan yet."

(The `plans` table has no `is_active` column — "current plan" is a UI concept on the student side, not a DB property. The "Latest" badge is a derived label, not a stored flag.)

### `/admin/students/[studentId]/planner` — read-only planner

Server component performs auth + access checks, then renders `<PlannerView studentId={paramId} mode="readonly" initialPlanId={searchParam.planId} />`.

UI additions specific to this route:

- Breadcrumbs: Admin › Students › {Name} › Planner
- A read-only banner across the top: "Viewing as advisor — read only."
- The plan switcher dropdown stays visible (it's navigation, not a write action)

### Sidebar

`src/components/admin/AdminSidebar.tsx` adds one nav item between Programs and Gen-Ed:

```ts
{ icon: LuUsers, label: "Students", href: "/admin/students" }
```

## Planner Refactor (the risky part)

`src/app/dashboard/planner/page.tsx` is currently a 1000+ line client component owning auth resolution, all data fetching, all mutations, and all UI. The advisor read-only view requires this component to accept `studentId` as input rather than resolving it from `auth.getUser()` internally.

### Steps

1. **Extract** the body of `page.tsx` into `src/components/planner/PlannerView.tsx` with this shape:
   ```ts
   export interface PlannerViewProps {
     studentId: number;
     mode: "edit" | "readonly";
     initialPlanId?: number;
   }
   ```
2. **Replace** the inline `auth.getUser → students.id` resolution (currently around lines 377–406 of `page.tsx`) with the prop. The student-side `page.tsx` becomes a thin server component:
   ```tsx
   const { user } = await getUserOrRedirect();
   const studentId = await resolveStudentIdFromAuth(supabase, user.id);
   return <PlannerView studentId={studentId} mode="edit" />;
   ```
3. **Gate write affordances** on `mode === "edit"` via a single `const canEdit = mode === "edit"` threaded down. Hide:
   - "Create plan" / "Delete plan" buttons
   - "Add semester" / "Remove semester" controls
   - Course panel add buttons
   - All dialog triggers (`CreatePlanDialog`, `AutoGenerateDialog`, etc.) — not rendered when `!canEdit`
   - DnD: pass `sensors = canEdit ? […] : []` to `DndContext` so drag is inert
4. **Activity logging** — `logStudentActivity` calls only fire when `canEdit`. An advisor viewing a plan should not appear in the student's activity feed.
5. **localStorage** — keys are already namespaced by `studentId`, so reads stay safe. Skip writes when `!canEdit` (advisor viewing should not mutate UI prefs the student sees).

### Explicitly out of scope for this refactor

- Splitting `PlannerView` into smaller pieces — its own future ticket
- Adding an "advisor edit" mode — future ticket
- Refactoring the existing data-fetching hooks in `lib/supabase/queries/planner.ts`

### Risk mitigation

The diff is mostly mechanical: file move, one prop substitution, ~10 conditional renders. Existing planner tests must continue to pass against the student-side route — they are the regression net.

## Testing

New tests (vitest + Testing Library, following project conventions: `getAllByText`, `<ChakraProvider value={defaultSystem}>` wrapper, `cleanup()` in setup):

1. `src/__tests__/lib/supabase/queries/advisor-students.test.ts`
   - `listStudentsForAdvisor` returns only students enrolled in the advisor's programs
   - Progress percentages compute correctly given fixture course/requirement data
   - Empty cases: advisor with no programs; program with no enrolled students
2. `src/__tests__/app/admin/students/StudentsListClient.test.tsx`
   - Renders all student cards
   - Search filters by name and email
   - Sort changes order
   - Empty state when zero students
3. `src/__tests__/app/admin/students/StudentOverviewClient.test.tsx`
   - Renders profile, progress cards, plan cards
   - Plan cards link to `/admin/students/[id]/planner?planId=…`
   - Empty plans state when student has no plans
4. **Planner refactor regression** — existing planner tests must pass unchanged against the student-side `/dashboard/planner` route. Add one new test in `src/__tests__/components/planner/PlannerView.test.tsx`: `mode="readonly"` does not render write buttons (assert by query for the create/add buttons returning empty).
5. `src/__tests__/app/admin/students/server-helpers.test.ts`
   - `requireAdvisorCanViewStudent` redirects when the requested student is not enrolled in any of the advisor's programs

## Rollout

Each step is a sensible commit boundary, ordered to keep the tree shippable at every commit:

1. **Planner refactor.** Extract `PlannerView`, swap the student page to use it. Existing tests stay green. Ship-able alone — no behavior change for students.
2. **Query module + auth helper.** Pure additions, no UI yet.
3. **List page + sidebar nav.** First user-visible advisor change.
4. **Overview page.** Composes existing pieces.
5. **Read-only planner route.** Smallest of the new pages — composes the refactored `PlannerView`.

## Open questions

None blocking implementation. Two minor decisions to make during implementation:

- Whether to move shared advisor helpers out of `programs/server-helpers.ts` (decide in step 2 based on whether the file feels program-specific after adding the new helper)
- Threshold values for the green/yellow/red progress colors (≥75 / 40–74 / <40 are reasonable defaults; adjust if the demo looks off)
