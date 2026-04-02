-- Helper script: drop canonical read views created by 20260319162000_view_first_reads.sql
-- Safe for repeated runs.

begin;

drop view if exists public.v_plan_courses;
drop view if exists public.v_plan_terms;
drop view if exists public.v_plan_meta;
drop view if exists public.v_gened_bucket_courses;
drop view if exists public.v_program_block_courses;
drop view if exists public.v_student_course_progress;
drop view if exists public.v_student_major_program;
drop view if exists public.v_student_profile;

commit;
