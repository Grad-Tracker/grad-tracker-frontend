-- Helper script: drop view objects introduced/modified by
-- 20260331141000_view_remaining_student_reads.sql
-- Safe for repeated runs.

begin;

drop view if exists public.v_terms_chronological;
drop view if exists public.v_student_course_history_detail;
drop view if exists public.v_student_primary_major_program;
drop view if exists public.v_program_requirement_detail;
drop view if exists public.v_course_catalog;
drop view if exists public.v_program_catalog;
drop view if exists public.v_plan_meta;

commit;
