-- Align UW-Parkside Computer Science Major block credit targets with catalog intent.
-- Elective major courses: 12 credits (4 courses)
-- Breadth requirement: minimum 9 credits

with cs_programs as (
  select id
  from public.programs
  where name = 'Computer Science Major (BS)'
)
update public.program_requirement_blocks b
set credits_required = 12,
    updated_at = now()
from cs_programs p
where b.program_id = p.id
  and b.name = 'Required Major Courses - Elective Major Courses'
  and b.rule = 'N_OF'
  and b.credits_required is distinct from 12;

with cs_programs as (
  select id
  from public.programs
  where name = 'Computer Science Major (BS)'
)
update public.program_requirement_blocks b
set credits_required = 9,
    updated_at = now()
from cs_programs p
where b.program_id = p.id
  and b.name = 'Required Major Courses - Required Computer Science Breadth Requirement'
  and b.rule = 'N_OF'
  and b.credits_required is distinct from 9;
