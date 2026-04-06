# View Migration Verification (Remaining Student Read Paths)
Date: 2026-03-31

## Switched Read Callsites
- `src/app/dashboard/requirements/page.tsx`
  - `programs` table -> `v_program_catalog`
- `src/app/dashboard/requirements/[id]/page.tsx`
  - `programs` + requirement/crosslist/tree tables -> `v_program_catalog` + `v_program_requirement_detail`
- `src/app/dashboard/courses/page.tsx`
  - `courses` (+ `course_req_sets`) -> `v_course_catalog`
- `src/lib/supabase/queries/classHistory.ts`
  - `terms` -> `v_terms_chronological`
  - `student_programs` + `programs` -> `v_student_primary_major_program`
  - `program_requirement_blocks` + `program_requirement_courses` -> `v_program_block_courses`
  - `student_course_history` joined read -> `v_student_course_history_detail`
  - `courses` search read -> `v_course_catalog`
- `src/components/settings/ClassHistoryTab.tsx`
  - `students` lookup -> `v_student_profile`
- `src/lib/supabase/queries/planner.ts`
  - removed legacy table-read fallback branches in `fetchPlans` and `fetchAvailableCourses`
  - reads stay on `v_plan_meta` and `v_program_block_courses`

## Remaining Non-Migrated Read Callsites (In This Slice)
- None.
- Write paths remain table-based by design.

## Temporary Limitation
- Student read flows use a deterministic single-major rule (`v_student_primary_major_program` selects the lowest `program_id` major per student).
- Double-major support is intentionally deferred for a future migration.

## Migration Verification Queries
```sql
-- View existence
select table_name
from information_schema.views
where table_schema = 'public'
  and table_name in (
    'v_plan_meta',
    'v_program_catalog',
    'v_course_catalog',
    'v_program_requirement_detail',
    'v_student_primary_major_program',
    'v_student_course_history_detail',
    'v_terms_chronological'
  )
order by table_name;
```

```sql
-- Spot-check new view row shapes
select * from public.v_program_catalog limit 1;
select * from public.v_course_catalog limit 1;
select * from public.v_program_requirement_detail limit 1;
select * from public.v_student_primary_major_program limit 1;
select * from public.v_student_course_history_detail limit 1;
select * from public.v_terms_chronological order by chronological_rank asc limit 1;
```

```sql
-- Confirm v_plan_meta fallback behavior on plans with no plan_programs rows
select plan_id, student_id, program_ids, has_graduate_program
from public.v_plan_meta
where coalesce(cardinality(program_ids), 0) > 0
limit 20;
```
