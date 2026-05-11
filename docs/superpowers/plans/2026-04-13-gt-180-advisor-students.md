# GT-180 Advisor Student Visibility — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give advisors a `/admin/students` area to see students enrolled in their assigned programs, view per-student progress against major + gen-ed requirements, and open any student plan read-only inside the existing planner UI.

**Architecture:** Three new admin routes (`/admin/students`, `/admin/students/[id]`, `/admin/students/[id]/planner`) plus a refactor of `src/app/dashboard/planner/page.tsx` to extract its body into `<PlannerView studentId mode>` so the same component serves both the student edit experience and the advisor read-only experience.

**Tech Stack:** Next.js 16 App Router (server components for data, client components for interactivity), Chakra UI v3, Supabase, vitest + `@testing-library/react`.

**Spec:** `docs/superpowers/specs/2026-04-13-gt-180-advisor-students-design.md`

**Working branch:** `feat/GT-180-advisor-students` (already created)

---

## File Map

**Created:**
- `src/components/planner/PlannerView.tsx` — extracted from `dashboard/planner/page.tsx`
- `src/lib/supabase/queries/advisor-students.ts` — query module
- `src/app/admin/(protected)/students/page.tsx` — list page server component
- `src/app/admin/(protected)/students/StudentsListClient.tsx` — list page client
- `src/app/admin/(protected)/students/[studentId]/page.tsx` — overview page server component
- `src/app/admin/(protected)/students/[studentId]/StudentOverviewClient.tsx` — overview client
- `src/app/admin/(protected)/students/[studentId]/planner/page.tsx` — read-only planner route
- `src/app/admin/(protected)/students/server-helpers.ts` — `requireAdvisorCanViewStudent`
- `src/__tests__/lib/supabase/queries/advisor-students.test.ts`
- `src/__tests__/app/admin/students/StudentsListClient.test.tsx`
- `src/__tests__/app/admin/students/StudentOverviewClient.test.tsx`
- `src/__tests__/app/admin/students/server-helpers.test.ts`
- `src/__tests__/components/planner/PlannerView.test.tsx`

**Modified:**
- `src/app/dashboard/planner/page.tsx` — body becomes a thin wrapper over `<PlannerView />`
- `src/components/admin/AdminSidebar.tsx` — add Students nav item

---

## Phase 1 — Planner Refactor

> Goal: extract `dashboard/planner/page.tsx` body into `PlannerView` accepting `{ studentId, mode, initialPlanId }`. Student-side route resolves studentId from auth and passes `mode="edit"`. New route in Phase 7 will pass `mode="readonly"`. No behavior change for students.

### Task 1.1 — Add a regression smoke test for the student planner route

Establish a baseline: a single test confirming the student planner page mounts without error so the upcoming refactor can break early on a smoke failure.

**Files:**
- Create: `src/__tests__/components/planner/PlannerView.test.tsx`

- [ ] **Step 1: Inspect what already exists**

Run: `ls src/__tests__/components/planner/`
Confirm there is no `PlannerView.test.tsx`. The other tests (`PlanCard`, `SemesterGrid`, etc.) test individual sub-components — none mount the page wrapper. We are adding the first one.

- [ ] **Step 2: Write a minimal failing test**

```tsx
// src/__tests__/components/planner/PlannerView.test.tsx
import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import React from "react";
import { renderWithChakra } from "../../helpers/mocks";

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    from: () => ({
      select: () => ({ eq: () => ({ then: (r: any) => r({ data: [], error: null }) }) }),
    }),
  }),
}));

import PlannerView from "@/components/planner/PlannerView";

describe("PlannerView", () => {
  it("mounts in edit mode without throwing", () => {
    renderWithChakra(<PlannerView studentId={1} mode="edit" />);
    // Loading skeleton renders before data resolves
    expect(document.body).toBeTruthy();
  });

  it("mounts in readonly mode without throwing", () => {
    renderWithChakra(<PlannerView studentId={1} mode="readonly" />);
    expect(document.body).toBeTruthy();
  });
});
```

- [ ] **Step 3: Run the test — expect failure**

Run: `npx vitest run src/__tests__/components/planner/PlannerView.test.tsx`
Expected: FAIL with `Cannot find module '@/components/planner/PlannerView'`

- [ ] **Step 4: Commit the failing test**

```bash
git add src/__tests__/components/planner/PlannerView.test.tsx
git commit -m "test(GT-180): add PlannerView smoke test (failing — component to be extracted next)"
```

### Task 1.2 — Extract the planner body into `PlannerView`

This is a large file move. The strategy: copy the entire current body of `page.tsx` into `PlannerView.tsx`, change its export and accept props, then make `page.tsx` a thin wrapper.

**Files:**
- Create: `src/components/planner/PlannerView.tsx`
- Modify: `src/app/dashboard/planner/page.tsx`

- [ ] **Step 1: Read the current file in full**

Run: `wc -l src/app/dashboard/planner/page.tsx`
Expected: ~1184 lines

Read it. Identify the auth resolution block (search for `auth.getUser` — it's around line 377 inside a `useEffect` that resolves the student ID).

- [ ] **Step 2: Create `PlannerView.tsx` containing the current page body, but parameterized**

Copy the entire `src/app/dashboard/planner/page.tsx` to `src/components/planner/PlannerView.tsx`. Then make these edits in `PlannerView.tsx`:

a. Add the prop interface and rename the export. Replace:
```tsx
export default function PlannerPage() {
```
with:
```tsx
export interface PlannerViewProps {
  studentId: number;
  mode: "edit" | "readonly";
  initialPlanId?: number;
}

export default function PlannerView({
  studentId: propStudentId,
  mode,
  initialPlanId,
}: PlannerViewProps) {
  const canEdit = mode === "edit";
```

b. Remove the local `studentId` state. Replace:
```tsx
const [studentId, setStudentId] = useState<number | null>(null);
```
with:
```tsx
const studentId: number = propStudentId;
```
(local `setStudentId` references will go away in step c.)

c. Remove the auth-resolution effect block (~lines 370-410 of the original file — the `useEffect` that calls `supabase.auth.getUser()` and `setStudentId`). The data-fetching effect that follows should still run; it depended on `studentId` being set, and now `studentId` is always set from the prop. After this edit, run `grep -n setStudentId src/components/planner/PlannerView.tsx` — there should be **zero** matches. Any leftover reference is a bug from this step.

d. If `initialPlanId` is provided, prefer it on first mount when picking the active plan. Find the place where `activePlanId` is initialized after `fetchPlans` resolves. Replace logic like:
```tsx
const firstPlan = plans[0];
if (firstPlan) setActivePlanId(firstPlan.id);
```
with:
```tsx
const targetPlan =
  (initialPlanId && plans.find((p) => p.id === initialPlanId)) || plans[0];
if (targetPlan) setActivePlanId(targetPlan.id);
```

e. Leave **all** the data-fetching logic, mutation handlers, dialogs, and JSX exactly as-is. Phase 1 is purely structural — Phase 1.3 introduces the read-only gating.

- [ ] **Step 3: Replace `page.tsx` with a thin server wrapper**

Replace the entire contents of `src/app/dashboard/planner/page.tsx` with:

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PlannerView from "@/components/planner/PlannerView";

export default async function PlannerPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  const { data: studentRow } = await supabase
    .from("students")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  if (!studentRow) redirect("/onboarding");

  return <PlannerView studentId={Number(studentRow.id)} mode="edit" />;
}
```

This page is now a server component. The previous implementation was a `"use client"` component that did the auth lookup in a `useEffect`; moving the lookup to the server eliminates the loading flicker and produces a cleaner contract.

- [ ] **Step 4: Run the smoke test**

Run: `npx vitest run src/__tests__/components/planner/PlannerView.test.tsx`
Expected: PASS (both `mounts in edit mode` and `mounts in readonly mode`)

- [ ] **Step 5: Run all planner-component tests to verify no regressions**

Run: `npx vitest run src/__tests__/components/planner/`
Expected: all PASS. The component-level tests (`PlanCard`, `SemesterGrid`, etc.) were never coupled to `PlannerPage`, so they should stay green.

- [ ] **Step 6: Run the full type-check**

Run: `npx tsc --noEmit`
Expected: no errors in `PlannerView.tsx` or `dashboard/planner/page.tsx`. Pre-existing errors elsewhere in the codebase are not blocking.

- [ ] **Step 7: Manually verify the student planner still works**

Run: `npm run dev`
Open `http://localhost:3000/dashboard/planner` in a logged-in student account. The planner should look identical to before — same plans list, same semester grid, drag/drop works, dialogs open. If it's broken, the extraction missed something — diff `PlannerView.tsx` against the original `page.tsx` to find the gap.

- [ ] **Step 8: Commit**

```bash
git add src/components/planner/PlannerView.tsx src/app/dashboard/planner/page.tsx
git commit -m "refactor(GT-180): extract PlannerView from dashboard/planner/page.tsx"
```

### Task 1.3 — Gate write affordances on `mode === "edit"`

Hide every mutation surface when `!canEdit`. Read-only viewers see the same data layout but cannot click or drag anything that would mutate.

**Files:**
- Modify: `src/components/planner/PlannerView.tsx`

- [ ] **Step 1: Strengthen the readonly test first**

Open `src/__tests__/components/planner/PlannerView.test.tsx`. Add a third test:

```tsx
import { screen, waitFor } from "@testing-library/react";

it("readonly mode does not render Create Plan button", async () => {
  renderWithChakra(<PlannerView studentId={1} mode="readonly" />);
  await waitFor(() => {
    expect(screen.queryByRole("button", { name: /create plan/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /add semester/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /delete plan/i })).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test — confirm it fails**

Run: `npx vitest run src/__tests__/components/planner/PlannerView.test.tsx`
Expected: the third test FAILS because the buttons are still rendered in readonly mode.

- [ ] **Step 3: Add `canEdit` gates around every write affordance**

In `PlannerView.tsx`, the prop `canEdit` was already added in Task 1.2. Now find each write affordance and wrap or omit:

a. **Create Plan / Delete Plan / Plan settings buttons** — search for `CreatePlanDialog`, `DeletePlanDialog`. Wrap their renders:
```tsx
{canEdit && <CreatePlanDialog ... />}
{canEdit && <DeletePlanDialog ... />}
```

b. **Add Semester / Remove Semester** — search for `AddSemesterDialog`, `RemoveSemesterDialog`. Same pattern:
```tsx
{canEdit && <AddSemesterDialog ... />}
{canEdit && <RemoveSemesterDialog ... />}
```
Also wrap any `<Button>` whose `onClick` opens these dialogs.

c. **AutoGenerateDialog** — same:
```tsx
{canEdit && <AutoGenerateDialog ... />}
```

d. **CoursePanel add buttons** — `CoursePanel` likely renders "+" buttons. Pass `canAdd={canEdit}` as a prop and gate the button render inside `CoursePanel` itself. (If `CoursePanel` doesn't accept this prop yet, add it: a boolean defaulting to `true` so existing call sites don't change semantics.)

e. **DnD** — find the `useSensors(...)` call. Replace:
```tsx
const sensors = useSensors(
  useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  useSensor(KeyboardSensor)
);
```
with:
```tsx
const editSensors = useSensors(
  useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  useSensor(KeyboardSensor)
);
const sensors = canEdit ? editSensors : [];
```

f. **DraggableCourseCard / DraggableCourseRow** — these wrap children in DnD listeners. They likely accept a `disabled` or similar prop. If not, search how they're used in `PlannerView`. The easiest gate: pass `disabled={!canEdit}` and inside the component branch on it. If the component doesn't support this prop yet, add it (default `false`) and either skip `useDraggable` or render plain children when disabled.

g. **Activity logging** — find every call to `safeLogActivity` / `logStudentActivity`. Wrap:
```tsx
if (canEdit) {
  await safeLogActivity(...);
}
```

h. **localStorage writes** — find every `localStorage.setItem` call inside `PlannerView`. Wrap:
```tsx
if (canEdit) {
  localStorage.setItem(...);
}
```
Reads are fine to keep unconditional.

- [ ] **Step 4: Add a read-only banner — only when `mode === "readonly"`**

Near the top of the JSX return (just inside the outer wrapper), add:

```tsx
{!canEdit && (
  <Box bg="yellow.subtle" color="yellow.fg" px="4" py="2" borderRadius="md" mb="2">
    <Text fontSize="sm" fontWeight="500">
      Viewing as advisor — read only.
    </Text>
  </Box>
)}
```

- [ ] **Step 5: Run the planner tests again**

Run: `npx vitest run src/__tests__/components/planner/`
Expected: all PASS, including the new readonly-button-absence test.

- [ ] **Step 6: Manually verify the student planner UX is unchanged**

Run: `npm run dev` and open `/dashboard/planner` as a student. Drag/drop still works, all dialogs open, no read-only banner. If the banner shows up for the student, the `mode` prop is wrong — check `dashboard/planner/page.tsx` is passing `mode="edit"`.

- [ ] **Step 7: Commit**

```bash
git add src/components/planner/PlannerView.tsx src/__tests__/components/planner/PlannerView.test.tsx
git commit -m "feat(GT-180): gate planner write affordances behind mode='edit'"
```

---

## Phase 2 — Authorization Helper

> Goal: a server-side helper that confirms an advisor is allowed to view a specific student's data. Used by every advisor route under `/admin/students/[studentId]`.

### Task 2.1 — `requireAdvisorCanViewStudent`

**Files:**
- Create: `src/app/admin/(protected)/students/server-helpers.ts`
- Create: `src/__tests__/app/admin/students/server-helpers.test.ts`

- [ ] **Step 1: Read the existing helpers**

Read `src/app/admin/(protected)/programs/server-helpers.ts` to see the patterns for `requireAdvisorAccess`, `fetchAdvisorAssignments`, and the `SupabaseLike` type. We will mirror those patterns.

- [ ] **Step 2: Write the failing test**

```ts
// src/__tests__/app/admin/students/server-helpers.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));

import { redirect } from "next/navigation";
import { requireAdvisorCanViewStudent } from "@/app/admin/(protected)/students/server-helpers";

function makeSupabase(rows: unknown[]) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: rows, error: null }),
  };
  return { from: vi.fn().mockReturnValue(chain) };
}

describe("requireAdvisorCanViewStudent", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns silently when the student is enrolled in one of the advisor's programs", async () => {
    const supabase = makeSupabase([{ student_id: 42, program_id: 7 }]);
    await requireAdvisorCanViewStudent(supabase as any, 1, 42);
    expect(redirect).not.toHaveBeenCalled();
  });

  it("redirects to /admin/students when student is not in any of the advisor's programs", async () => {
    const supabase = makeSupabase([]);
    await expect(
      requireAdvisorCanViewStudent(supabase as any, 1, 42)
    ).rejects.toThrow("REDIRECT:/admin/students");
  });
});
```

- [ ] **Step 3: Run the test — expect failure**

Run: `npx vitest run src/__tests__/app/admin/students/server-helpers.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 4: Implement the helper**

```ts
// src/app/admin/(protected)/students/server-helpers.ts
import { redirect } from "next/navigation";
import { DB_TABLES } from "@/lib/supabase/queries/schema";

type SupabaseLike = {
  from: (table: string) => any;
};

/**
 * Confirm that the advisor (identified by staffId) has at least one assigned
 * program that the given student is enrolled in. Redirects to /admin/students
 * if not.
 */
export async function requireAdvisorCanViewStudent(
  supabase: SupabaseLike,
  staffId: number,
  studentId: number
): Promise<void> {
  // First: fetch the program_ids assigned to this advisor.
  const { data: assignments, error: assignError } = await supabase
    .from(DB_TABLES.programAdvisors)
    .select("program_id")
    .eq("staff_id", staffId);

  if (assignError) {
    // Fall back to legacy advisor_id column (matches existing helper pattern)
    const { data: legacy } = await supabase
      .from(DB_TABLES.programAdvisors)
      .select("program_id")
      .eq("advisor_id", staffId);
    if (!legacy || legacy.length === 0) {
      redirect("/admin/students");
    }
  }

  const programIds = (assignments ?? [])
    .map((row: any) => Number(row.program_id))
    .filter((id: number) => !Number.isNaN(id));

  if (programIds.length === 0) {
    redirect("/admin/students");
  }

  // Second: confirm this student is enrolled in at least one of those programs.
  const { data: overlap, error: overlapError } = await supabase
    .from(DB_TABLES.studentPrograms)
    .select("student_id, program_id")
    .eq("student_id", studentId)
    .in("program_id", programIds)
    .limit(1);

  if (overlapError || !overlap || overlap.length === 0) {
    redirect("/admin/students");
  }
}
```

- [ ] **Step 5: Run the test — expect pass**

Run: `npx vitest run src/__tests__/app/admin/students/server-helpers.test.ts`
Expected: both tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/admin/\(protected\)/students/server-helpers.ts src/__tests__/app/admin/students/server-helpers.test.ts
git commit -m "feat(GT-180): add requireAdvisorCanViewStudent authorization helper"
```

---

## Phase 3 — Query Module

> Goal: build `listStudentsForAdvisor` and `getStudentOverview` in `src/lib/supabase/queries/advisor-students.ts`. These are pure data accessors with no UI.

### Task 3.1 — Pure progress-computation helper (testable in isolation)

Before writing the full queries, build the pure function that computes the percentage. This is the only logic worth unit-testing carefully.

**Files:**
- Create: `src/lib/supabase/queries/advisor-students.ts`
- Create: `src/__tests__/lib/supabase/queries/advisor-students.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/__tests__/lib/supabase/queries/advisor-students.test.ts
import { describe, it, expect } from "vitest";
import { computeProgressPct } from "@/lib/supabase/queries/advisor-students";

describe("computeProgressPct", () => {
  it("returns 0 when there are no required courses", () => {
    expect(computeProgressPct(new Set([1, 2]), new Set())).toBe(0);
  });

  it("returns 100 when all required courses are completed", () => {
    expect(computeProgressPct(new Set([1, 2, 3]), new Set([1, 2, 3]))).toBe(100);
  });

  it("returns the rounded percentage of intersection", () => {
    // 2 of 3 required completed (one extra completed course is ignored)
    expect(computeProgressPct(new Set([1, 2, 99]), new Set([1, 2, 3]))).toBe(67);
  });

  it("returns 0 when there is no intersection", () => {
    expect(computeProgressPct(new Set([4, 5]), new Set([1, 2, 3]))).toBe(0);
  });
});
```

- [ ] **Step 2: Run — expect failure**

Run: `npx vitest run src/__tests__/lib/supabase/queries/advisor-students.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the helper**

```ts
// src/lib/supabase/queries/advisor-students.ts
export function computeProgressPct(
  completed: Set<number>,
  required: Set<number>
): number {
  if (required.size === 0) return 0;
  let hit = 0;
  for (const id of required) if (completed.has(id)) hit++;
  return Math.round((hit / required.size) * 100);
}
```

- [ ] **Step 4: Run — expect pass**

Run: `npx vitest run src/__tests__/lib/supabase/queries/advisor-students.test.ts`
Expected: 4 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabase/queries/advisor-students.ts src/__tests__/lib/supabase/queries/advisor-students.test.ts
git commit -m "feat(GT-180): add computeProgressPct helper"
```

### Task 3.2 — `listStudentsForAdvisor`

**Files:**
- Modify: `src/lib/supabase/queries/advisor-students.ts`
- Modify: `src/__tests__/lib/supabase/queries/advisor-students.test.ts`

- [ ] **Step 1: Add the failing test**

Append to `advisor-students.test.ts`:

```ts
import { vi } from "vitest";
import { listStudentsForAdvisor } from "@/lib/supabase/queries/advisor-students";

function makeSupabase(handlers: Record<string, () => any>) {
  return {
    from: vi.fn((table: string) => {
      const handler = handlers[table];
      if (!handler) throw new Error(`Unexpected table: ${table}`);
      return handler();
    }),
  };
}

function chain(rows: unknown[]) {
  const c: any = {};
  c.select = vi.fn().mockReturnValue(c);
  c.eq = vi.fn().mockReturnValue(c);
  c.in = vi.fn().mockReturnValue(c);
  c.order = vi.fn().mockReturnValue(c);
  c.then = (resolve: any) => resolve({ data: rows, error: null });
  return c;
}

describe("listStudentsForAdvisor", () => {
  it("returns empty array when advisor has no assigned programs", async () => {
    const supabase = makeSupabase({
      program_advisors: () => chain([]),
    });
    const result = await listStudentsForAdvisor(supabase as any, 1);
    expect(result).toEqual([]);
  });

  it("returns one row per student with computed progress", async () => {
    const supabase = makeSupabase({
      program_advisors: () => chain([{ program_id: 10 }]),
      student_programs: () =>
        chain([
          { student_id: 1, program_id: 10 },
          { student_id: 2, program_id: 10 },
        ]),
      students: () =>
        chain([
          {
            id: 1,
            first_name: "Ada",
            last_name: "Lovelace",
            email: "ada@example.com",
            expected_graduation_semester: "Spring",
            expected_graduation_year: 2027,
            breadth_package_id: "PKG_A",
          },
          {
            id: 2,
            first_name: "Alan",
            last_name: "Turing",
            email: "alan@example.com",
            expected_graduation_semester: null,
            expected_graduation_year: null,
            breadth_package_id: null,
          },
        ]),
      programs: () =>
        chain([
          { id: 10, name: "Computer Science", program_type: "MAJOR" },
        ]),
      program_requirement_blocks: () =>
        chain([{ id: 100, program_id: 10 }]),
      program_requirement_courses: () =>
        chain([
          { block_id: 100, course_id: 1000 },
          { block_id: 100, course_id: 1001 },
        ]),
      student_course_history: () =>
        chain([{ student_id: 1, course_id: 1000, completed: true }]),
      student_planned_courses: () => chain([]),
      gen_ed_bucket_courses: () => chain([]),
    });

    const rows = await listStudentsForAdvisor(supabase as any, 1);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      id: 1,
      firstName: "Ada",
      lastName: "Lovelace",
      primaryProgramName: "Computer Science",
      majorProgressPct: 50, // 1 of 2
    });
    expect(rows[1].majorProgressPct).toBe(0); // Alan has no completed courses
  });
});
```

- [ ] **Step 2: Run — expect failure**

Run: `npx vitest run src/__tests__/lib/supabase/queries/advisor-students.test.ts`
Expected: FAIL — `listStudentsForAdvisor` not exported.

- [ ] **Step 3: Implement the function**

Append to `src/lib/supabase/queries/advisor-students.ts`:

```ts
import { DB_TABLES } from "@/lib/supabase/queries/schema";

type SupabaseLike = { from: (t: string) => any };

export type AdvisorStudentRow = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  primaryProgramId: number | null;
  primaryProgramName: string | null;
  primaryProgramType: string | null;
  expectedGradSemester: string | null;
  expectedGradYear: number | null;
  majorProgressPct: number;
  genEdProgressPct: number;
};

export async function listStudentsForAdvisor(
  supabase: SupabaseLike,
  staffId: number
): Promise<AdvisorStudentRow[]> {
  // 1. Advisor's program ids
  const { data: assignments } = await supabase
    .from(DB_TABLES.programAdvisors)
    .select("program_id")
    .eq("staff_id", staffId);
  const programIds: number[] = (assignments ?? [])
    .map((r: any) => Number(r.program_id))
    .filter((n: number) => !Number.isNaN(n));
  if (programIds.length === 0) return [];

  // 2. Students enrolled in those programs (sorted by program_id ASC for deterministic primary)
  const { data: enrollments } = await supabase
    .from(DB_TABLES.studentPrograms)
    .select("student_id, program_id")
    .in("program_id", programIds)
    .order("program_id");
  const studentIds = Array.from(
    new Set((enrollments ?? []).map((r: any) => Number(r.student_id)))
  );
  if (studentIds.length === 0) return [];

  // 3. Student profile rows
  const { data: students } = await supabase
    .from(DB_TABLES.students)
    .select(
      "id, first_name, last_name, email, expected_graduation_semester, expected_graduation_year, breadth_package_id"
    )
    .in("id", studentIds);

  // 4. Program metadata for the primary program lookup
  const { data: programs } = await supabase
    .from(DB_TABLES.programs)
    .select("id, name, program_type")
    .in("id", programIds);
  const programById = new Map<number, { name: string; programType: string }>();
  for (const p of programs ?? []) {
    programById.set(Number(p.id), {
      name: p.name,
      programType: p.program_type,
    });
  }

  // Pick a deterministic "primary program" per student: lowest program_id
  // among the programs they are enrolled in that the advisor manages.
  const primaryByStudent = new Map<number, number>();
  for (const row of enrollments ?? []) {
    const sid = Number(row.student_id);
    const pid = Number(row.program_id);
    if (!primaryByStudent.has(sid) || pid < primaryByStudent.get(sid)!) {
      primaryByStudent.set(sid, pid);
    }
  }

  // 5. Required courses per program (for major progress computation)
  const { data: blocks } = await supabase
    .from(DB_TABLES.programRequirementBlocks)
    .select("id, program_id")
    .in("program_id", programIds);
  const blockToProgram = new Map<number, number>();
  for (const b of blocks ?? []) blockToProgram.set(Number(b.id), Number(b.program_id));

  const blockIds = Array.from(blockToProgram.keys());
  const { data: reqCourses } = blockIds.length
    ? await supabase
        .from(DB_TABLES.programRequirementCourses)
        .select("block_id, course_id")
        .in("block_id", blockIds)
    : { data: [] };

  const requiredByProgram = new Map<number, Set<number>>();
  for (const rc of reqCourses ?? []) {
    const pid = blockToProgram.get(Number(rc.block_id));
    if (pid == null) continue;
    if (!requiredByProgram.has(pid)) requiredByProgram.set(pid, new Set());
    requiredByProgram.get(pid)!.add(Number(rc.course_id));
  }

  // 6. Completed/in-progress course IDs per student (history + planned IN_PROGRESS/COMPLETED)
  const { data: history } = await supabase
    .from(DB_TABLES.studentCourseHistory)
    .select("student_id, course_id, completed")
    .in("student_id", studentIds);
  const { data: planned } = await supabase
    .from(DB_TABLES.studentPlannedCourses)
    .select("student_id, course_id, status")
    .in("student_id", studentIds);

  const completedByStudent = new Map<number, Set<number>>();
  for (const sid of studentIds) completedByStudent.set(sid, new Set());
  for (const h of history ?? []) {
    if (h.completed === false) continue; // explicitly not completed
    completedByStudent.get(Number(h.student_id))!.add(Number(h.course_id));
  }
  for (const p of planned ?? []) {
    const status = String(p.status ?? "").toUpperCase();
    if (status === "COMPLETED" || status === "IN_PROGRESS") {
      completedByStudent.get(Number(p.student_id))!.add(Number(p.course_id));
    }
  }

  // 7. Gen-ed bucket courses keyed by breadth_package_id
  const breadthPackages = Array.from(
    new Set(
      (students ?? [])
        .map((s: any) => s.breadth_package_id)
        .filter((v: string | null): v is string => !!v)
    )
  );
  const { data: genEdRows } = breadthPackages.length
    ? await supabase
        .from(DB_TABLES.genEdBucketCourses)
        .select("bucket_id, course_id")
    : { data: [] };
  // Without a clear bucket→package join table here, we treat all bucket
  // courses as the gen-ed pool. If the schema has a stricter package→bucket
  // mapping, refine in a follow-up. For now: union of all gen-ed courses.
  const genEdRequired = new Set<number>(
    (genEdRows ?? []).map((r: any) => Number(r.course_id))
  );

  // 8. Build the response
  return (students ?? []).map((s: any) => {
    const sid = Number(s.id);
    const pid = primaryByStudent.get(sid) ?? null;
    const meta = pid != null ? programById.get(pid) ?? null : null;
    const completed = completedByStudent.get(sid) ?? new Set<number>();
    const required = pid != null ? requiredByProgram.get(pid) ?? new Set() : new Set();
    return {
      id: sid,
      firstName: s.first_name,
      lastName: s.last_name,
      email: s.email,
      primaryProgramId: pid,
      primaryProgramName: meta?.name ?? null,
      primaryProgramType: meta?.programType ?? null,
      expectedGradSemester: s.expected_graduation_semester,
      expectedGradYear: s.expected_graduation_year,
      majorProgressPct: computeProgressPct(completed, required),
      genEdProgressPct: computeProgressPct(completed, genEdRequired),
    };
  });
}
```

- [ ] **Step 4: Run — expect pass**

Run: `npx vitest run src/__tests__/lib/supabase/queries/advisor-students.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabase/queries/advisor-students.ts src/__tests__/lib/supabase/queries/advisor-students.test.ts
git commit -m "feat(GT-180): listStudentsForAdvisor query with progress computation"
```

### Task 3.3 — `getStudentOverview`

**Files:**
- Modify: `src/lib/supabase/queries/advisor-students.ts`
- Modify: `src/__tests__/lib/supabase/queries/advisor-students.test.ts`

- [ ] **Step 1: Add the failing test**

Append:

```ts
import { getStudentOverview } from "@/lib/supabase/queries/advisor-students";

describe("getStudentOverview", () => {
  it("returns profile, programs, gen-ed progress and plans", async () => {
    const supabase = makeSupabase({
      students: () =>
        chain([
          {
            id: 1,
            first_name: "Ada",
            last_name: "Lovelace",
            email: "ada@example.com",
            expected_graduation_semester: "Spring",
            expected_graduation_year: 2027,
            breadth_package_id: "PKG_A",
          },
        ]),
      student_programs: () =>
        chain([{ student_id: 1, program_id: 10 }]),
      programs: () =>
        chain([{ id: 10, name: "CS", program_type: "MAJOR" }]),
      program_requirement_blocks: () =>
        chain([{ id: 100, program_id: 10 }]),
      program_requirement_courses: () =>
        chain([
          { block_id: 100, course_id: 1000 },
          { block_id: 100, course_id: 1001 },
        ]),
      student_course_history: () =>
        chain([{ student_id: 1, course_id: 1000, completed: true }]),
      student_planned_courses: () => chain([]),
      gen_ed_bucket_courses: () => chain([]),
      plans: () =>
        chain([
          {
            id: 50,
            name: "Plan A",
            description: "first try",
            created_at: "2026-04-01",
            updated_at: "2026-04-10",
          },
        ]),
      student_term_plan: () => chain([{ plan_id: 50, term_id: 7 }]),
    });

    const result = await getStudentOverview(supabase as any, 1, 1);
    expect(result.profile.firstName).toBe("Ada");
    expect(result.programs).toHaveLength(1);
    expect(result.programs[0]).toMatchObject({
      id: 10,
      name: "CS",
      progressPct: 50,
      completedReqs: 1,
      totalReqs: 2,
    });
    expect(result.plans).toHaveLength(1);
    expect(result.plans[0]).toMatchObject({ id: 50, name: "Plan A" });
  });
});
```

- [ ] **Step 2: Run — expect failure**

Run: `npx vitest run src/__tests__/lib/supabase/queries/advisor-students.test.ts`
Expected: `getStudentOverview` not exported.

- [ ] **Step 3: Implement**

Append to `src/lib/supabase/queries/advisor-students.ts`:

```ts
export type StudentOverview = {
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
  genEdProgress: { progressPct: number; completed: number; total: number };
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

export async function getStudentOverview(
  supabase: SupabaseLike,
  _staffId: number, // already authorized via requireAdvisorCanViewStudent
  studentId: number
): Promise<StudentOverview> {
  // Profile
  const { data: studentRows } = await supabase
    .from(DB_TABLES.students)
    .select(
      "id, first_name, last_name, email, expected_graduation_semester, expected_graduation_year, breadth_package_id"
    )
    .eq("id", studentId);
  const s = (studentRows ?? [])[0];
  if (!s) throw new Error(`Student ${studentId} not found`);

  // Enrolled programs
  const { data: enrollments } = await supabase
    .from(DB_TABLES.studentPrograms)
    .select("program_id")
    .eq("student_id", studentId);
  const programIds = (enrollments ?? []).map((r: any) => Number(r.program_id));

  const { data: programRows } = programIds.length
    ? await supabase
        .from(DB_TABLES.programs)
        .select("id, name, program_type")
        .in("id", programIds)
    : { data: [] };

  // Required courses per program
  const { data: blocks } = programIds.length
    ? await supabase
        .from(DB_TABLES.programRequirementBlocks)
        .select("id, program_id")
        .in("program_id", programIds)
    : { data: [] };
  const blockToProgram = new Map<number, number>();
  for (const b of blocks ?? []) blockToProgram.set(Number(b.id), Number(b.program_id));
  const blockIds = Array.from(blockToProgram.keys());
  const { data: reqCourses } = blockIds.length
    ? await supabase
        .from(DB_TABLES.programRequirementCourses)
        .select("block_id, course_id")
        .in("block_id", blockIds)
    : { data: [] };
  const requiredByProgram = new Map<number, Set<number>>();
  for (const rc of reqCourses ?? []) {
    const pid = blockToProgram.get(Number(rc.block_id));
    if (pid == null) continue;
    if (!requiredByProgram.has(pid)) requiredByProgram.set(pid, new Set());
    requiredByProgram.get(pid)!.add(Number(rc.course_id));
  }

  // Completed / in-progress courses for this student
  const { data: history } = await supabase
    .from(DB_TABLES.studentCourseHistory)
    .select("course_id, completed")
    .eq("student_id", studentId);
  const { data: planned } = await supabase
    .from(DB_TABLES.studentPlannedCourses)
    .select("course_id, status")
    .eq("student_id", studentId);
  const completed = new Set<number>();
  for (const h of history ?? []) {
    if (h.completed !== false) completed.add(Number(h.course_id));
  }
  for (const p of planned ?? []) {
    const status = String(p.status ?? "").toUpperCase();
    if (status === "COMPLETED" || status === "IN_PROGRESS") {
      completed.add(Number(p.course_id));
    }
  }

  // Gen-ed
  const { data: genEdRows } = s.breadth_package_id
    ? await supabase
        .from(DB_TABLES.genEdBucketCourses)
        .select("course_id")
    : { data: [] };
  const genEdRequired = new Set<number>(
    (genEdRows ?? []).map((r: any) => Number(r.course_id))
  );
  let genEdHit = 0;
  for (const c of genEdRequired) if (completed.has(c)) genEdHit++;

  // Plans + term counts
  const { data: planRows } = await supabase
    .from(DB_TABLES.plans)
    .select("id, name, description, created_at, updated_at")
    .eq("student_id", studentId)
    .order("updated_at");
  const planIds = (planRows ?? []).map((p: any) => Number(p.id));
  const { data: termPlans } = planIds.length
    ? await supabase
        .from(DB_TABLES.studentTermPlan)
        .select("plan_id, term_id")
        .in("plan_id", planIds)
    : { data: [] };
  const termCountByPlan = new Map<number, number>();
  for (const tp of termPlans ?? []) {
    const pid = Number(tp.plan_id);
    termCountByPlan.set(pid, (termCountByPlan.get(pid) ?? 0) + 1);
  }

  return {
    profile: {
      id: Number(s.id),
      firstName: s.first_name,
      lastName: s.last_name,
      email: s.email,
      expectedGradSemester: s.expected_graduation_semester,
      expectedGradYear: s.expected_graduation_year,
      breadthPackageId: s.breadth_package_id,
    },
    programs: (programRows ?? []).map((p: any) => {
      const required = requiredByProgram.get(Number(p.id)) ?? new Set();
      let hit = 0;
      for (const c of required) if (completed.has(c)) hit++;
      return {
        id: Number(p.id),
        name: p.name,
        programType: p.program_type,
        progressPct: computeProgressPct(completed, required),
        completedReqs: hit,
        totalReqs: required.size,
      };
    }),
    genEdProgress: {
      progressPct: computeProgressPct(completed, genEdRequired),
      completed: genEdHit,
      total: genEdRequired.size,
    },
    plans: (planRows ?? [])
      .slice()
      .reverse() // updated_at DESC
      .map((p: any) => ({
        id: Number(p.id),
        name: p.name,
        description: p.description,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
        totalCredits: 0, // intentionally 0 in v1 — see note below
        termCount: termCountByPlan.get(Number(p.id)) ?? 0,
      })),
  };
}
```

> Note on `totalCredits`: a precise computation requires joining `student_planned_courses` → `courses` per plan. For the v1 overview the term count is the more useful signal; defer the credit total to a follow-up if the demo calls for it.

- [ ] **Step 4: Run — expect pass**

Run: `npx vitest run src/__tests__/lib/supabase/queries/advisor-students.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabase/queries/advisor-students.ts src/__tests__/lib/supabase/queries/advisor-students.test.ts
git commit -m "feat(GT-180): getStudentOverview query"
```

---

## Phase 4 — Sidebar Nav

### Task 4.1 — Add the Students nav item

**Files:**
- Modify: `src/components/admin/AdminSidebar.tsx`

- [ ] **Step 1: Add the import and nav entry**

In `src/components/admin/AdminSidebar.tsx`, update the icon import to include `LuUsers`:

```tsx
import {
  LuBookMarked,
  LuBlocks,
  LuBookOpen,
  LuLayoutDashboard,
  LuLogOut,
  LuShield,
  LuUsers,
} from "react-icons/lu";
```

Then update `navItems`:

```tsx
const navItems: NavItem[] = [
  { icon: LuLayoutDashboard, label: "Dashboard", href: "/admin" },
  { icon: LuBookOpen,        label: "Courses",   href: "/admin/courses" },
  { icon: LuBookMarked,      label: "Programs",  href: "/admin/programs" },
  { icon: LuUsers,           label: "Students",  href: "/admin/students" },
  { icon: LuBlocks,          label: "Gen-Ed",    href: "/admin/gen-ed" },
];
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit src/components/admin/AdminSidebar.tsx 2>&1 | head -5`
Expected: no errors specific to this file.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/AdminSidebar.tsx
git commit -m "feat(GT-180): add Students nav item to admin sidebar"
```

---

## Phase 5 — Students List Page

### Task 5.1 — `StudentsListClient` component

**Files:**
- Create: `src/app/admin/(protected)/students/StudentsListClient.tsx`
- Create: `src/__tests__/app/admin/students/StudentsListClient.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/__tests__/app/admin/students/StudentsListClient.test.tsx
import { describe, it, expect } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithChakra } from "../../../helpers/mocks";
import StudentsListClient from "@/app/admin/(protected)/students/StudentsListClient";
import type { AdvisorStudentRow } from "@/lib/supabase/queries/advisor-students";

const fixtures: AdvisorStudentRow[] = [
  {
    id: 1,
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@example.com",
    primaryProgramId: 10,
    primaryProgramName: "Computer Science",
    primaryProgramType: "MAJOR",
    expectedGradSemester: "Spring",
    expectedGradYear: 2027,
    majorProgressPct: 65,
    genEdProgressPct: 40,
  },
  {
    id: 2,
    firstName: "Alan",
    lastName: "Turing",
    email: "alan@example.com",
    primaryProgramId: 10,
    primaryProgramName: "Computer Science",
    primaryProgramType: "MAJOR",
    expectedGradSemester: "Fall",
    expectedGradYear: 2028,
    majorProgressPct: 25,
    genEdProgressPct: 80,
  },
];

describe("StudentsListClient", () => {
  it("renders one card per student", () => {
    renderWithChakra(<StudentsListClient students={fixtures} />);
    expect(screen.getAllByText("Ada Lovelace").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Alan Turing").length).toBeGreaterThanOrEqual(1);
  });

  it("filters by name as the user types", () => {
    renderWithChakra(<StudentsListClient students={fixtures} />);
    const input = screen.getByPlaceholderText(/search/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "alan" } });
    expect(screen.queryByText("Ada Lovelace")).toBeNull();
    expect(screen.getAllByText("Alan Turing").length).toBeGreaterThanOrEqual(1);
  });

  it("renders empty state when no students", () => {
    renderWithChakra(<StudentsListClient students={[]} />);
    expect(
      screen.getAllByText(/no students enrolled/i).length
    ).toBeGreaterThanOrEqual(1);
  });
});
```

- [ ] **Step 2: Run — expect failure**

Run: `npx vitest run src/__tests__/app/admin/students/StudentsListClient.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the client component**

```tsx
// src/app/admin/(protected)/students/StudentsListClient.tsx
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Badge,
  Box,
  Card,
  HStack,
  Heading,
  Input,
  Progress,
  SimpleGrid,
  Stack,
  Text,
  VStack,
} from "@chakra-ui/react";
import type { AdvisorStudentRow } from "@/lib/supabase/queries/advisor-students";
import { getProgramColor } from "@/lib/program-colors";

function progressColor(pct: number): string {
  if (pct >= 75) return "green";
  if (pct >= 40) return "yellow";
  return "red";
}

function formatGrad(semester: string | null, year: number | null): string {
  if (!semester && !year) return "—";
  return `${semester ?? ""} ${year ?? ""}`.trim();
}

export default function StudentsListClient({
  students,
}: {
  students: AdvisorStudentRow[];
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) => {
      const name = `${s.firstName} ${s.lastName}`.toLowerCase();
      return name.includes(q) || s.email.toLowerCase().includes(q);
    });
  }, [students, query]);

  return (
    <Stack gap="6">
      <HStack justify="space-between" align="center" wrap="wrap" gap="3">
        <HStack gap="2">
          <Heading
            size="lg"
            fontFamily="var(--font-dm-sans), sans-serif"
            fontWeight="700"
            letterSpacing="-0.02em"
          >
            Students
          </Heading>
          <Badge colorPalette="gray" variant="subtle">{students.length}</Badge>
        </HStack>
        <Input
          placeholder="Search name or email…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          maxW="sm"
        />
      </HStack>

      {filtered.length === 0 ? (
        <Card.Root borderWidth="1px" borderColor="border.subtle" borderStyle="dashed">
          <Card.Body py="16" textAlign="center">
            <Text color="fg.muted">
              {students.length === 0
                ? "No students enrolled in your programs yet."
                : "No students match your search."}
            </Text>
          </Card.Body>
        </Card.Root>
      ) : (
        <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} gap="4">
          {filtered.map((s) => (
            <Link
              key={s.id}
              href={`/admin/students/${s.id}`}
              style={{ textDecoration: "none" }}
            >
              <Card.Root
                borderWidth="1px"
                borderColor="border.subtle"
                cursor="pointer"
                transition="all 0.15s"
                _hover={{ borderColor: "border", transform: "translateY(-2px)", boxShadow: "md" }}
                h="full"
              >
                <Card.Body p="5">
                  <VStack align="stretch" gap="3" h="full">
                    <Box>
                      <Text fontWeight="600">{s.firstName} {s.lastName}</Text>
                      <Text fontSize="xs" color="fg.muted">{s.email}</Text>
                    </Box>
                    <HStack gap="2" wrap="wrap">
                      {s.primaryProgramName && (
                        <Badge
                          colorPalette={getProgramColor(s.primaryProgramType ?? "")}
                          variant="surface"
                          size="sm"
                        >
                          {s.primaryProgramName}
                        </Badge>
                      )}
                      <Badge variant="outline" size="sm" color="fg.muted">
                        {formatGrad(s.expectedGradSemester, s.expectedGradYear)}
                      </Badge>
                    </HStack>
                    <Stack gap="2" pt="1">
                      <Box>
                        <HStack justify="space-between" mb="1">
                          <Text fontSize="xs" color="fg.muted">Major</Text>
                          <Text fontSize="xs" fontWeight="500">{s.majorProgressPct}%</Text>
                        </HStack>
                        <Progress.Root value={s.majorProgressPct} size="xs" colorPalette={progressColor(s.majorProgressPct)}>
                          <Progress.Track>
                            <Progress.Range />
                          </Progress.Track>
                        </Progress.Root>
                      </Box>
                      <Box>
                        <HStack justify="space-between" mb="1">
                          <Text fontSize="xs" color="fg.muted">Gen-Ed</Text>
                          <Text fontSize="xs" fontWeight="500">{s.genEdProgressPct}%</Text>
                        </HStack>
                        <Progress.Root value={s.genEdProgressPct} size="xs" colorPalette={progressColor(s.genEdProgressPct)}>
                          <Progress.Track>
                            <Progress.Range />
                          </Progress.Track>
                        </Progress.Root>
                      </Box>
                    </Stack>
                  </VStack>
                </Card.Body>
              </Card.Root>
            </Link>
          ))}
        </SimpleGrid>
      )}
    </Stack>
  );
}
```

- [ ] **Step 4: Run — expect pass**

Run: `npx vitest run src/__tests__/app/admin/students/StudentsListClient.test.tsx`
Expected: 3 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/\(protected\)/students/StudentsListClient.tsx src/__tests__/app/admin/students/StudentsListClient.test.tsx
git commit -m "feat(GT-180): StudentsListClient with name/email search"
```

### Task 5.2 — Server page wiring

**Files:**
- Create: `src/app/admin/(protected)/students/page.tsx`

- [ ] **Step 1: Implement the server page**

```tsx
// src/app/admin/(protected)/students/page.tsx
import { createClient } from "@/lib/supabase/server";
import { requireAdvisorAccess } from "../programs/server-helpers";
import { listStudentsForAdvisor } from "@/lib/supabase/queries/advisor-students";
import StudentsListClient from "./StudentsListClient";

export default async function AdminStudentsPage() {
  const supabase = await createClient();
  const { staffId } = await requireAdvisorAccess(supabase);
  const students = await listStudentsForAdvisor(supabase, staffId);
  return <StudentsListClient students={students} />;
}
```

- [ ] **Step 2: Manual smoke test**

Run: `npm run dev`
Open `http://localhost:3000/admin/students` in an advisor account. Expected: students list renders. If no students are enrolled in your programs, the empty state shows.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/\(protected\)/students/page.tsx
git commit -m "feat(GT-180): /admin/students list page"
```

---

## Phase 6 — Student Overview Page

### Task 6.1 — `StudentOverviewClient` component

**Files:**
- Create: `src/app/admin/(protected)/students/[studentId]/StudentOverviewClient.tsx`
- Create: `src/__tests__/app/admin/students/StudentOverviewClient.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/__tests__/app/admin/students/StudentOverviewClient.test.tsx
import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithChakra } from "../../../helpers/mocks";
import StudentOverviewClient from "@/app/admin/(protected)/students/[studentId]/StudentOverviewClient";
import type { StudentOverview } from "@/lib/supabase/queries/advisor-students";

const overview: StudentOverview = {
  profile: {
    id: 1,
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@example.com",
    expectedGradSemester: "Spring",
    expectedGradYear: 2027,
    breadthPackageId: "PKG_A",
  },
  programs: [
    { id: 10, name: "Computer Science", programType: "MAJOR", progressPct: 60, completedReqs: 6, totalReqs: 10 },
  ],
  genEdProgress: { progressPct: 30, completed: 3, total: 10 },
  plans: [
    {
      id: 50,
      name: "Plan A",
      description: "primary plan",
      createdAt: "2026-04-01",
      updatedAt: "2026-04-10",
      totalCredits: 0,
      termCount: 4,
    },
  ],
};

describe("StudentOverviewClient", () => {
  it("renders the student name and email", () => {
    renderWithChakra(<StudentOverviewClient overview={overview} />);
    expect(screen.getAllByText("Ada Lovelace").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("ada@example.com").length).toBeGreaterThanOrEqual(1);
  });

  it("renders one progress card per program plus gen-ed", () => {
    renderWithChakra(<StudentOverviewClient overview={overview} />);
    expect(screen.getAllByText("Computer Science").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/gen-?ed/i).length).toBeGreaterThanOrEqual(1);
  });

  it("links each plan card to the read-only planner route", () => {
    renderWithChakra(<StudentOverviewClient overview={overview} />);
    const link = screen.getAllByRole("link", { name: /plan a/i })[0];
    expect(link).toHaveAttribute("href", "/admin/students/1/planner?planId=50");
  });

  it("renders empty plans state when student has no plans", () => {
    renderWithChakra(
      <StudentOverviewClient overview={{ ...overview, plans: [] }} />
    );
    expect(
      screen.getAllByText(/Ada hasn't created a plan/i).length
    ).toBeGreaterThanOrEqual(1);
  });
});
```

- [ ] **Step 2: Run — expect failure**

Run: `npx vitest run src/__tests__/app/admin/students/StudentOverviewClient.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement the client component**

```tsx
// src/app/admin/(protected)/students/[studentId]/StudentOverviewClient.tsx
"use client";

import Link from "next/link";
import {
  Badge,
  Box,
  Card,
  HStack,
  Heading,
  SimpleGrid,
  Stack,
  Text,
  VStack,
  Progress,
} from "@chakra-ui/react";
import {
  BreadcrumbCurrentLink,
  BreadcrumbLink,
  BreadcrumbRoot,
} from "@/components/ui/breadcrumb";
import { getProgramColor } from "@/lib/program-colors";
import type { StudentOverview } from "@/lib/supabase/queries/advisor-students";

function progressColor(pct: number): string {
  if (pct >= 75) return "green";
  if (pct >= 40) return "yellow";
  return "red";
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return iso;
  }
}

export default function StudentOverviewClient({
  overview,
}: {
  overview: StudentOverview;
}) {
  const { profile, programs, genEdProgress, plans } = overview;
  const fullName = `${profile.firstName} ${profile.lastName}`;

  return (
    <Stack gap="6">
      <BreadcrumbRoot size="sm">
        <BreadcrumbLink asChild>
          <Link href="/admin">Admin</Link>
        </BreadcrumbLink>
        <BreadcrumbLink asChild>
          <Link href="/admin/students">Students</Link>
        </BreadcrumbLink>
        <BreadcrumbCurrentLink>{fullName}</BreadcrumbCurrentLink>
      </BreadcrumbRoot>

      <Card.Root borderWidth="1px" borderColor="border.subtle">
        <Card.Body p="6">
          <Heading
            fontSize="2xl"
            fontFamily="var(--font-dm-sans), sans-serif"
            fontWeight="700"
            letterSpacing="-0.02em"
          >
            {fullName}
          </Heading>
          <Text color="fg.muted" fontSize="sm" mt="1">
            {profile.email}
          </Text>
          {(profile.expectedGradSemester || profile.expectedGradYear) && (
            <Text mt="2" fontSize="sm">
              Expected graduation:{" "}
              <Text as="span" fontWeight="500">
                {profile.expectedGradSemester ?? ""} {profile.expectedGradYear ?? ""}
              </Text>
            </Text>
          )}
        </Card.Body>
      </Card.Root>

      <Box>
        <Heading
          fontSize="md"
          fontFamily="var(--font-dm-sans), sans-serif"
          fontWeight="600"
          mb="3"
        >
          Progress
        </Heading>
        <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} gap="4">
          {programs.map((p) => (
            <Card.Root key={p.id} borderWidth="1px" borderColor="border.subtle">
              <Card.Body p="4">
                <HStack justify="space-between" mb="2">
                  <Badge colorPalette={getProgramColor(p.programType)} variant="surface" size="sm">
                    {p.name}
                  </Badge>
                  <Text fontSize="sm" fontWeight="600">{p.progressPct}%</Text>
                </HStack>
                <Progress.Root value={p.progressPct} size="sm" colorPalette={progressColor(p.progressPct)}>
                  <Progress.Track>
                    <Progress.Range />
                  </Progress.Track>
                </Progress.Root>
                <Text fontSize="xs" color="fg.muted" mt="2">
                  {p.completedReqs} of {p.totalReqs} requirements complete
                </Text>
              </Card.Body>
            </Card.Root>
          ))}
          <Card.Root borderWidth="1px" borderColor="border.subtle">
            <Card.Body p="4">
              <HStack justify="space-between" mb="2">
                <Badge colorPalette="purple" variant="surface" size="sm">Gen-Ed</Badge>
                <Text fontSize="sm" fontWeight="600">{genEdProgress.progressPct}%</Text>
              </HStack>
              <Progress.Root value={genEdProgress.progressPct} size="sm" colorPalette={progressColor(genEdProgress.progressPct)}>
                <Progress.Track>
                  <Progress.Range />
                </Progress.Track>
              </Progress.Root>
              <Text fontSize="xs" color="fg.muted" mt="2">
                {genEdProgress.completed} of {genEdProgress.total} courses complete
              </Text>
            </Card.Body>
          </Card.Root>
        </SimpleGrid>
      </Box>

      <Box>
        <Heading
          fontSize="md"
          fontFamily="var(--font-dm-sans), sans-serif"
          fontWeight="600"
          mb="3"
        >
          Plans
        </Heading>
        {plans.length === 0 ? (
          <Card.Root borderWidth="1px" borderColor="border.subtle" borderStyle="dashed">
            <Card.Body py="10" textAlign="center">
              <Text color="fg.muted">
                {profile.firstName} hasn&apos;t created a plan yet.
              </Text>
            </Card.Body>
          </Card.Root>
        ) : (
          <SimpleGrid columns={{ base: 1, md: 2 }} gap="4">
            {plans.map((plan, idx) => (
              <Link
                key={plan.id}
                href={`/admin/students/${profile.id}/planner?planId=${plan.id}`}
                style={{ textDecoration: "none" }}
              >
                <Card.Root
                  borderWidth="1px"
                  borderColor="border.subtle"
                  cursor="pointer"
                  transition="all 0.15s"
                  _hover={{ borderColor: "border", transform: "translateY(-2px)", boxShadow: "md" }}
                  h="full"
                >
                  <Card.Body p="5">
                    <VStack align="stretch" gap="2">
                      <HStack justify="space-between">
                        <Text fontWeight="600">{plan.name}</Text>
                        {idx === 0 && (
                          <Badge colorPalette="blue" variant="subtle" size="sm">
                            Latest
                          </Badge>
                        )}
                      </HStack>
                      {plan.description && (
                        <Text fontSize="sm" color="fg.muted" lineClamp={2}>
                          {plan.description}
                        </Text>
                      )}
                      <Text fontSize="xs" color="fg.muted">
                        {plan.termCount} {plan.termCount === 1 ? "term" : "terms"} · Updated {fmtDate(plan.updatedAt)}
                      </Text>
                    </VStack>
                  </Card.Body>
                </Card.Root>
              </Link>
            ))}
          </SimpleGrid>
        )}
      </Box>
    </Stack>
  );
}
```

- [ ] **Step 4: Run — expect pass**

Run: `npx vitest run src/__tests__/app/admin/students/StudentOverviewClient.test.tsx`
Expected: 4 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/\(protected\)/students/\[studentId\]/StudentOverviewClient.tsx src/__tests__/app/admin/students/StudentOverviewClient.test.tsx
git commit -m "feat(GT-180): StudentOverviewClient with progress + plans grid"
```

### Task 6.2 — Server page wiring

**Files:**
- Create: `src/app/admin/(protected)/students/[studentId]/page.tsx`

- [ ] **Step 1: Implement the page**

```tsx
// src/app/admin/(protected)/students/[studentId]/page.tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdvisorAccess } from "../../programs/server-helpers";
import { requireAdvisorCanViewStudent } from "../server-helpers";
import { getStudentOverview } from "@/lib/supabase/queries/advisor-students";
import StudentOverviewClient from "./StudentOverviewClient";

export default async function AdminStudentOverviewPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;
  const numericId = Number(studentId);
  if (Number.isNaN(numericId)) redirect("/admin/students");

  const supabase = await createClient();
  const { staffId } = await requireAdvisorAccess(supabase);
  await requireAdvisorCanViewStudent(supabase, staffId, numericId);
  const overview = await getStudentOverview(supabase, staffId, numericId);

  return <StudentOverviewClient overview={overview} />;
}
```

- [ ] **Step 2: Manual smoke test**

Run: `npm run dev`. Open `/admin/students`, click any student card → land on overview, see profile + progress + plans. If you visit `/admin/students/<id-not-in-your-programs>` you should be redirected to `/admin/students`.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/\(protected\)/students/\[studentId\]/page.tsx
git commit -m "feat(GT-180): /admin/students/[studentId] overview page"
```

---

## Phase 7 — Read-only Planner Route

### Task 7.1 — Wire `/admin/students/[studentId]/planner`

**Files:**
- Create: `src/app/admin/(protected)/students/[studentId]/planner/page.tsx`

- [ ] **Step 1: Implement the route**

```tsx
// src/app/admin/(protected)/students/[studentId]/planner/page.tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdvisorAccess } from "../../../programs/server-helpers";
import { requireAdvisorCanViewStudent } from "../../server-helpers";
import PlannerView from "@/components/planner/PlannerView";

export default async function AdvisorStudentPlannerPage({
  params,
  searchParams,
}: {
  params: Promise<{ studentId: string }>;
  searchParams: Promise<{ planId?: string }>;
}) {
  const { studentId } = await params;
  const { planId } = await searchParams;
  const numericId = Number(studentId);
  if (Number.isNaN(numericId)) redirect("/admin/students");

  const supabase = await createClient();
  const { staffId } = await requireAdvisorAccess(supabase);
  await requireAdvisorCanViewStudent(supabase, staffId, numericId);

  const numericPlanId = planId ? Number(planId) : undefined;

  return (
    <PlannerView
      studentId={numericId}
      mode="readonly"
      initialPlanId={
        numericPlanId != null && !Number.isNaN(numericPlanId) ? numericPlanId : undefined
      }
    />
  );
}
```

- [ ] **Step 2: Manual smoke test**

Run: `npm run dev`. Navigate `/admin/students` → click a student → click any plan card → land on `/admin/students/<id>/planner?planId=<pid>`. Expected:
- The read-only banner appears at the top: "Viewing as advisor — read only."
- The planner shows the chosen plan's semesters and courses.
- No Create/Delete/Add Semester buttons visible.
- Drag attempts on a course card do nothing.
- The plan switcher dropdown still works to navigate between plans.

If write affordances appear, return to Task 1.3 and find which one was missed.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/\(protected\)/students/\[studentId\]/planner/page.tsx
git commit -m "feat(GT-180): /admin/students/[studentId]/planner read-only route"
```

---

## Phase 8 — Final Verification

### Task 8.1 — Full test suite + lint + manual walkthrough

- [ ] **Step 1: Run all touched test files**

```bash
npx vitest run \
  src/__tests__/components/planner/PlannerView.test.tsx \
  src/__tests__/lib/supabase/queries/advisor-students.test.ts \
  src/__tests__/app/admin/students/
```
Expected: all PASS.

- [ ] **Step 2: Run the full planner test suite to confirm no regression**

```bash
npx vitest run src/__tests__/components/planner/
```
Expected: all PASS.

- [ ] **Step 3: Lint changed files only**

```bash
npx eslint \
  src/components/planner/PlannerView.tsx \
  src/lib/supabase/queries/advisor-students.ts \
  'src/app/admin/(protected)/students/**/*.{ts,tsx}' \
  src/components/admin/AdminSidebar.tsx
```
Expected: 0 new errors. The repo has a large pre-existing lint baseline; only investigate errors in the files just listed.

- [ ] **Step 4: Manual walkthrough of the full advisor flow**

Run: `npm run dev` and follow this script as an advisor account:
1. Sidebar shows "Students" between Programs and Gen-Ed.
2. Click "Students" → list page renders with all students enrolled in your programs. Search filters live. Each card shows program badge, expected grad, two progress bars.
3. Click a student → overview page. Breadcrumb: Admin › Students › {Name}. Progress cards visible (one per program + gen-ed). Plans grid below shows one card per plan with "Latest" badge on the most recent.
4. Click a plan card → read-only planner. Banner at top. No write buttons. Drag is inert. Plan switcher works.
5. Visit `/dashboard/planner` as a student → planner works exactly as before. No banner, all buttons present, drag works.
6. Visit `/admin/students/9999999` (invalid id) → redirected to `/admin/students`.

If any step fails, the matching task is the place to look.

- [ ] **Step 5: Push the branch and open a PR against `dev`**

```bash
git push -u origin feat/GT-180-advisor-students
gh pr create --base dev --title "feat(GT-180): advisor student visibility + read-only plan view" --body "$(cat <<'EOF'
## Summary
- Refactors `dashboard/planner/page.tsx` body into `<PlannerView studentId mode>` so the same component serves student-edit and advisor-readonly use cases.
- Adds `/admin/students` (list), `/admin/students/[id]` (overview), `/admin/students/[id]/planner` (read-only) routes plus a "Students" sidebar nav item.
- Adds `listStudentsForAdvisor` and `getStudentOverview` query helpers with a pure `computeProgressPct` for testability.
- Authorization helper `requireAdvisorCanViewStudent` redirects when the student is not enrolled in any of the advisor's programs.

## Test plan
- [x] `npx vitest run src/__tests__/components/planner/`
- [x] `npx vitest run src/__tests__/lib/supabase/queries/advisor-students.test.ts`
- [x] `npx vitest run src/__tests__/app/admin/students/`
- [x] Manual: student-side `/dashboard/planner` unchanged
- [x] Manual: advisor flow list → overview → read-only planner
- [x] Manual: cross-program access redirect

Closes GT-180.
EOF
)"
```

- [ ] **Step 6: Update Jira**

Use the Atlassian MCP to transition GT-180 to **In Review** (transition id `5`) and post a comment with the PR URL. The pattern matches what was done for GT-198.

---

## Out of Scope (explicit reminders)

These are intentionally NOT included — do not implement them in this branch:

- Editing student plans from the advisor side (future ticket — likely overlaps GT-179)
- Course suggestions for empty semester slots (future ticket)
- Notes / messaging between advisor and student
- Bulk actions on students
- Persisted "active plan" concept on the `plans` table — schema has no such flag
- Splitting `PlannerView` into smaller files (its own future ticket)
