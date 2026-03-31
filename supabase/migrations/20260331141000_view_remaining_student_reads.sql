-- View migration: remaining student-facing read paths
-- Adds catalog/requirements/class-history helper views and updates v_plan_meta

begin;

-- -----------------------------------------------------------------------------
-- v_plan_meta: fallback to student_programs when plan_programs links are missing
-- -----------------------------------------------------------------------------

create or replace view public.v_plan_meta
with (security_invoker = true)
as
with plan_program_rollup as (
  select
    pp.plan_id,
    array_agg(pp.program_id order by pp.program_id) as program_ids,
    bool_or(p.program_type = 'GRADUATE') as has_graduate_program
  from public.plan_programs pp
  join public.programs p on p.id = pp.program_id
  group by pp.plan_id
),
student_program_rollup as (
  select
    pl.id as plan_id,
    coalesce(array_agg(distinct sp.program_id order by sp.program_id), '{}'::bigint[]) as program_ids,
    coalesce(bool_or(p.program_type = 'GRADUATE'), false) as has_graduate_program
  from public.plans pl
  left join public.student_programs sp on sp.student_id = pl.student_id
  left join public.programs p on p.id = sp.program_id
  group by pl.id
),
term_rollup as (
  select
    stp.plan_id,
    count(*)::int as term_count
  from public.student_term_plan stp
  group by stp.plan_id
),
course_rollup as (
  select
    spc.plan_id,
    count(*)::int as course_count,
    coalesce(sum(c.credits), 0)::numeric as total_credits
  from public.student_planned_courses spc
  left join public.courses c on c.id = spc.course_id
  group by spc.plan_id
)
select
  pl.id as plan_id,
  pl.student_id,
  pl.name,
  pl.description,
  pl.created_at,
  pl.updated_at,
  case
    when coalesce(cardinality(pp.program_ids), 0) > 0 then pp.program_ids
    else coalesce(sp.program_ids, '{}'::bigint[])
  end as program_ids,
  coalesce(tr.term_count, 0) as term_count,
  coalesce(cr.course_count, 0) as course_count,
  coalesce(cr.total_credits, 0) as total_credits,
  case
    when coalesce(cardinality(pp.program_ids), 0) > 0 then coalesce(pp.has_graduate_program, false)
    else coalesce(sp.has_graduate_program, false)
  end as has_graduate_program
from public.plans pl
left join plan_program_rollup pp on pp.plan_id = pl.id
left join student_program_rollup sp on sp.plan_id = pl.id
left join term_rollup tr on tr.plan_id = pl.id
left join course_rollup cr on cr.plan_id = pl.id;

-- -----------------------------------------------------------------------------
-- Program and course catalog views
-- -----------------------------------------------------------------------------

create or replace view public.v_program_catalog
with (security_invoker = true)
as
select
  p.id as program_id,
  p.name as program_name,
  p.catalog_year,
  p.program_type
from public.programs p;

create or replace view public.v_course_catalog
with (security_invoker = true)
as
with prereq_rollup as (
  select
    crs.course_id,
    (
      array_agg(crs.note order by crs.id)
        filter (where crs.note is not null and btrim(crs.note) <> '')
    )[1] as prereq_text
  from public.course_req_sets crs
  where crs.set_type = 'PREREQ'
  group by crs.course_id
)
select
  c.id as course_id,
  c.subject,
  c.number,
  c.title,
  c.credits,
  c.description,
  coalesce(pr.prereq_text, c.prereq_text) as prereq_text,
  c.is_active
from public.courses c
left join prereq_rollup pr on pr.course_id = c.id
where c.is_active = true;

-- -----------------------------------------------------------------------------
-- Requirements detail aggregation for student read paths
-- -----------------------------------------------------------------------------

create or replace view public.v_program_requirement_detail
with (security_invoker = true)
as
with prereq_rollup as (
  select
    crs.course_id,
    (
      array_agg(crs.note order by crs.id)
        filter (where crs.note is not null and btrim(crs.note) <> '')
    )[1] as prereq_text
  from public.course_req_sets crs
  where crs.set_type = 'PREREQ'
  group by crs.course_id
),
block_base as (
  select
    prb.id as block_id,
    prb.program_id,
    p.name as program_name,
    p.catalog_year,
    p.program_type,
    prb.name as block_name,
    prb.rule,
    prb.n_required,
    prb.credits_required
  from public.program_requirement_blocks prb
  join public.programs p on p.id = prb.program_id
)
select
  bb.program_id,
  bb.program_name,
  bb.catalog_year,
  bb.program_type,
  bb.block_id,
  bb.block_name,
  bb.rule,
  bb.n_required,
  bb.credits_required,
  coalesce(ca.course_ids, '{}'::bigint[]) as course_ids,
  coalesce(ca.courses, '[]'::jsonb) as courses,
  coalesce(cla.cross_listings, '[]'::jsonb) as cross_listings,
  coalesce(na.req_nodes, '[]'::jsonb) as req_nodes
from block_base bb
left join lateral (
  select
    coalesce(
      array_agg(prc.course_id order by prc.course_id)
        filter (where prc.course_id is not null),
      '{}'::bigint[]
    ) as course_ids,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'course_id', c.id,
          'subject', c.subject,
          'number', c.number,
          'title', c.title,
          'credits', c.credits,
          'description', c.description,
          'prereq_text', coalesce(pr.prereq_text, c.prereq_text)
        )
        order by c.subject, c.number
      ) filter (where c.id is not null),
      '[]'::jsonb
    ) as courses
  from public.program_requirement_courses prc
  left join public.courses c on c.id = prc.course_id
  left join prereq_rollup pr on pr.course_id = c.id
  where prc.block_id = bb.block_id
) ca on true
left join lateral (
  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'course_id', cl.course_id,
          'cross_subject', cl.cross_subject,
          'cross_number', cl.cross_number,
          'crosslisted_course_id', cl.crosslisted_course_id
        )
        order by cl.course_id, cl.cross_subject, cl.cross_number
      ) filter (where cl.course_id is not null),
      '[]'::jsonb
    ) as cross_listings
  from public.program_requirement_courses prc
  join public.course_crosslistings cl on cl.course_id = prc.course_id
  where prc.block_id = bb.block_id
) cla on true
left join lateral (
  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'set_id', rs.id,
          'node_id', rn.id,
          'node_type', rn.node_type,
          'parent_id', rn.parent_id,
          'sort_order', rn.sort_order,
          'atom_type', ra.atom_type,
          'required_course_id', ra.required_course_id
        )
        order by rs.id, rn.sort_order, rn.id
      ) filter (where rn.id is not null),
      '[]'::jsonb
    ) as req_nodes
  from public.program_req_sets rs
  join public.program_req_nodes rn on rn.req_set_id = rs.id
  left join public.program_req_atoms ra on ra.node_id = rn.id
  where rs.block_id = bb.block_id
) na on true;

-- -----------------------------------------------------------------------------
-- Student major and class history helper views
-- -----------------------------------------------------------------------------

create or replace view public.v_student_primary_major_program
with (security_invoker = true)
as
select distinct on (sp.student_id)
  sp.student_id,
  p.id as program_id,
  p.name as program_name,
  p.catalog_year,
  p.program_type
from public.student_programs sp
join public.programs p on p.id = sp.program_id
where p.program_type = 'MAJOR'
order by sp.student_id, p.id;

create or replace view public.v_student_course_history_detail
with (security_invoker = true)
as
with prereq_rollup as (
  select
    crs.course_id,
    (
      array_agg(crs.note order by crs.id)
        filter (where crs.note is not null and btrim(crs.note) <> '')
    )[1] as prereq_text
  from public.course_req_sets crs
  where crs.set_type = 'PREREQ'
  group by crs.course_id
)
select
  sch.student_id,
  sch.term_id,
  sch.course_id,
  sch.completed,
  sch.grade,
  c.subject,
  c.number,
  c.title,
  c.credits,
  c.description,
  coalesce(pr.prereq_text, c.prereq_text) as prereq_text
from public.student_course_history sch
join public.courses c on c.id = sch.course_id
left join prereq_rollup pr on pr.course_id = c.id;

-- -----------------------------------------------------------------------------
-- Term ordering helper view
-- -----------------------------------------------------------------------------

create or replace view public.v_terms_chronological
with (security_invoker = true)
as
select
  t.id as term_id,
  t.season,
  t.year,
  case
    when lower(t.season) = 'spring' then 1
    when lower(t.season) = 'summer' then 2
    when lower(t.season) = 'fall' then 3
    else 9
  end as season_rank,
  row_number() over (
    order by
      t.year,
      case
        when lower(t.season) = 'spring' then 1
        when lower(t.season) = 'summer' then 2
        when lower(t.season) = 'fall' then 3
        else 9
      end,
      t.id
  ) as chronological_rank
from public.terms t;

commit;
