-- Batch 04: Major catalog reconciliation targeted review mappings (2025-2026)
-- Scope:
-- - Resolve remaining non-foundational MISSING_REVIEW_COURSE_MAPPING items.
-- - Keep inserts additive and idempotent.

insert into public.program_requirement_courses (block_id, course_id)
select
  b.id as block_id,
  c.id as course_id
from public.programs p
join public.program_requirement_blocks b
  on b.program_id = p.id
join public.courses c
  on c.subject = 'PHIL'
 and c.number = '206'
where p.name = 'Accounting Major (BS)'
  and b.name = 'A minimum grade of C or better is required in each course below (C- is not acceptable) - Required Courses'
  and not exists (
    select 1
    from public.program_requirement_courses prc
    where prc.block_id = b.id
      and prc.course_id = c.id
  );

insert into public.program_requirement_courses (block_id, course_id)
select
  b.id as block_id,
  c.id as course_id
from public.programs p
join public.program_requirement_blocks b
  on b.program_id = p.id
join public.courses c
  on c.subject = 'COMM'
 and c.number = '105'
where p.name = 'Financial Economics (AS)'
  and b.name = 'Basic Skills Requirements - English/Writing Skills Courses'
  and not exists (
    select 1
    from public.program_requirement_courses prc
    where prc.block_id = b.id
      and prc.course_id = c.id
  );

insert into public.program_requirement_courses (block_id, course_id)
select
  b.id as block_id,
  c.id as course_id
from public.programs p
join public.program_requirement_blocks b
  on b.program_id = p.id
join public.courses c
  on c.subject = 'SOCA'
 and c.number = '101'
where p.name = 'Nursing Major (BS)'
  and b.name = 'Pre-Nursing Prerequisites'
  and not exists (
    select 1
    from public.program_requirement_courses prc
    where prc.block_id = b.id
      and prc.course_id = c.id
  );

insert into public.program_requirement_courses (block_id, course_id)
select
  b.id as block_id,
  c.id as course_id
from public.programs p
join public.program_requirement_blocks b
  on b.program_id = p.id
join public.courses c
  on c.subject = 'COMM'
 and c.number = '105'
where p.name = 'Physics (AS)'
  and b.name = 'Basic Skills Requirements - English/Writing Skills Course'
  and not exists (
    select 1
    from public.program_requirement_courses prc
    where prc.block_id = b.id
      and prc.course_id = c.id
  );

insert into public.program_requirement_courses (block_id, course_id)
select
  b.id as block_id,
  c.id as course_id
from public.programs p
join public.program_requirement_blocks b
  on b.program_id = p.id
join public.courses c
  on c.subject = 'CSCI'
 and c.number = '410'
where p.name = 'Computer Science/Mathematics Double Major (BS)'
  and b.name = 'Requirements for the Computer Science/Mathematics Double Major'
  and not exists (
    select 1
    from public.program_requirement_courses prc
    where prc.block_id = b.id
      and prc.course_id = c.id
  );

insert into public.program_requirement_courses (block_id, course_id)
select
  b.id as block_id,
  c.id as course_id
from public.programs p
join public.program_requirement_blocks b
  on b.program_id = p.id
join public.courses c
  on c.subject = 'COMM'
 and c.number = '105'
where p.name = 'Laboratory Sciences (AS)'
  and b.name = 'General Education/Degree Requirements - Social and Behavioral Sciences Courses'
  and not exists (
    select 1
    from public.program_requirement_courses prc
    where prc.block_id = b.id
      and prc.course_id = c.id
  );

insert into public.program_requirement_courses (block_id, course_id)
select
  b.id as block_id,
  c.id as course_id
from public.programs p
join public.program_requirement_blocks b
  on b.program_id = p.id
join public.courses c
  on c.subject = 'PSYC'
 and c.number = '101'
where p.name = 'Laboratory Sciences (AS)'
  and b.name = 'General Education/Degree Requirements - Social and Behavioral Sciences Courses'
  and not exists (
    select 1
    from public.program_requirement_courses prc
    where prc.block_id = b.id
      and prc.course_id = c.id
  );

insert into public.program_requirement_courses (block_id, course_id)
select
  b.id as block_id,
  c.id as course_id
from public.programs p
join public.program_requirement_blocks b
  on b.program_id = p.id
join public.courses c
  on c.subject = 'SPMT'
 and c.number = '410'
where p.name = 'Sport Management Major (BS)'
  and b.name = 'Elective Courses'
  and not exists (
    select 1
    from public.program_requirement_courses prc
    where prc.block_id = b.id
      and prc.course_id = c.id
  );
