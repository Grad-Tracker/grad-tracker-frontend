# Class History Feature — Design Spec

## Overview

Add a "Class History" tab to the Settings page (`/dashboard/settings`). The existing settings content moves under a "Profile" tab. The Class History tab lets students view and manage courses they've completed across three sections: Gen Ed, Major, and Additional courses.

## Architecture

**Approach:** Orchestrator + Section Components (Approach B). `ClassHistoryTab` fetches all data and passes props to focused presentational components. All data mutations flow through the orchestrator — section components and dialogs only call parent callbacks.

## Settings Page Modification

`src/app/dashboard/settings/page.tsx` wraps content in Chakra `Tabs` (enclosed variant, green color palette). The page header ("Account Settings") stays above the tabs. All existing cards move into a Profile tab panel. A new Class History tab panel renders `<ClassHistoryTab />`. Use Chakra v3 compound pattern (`Tabs.Root`, `Tabs.List`, `Tabs.Trigger`, `Tabs.Content`) — verify with MCP tools before implementation.

Tab state is client-side only. URL stays `/dashboard/settings`.

## Database Migration

An RLS policy must be added to allow authenticated users to INSERT into the `courses` table (needed for manual course entry). The existing CHECK constraints on `courses` provide safety:
- `subject` must match `^[A-Z]{2,10}$`
- `number` must match `^[0-9]{3,4}$`
- `credits >= 0`
- UNIQUE constraint on `(subject, number)`

Migration: `ALTER TABLE courses ENABLE ROW LEVEL SECURITY; CREATE POLICY "allow_authenticated_insert_courses" ON courses FOR INSERT TO authenticated WITH CHECK (true);`

## Types

Reuse existing types where possible:
- `CourseRow` from `src/types/onboarding.ts` — `{ id, subject, number, title, credits }`
- `GenEdBucketWithCourses` from `src/types/auto-generate.ts` — if compatible, reuse; otherwise define locally

New types in `src/lib/supabase/queries/classHistory.ts` (co-located with query functions):
- `StudentCourseHistoryRow`: `{ student_id: number, course_id: number, term_id: number, completed: boolean, grade: string | null, credits_override: number | null }`
- `MajorWithRequirements`: `{ majorName: string, blocks: { id: number, name: string, courses: CourseRow[] }[] } | null`

## Data Layer

**File:** `src/lib/supabase/queries/classHistory.ts`

All functions use `createClient()` from `@/lib/supabase/client` and `DB_TABLES` constants from `schema.ts`. Error handling follows existing pattern (throw on error).

### Functions

1. **`fetchDefaultTermId()`** — queries `terms` table ordered by `id ASC`, returns the first term's ID. This is a placeholder term to satisfy the NOT NULL `term_id` constraint; the actual term is not meaningful for class history entries.

2. **Reuse `fetchGenEdBucketsWithCourses()`** from `src/lib/supabase/queries/planner.ts` — do NOT duplicate this function. Import it where needed.

3. **`fetchMajorRequirementCourses(studentId: number)`** — gets student's major from `student_programs` (where `program_type = 'MAJOR'`) using `.maybeSingle()`. Returns `null` if no major. If a major exists, fetches `program_requirement_blocks` → `program_requirement_courses` → `courses`. Returns `MajorWithRequirements`.

4. **`fetchStudentCourseHistory(studentId: number)`** — all rows from `student_course_history` for this student, joined with course details from `courses`. Returns array of `{ course_id, course: CourseRow, completed, term_id }`.

5. **`insertCourseHistory(studentId, courseId, termId)`** — plain INSERT into `student_course_history` with `completed: true`. NOT upsert (students lack UPDATE RLS policy). Uses the composite PK `(student_id, course_id, term_id)`.

6. **`deleteCourseHistory(studentId, courseId, termId)`** — DELETE by all 3 composite PK columns.

7. **`searchCourses(query: string)`** — searches `courses` table by subject+number or title using ilike, limited to 20 results. Minimum 2-character query enforced (return empty array for shorter queries).

8. **`insertManualCourse(subject, number, title, credits)`** — inserts into `courses` table (requires RLS migration above), returns the new row. Client-side validation must enforce CHECK constraints: subject uppercase alpha 2-10 chars, number 3-4 digits, credits >= 0.

### Toggle Pattern (INSERT + DELETE)

Since students lack an UPDATE RLS policy on `student_course_history`, the toggle pattern is:
- **Check ON:** `insertCourseHistory()` — plain INSERT
- **Check OFF:** `deleteCourseHistory()` — DELETE by PK

This avoids upsert entirely. If a duplicate insert is attempted (row already exists), handle the unique violation error gracefully.

### Database Context

- `student_course_history` composite PK: `(student_id, course_id, term_id)` — all three columns required for inserts and deletes.
- 3 gen ed buckets: Humanities & Arts, Natural Science, Social & Behavioral Science (12 credits each).
- `gen_ed_bucket_courses` junction: `(bucket_id, course_id)`.
- Terms table has entries from 2026-2033. Default term is the lowest ID term.
- `grade` column exists on `student_course_history` but grade entry is out of scope for this iteration.
- `credits_override` column exists but is not used in this iteration.

## Components

### `ClassHistoryTab.tsx` (Orchestrator)

**Path:** `src/components/settings/ClassHistoryTab.tsx`

Client component that:
- On mount: fetches student ID (same auth pattern as settings page), default term ID, gen ed data, major data, and student course history — all in parallel.
- Computes the set of "known" course IDs (union of gen ed + major course IDs) to derive additional courses: history entries whose course_id is NOT in the known set.
- Passes data + callbacks to the three section components.
- Single loading state; shows spinner until all data resolves.
- **Optimistic updates with rollback:** On toggle/add/delete, updates local state immediately, fires the DB call, and reverts state + shows error toast if the call fails.
- All mutation logic lives here — child components only call parent callbacks.

### `GenEdChecklist.tsx`

**Path:** `src/components/settings/GenEdChecklist.tsx`

**Props:** buckets (with nested courses), completed course ID set, toggle callback, loading state.

- Renders each bucket as a sub-section with heading (bucket name) and "X/Y credits completed" badge (credit-based since gen ed requirements are credit-based, using `credits_required` from `gen_ed_buckets`).
- Each course is a checkbox row: `SUBJ NUM — Title (X credits)`.
- Checkbox checked = course ID exists in completed set.
- On toggle: calls parent callback with course ID + checked state.

### `MajorChecklist.tsx`

**Path:** `src/components/settings/MajorChecklist.tsx`

**Props:** major name, requirement blocks (with nested courses), completed course ID set, toggle callback.

- Only rendered if student has a major (orchestrator handles conditional rendering).
- Groups courses by requirement block with block name as heading.
- Same checkbox + progress pattern as GenEdChecklist (course count based).
- Overall progress: "X/Y major courses completed".

### `AdditionalCourses.tsx`

**Path:** `src/components/settings/AdditionalCourses.tsx`

**Props:** additional courses array, delete callback, onAddCourse callback.

- Each course shows subject, number, title, credits + a delete icon button.
- "Add Course" button opens `CourseSearchDialog`.
- Empty state: "No additional courses added yet."

### `CourseSearchDialog.tsx`

**Path:** `src/components/settings/CourseSearchDialog.tsx`

**Props:** open state, onClose, onCourseSelected callback (delegates to orchestrator).

- Chakra `DialogRoot` (modal).
- Text input with debounced search (300ms) calling `searchCourses(query)`. Minimum 2 characters before search fires.
- Results displayed as a selectable list — clicking a course calls `onCourseSelected(course)` (orchestrator handles the DB insert).
- Below results: "Can't find your course? Add it manually" link switches to `ManualCourseForm`.

### `ManualCourseForm.tsx`

**Path:** `src/components/settings/ManualCourseForm.tsx`

**Props:** onCourseCreated callback (returns created CourseRow), onBack callback.

- Rendered inside the same dialog when triggered from search view.
- Fields: Subject (required, uppercase alpha 2-10 chars), Number (required, 3-4 digits), Title (required), Credits (required, >= 0).
- On submit: calls `insertManualCourse()` to create course row, then calls `onCourseCreated(newCourse)` so the orchestrator can link it to student history.
- "Back to search" link returns to search view.
- Client-side validation enforces DB CHECK constraints before submission.
- Toast on success/error.

## UI Guidelines

- Chakra UI v3 — verify patterns with MCP tools (`get_component_props`, `get_component_example`).
- Cards: `bg="bg"`, `borderRadius="xl"`, `borderWidth="1px"`, `borderColor="border.subtle"`.
- Green color palette for interactive elements.
- Semantic tokens only (no hardcoded colors).
- Toast via `toaster.create()` from `@/components/ui/toaster`.
- Import from `@/components/ui/` wrappers when available.

## Files Created

- `src/components/settings/ClassHistoryTab.tsx`
- `src/components/settings/GenEdChecklist.tsx`
- `src/components/settings/MajorChecklist.tsx`
- `src/components/settings/AdditionalCourses.tsx`
- `src/components/settings/CourseSearchDialog.tsx`
- `src/components/settings/ManualCourseForm.tsx`
- `src/lib/supabase/queries/classHistory.ts`

## Files Modified

- `src/app/dashboard/settings/page.tsx` — add Tabs wrapper, move existing content into Profile tab, add Class History tab

## Migration Required

- Add RLS INSERT policy on `courses` for authenticated users (for manual course entry)
