-- Planner data cleanup: mark scaffold-only blocks as NON_PLANNABLE
-- and expose planner-friendly exclusion metadata on v_program_block_courses.

-- 1) Ensure flags table has metadata for cleanup provenance.
alter table public.program_requirement_block_flags
  add column if not exists metadata jsonb not null default '{}'::jsonb;

-- Existing environments may contain duplicate flags for the same
-- (block_id, flag_type). Keep the newest row before adding uniqueness.
with ranked as (
  select
    id,
    row_number() over (
      partition by block_id, flag_type
      order by updated_at desc nulls last, created_at desc nulls last, id desc
    ) as rn
  from public.program_requirement_block_flags
)
delete from public.program_requirement_block_flags prbf
using ranked
where prbf.id = ranked.id
  and ranked.rn > 1;

create unique index if not exists uq_program_requirement_block_flags_block_type
  on public.program_requirement_block_flags (block_id, flag_type);

-- 2) Backfill NON_PLANNABLE flags for requirement scaffold blocks:
--    no mapped courses and no recoverable COURSE atoms in requirement trees.
do $$
begin
  if to_regclass('public.program_req_sets') is not null
    and to_regclass('public.program_req_nodes') is not null
    and to_regclass('public.program_req_atoms') is not null then

    insert into public.program_requirement_block_flags (
      block_id,
      flag_type,
      note,
      manual_reason,
      metadata
    )
    with blocks_without_mapped_courses as (
      select b.id as block_id
      from public.program_requirement_blocks b
      left join public.program_requirement_courses prc
        on prc.block_id = b.id
      group by b.id
      having count(prc.course_id) = 0
    ),
    blocks_with_recoverable_atoms as (
      select distinct prs.block_id
      from public.program_req_sets prs
      join public.program_req_nodes prn
        on prn.req_set_id = prs.id
      join public.program_req_atoms pra
        on pra.node_id = prn.id
      where pra.atom_type::text = 'COURSE'
        and pra.required_course_id is not null
    )
    select
      bwmc.block_id,
      'NON_PLANNABLE',
      'No mapped courses and no recoverable COURSE atoms.',
      null,
      jsonb_build_object(
        'cleanup_source', 'planner_non_plannable_backfill',
        'backfilled_at', now()
      )
    from blocks_without_mapped_courses bwmc
    left join blocks_with_recoverable_atoms bwra
      on bwra.block_id = bwmc.block_id
    where bwra.block_id is null
    on conflict (block_id, flag_type) do update
    set
      note = excluded.note,
      metadata = excluded.metadata,
      updated_at = now();
  else
    insert into public.program_requirement_block_flags (
      block_id,
      flag_type,
      note,
      manual_reason,
      metadata
    )
    select
      b.id as block_id,
      'NON_PLANNABLE',
      'No mapped courses and no recoverable COURSE atoms.',
      null,
      jsonb_build_object(
        'cleanup_source', 'planner_non_plannable_backfill_fallback',
        'backfilled_at', now()
      )
    from public.program_requirement_blocks b
    left join public.program_requirement_courses prc
      on prc.block_id = b.id
    group by b.id
    having count(prc.course_id) = 0
    on conflict (block_id, flag_type) do update
    set
      note = excluded.note,
      metadata = excluded.metadata,
      updated_at = now();
  end if;
end $$;

-- 3) Add planner columns to v_program_block_courses while preserving existing
--    columns via a wrapper view.
do $$
begin
  if to_regclass('public.v_program_block_courses_base') is null
    and to_regclass('public.v_program_block_courses') is not null then
    alter view public.v_program_block_courses
      rename to v_program_block_courses_base;
  end if;

  if to_regclass('public.v_program_block_courses_base') is not null then
    execute $view$
      create or replace view public.v_program_block_courses as
      select
        base.*,
        coalesce(non_plannable.block_id is null, true) as is_plannable,
        coalesce(non_plannable.note, non_plannable.manual_reason) as planner_exclusion_reason
      from public.v_program_block_courses_base base
      left join (
        select distinct on (block_id)
          block_id,
          note,
          manual_reason
        from public.program_requirement_block_flags
        where flag_type = 'NON_PLANNABLE'
        order by block_id, updated_at desc nulls last, created_at desc nulls last
      ) non_plannable
        on non_plannable.block_id = base.block_id
    $view$;

    grant select on public.v_program_block_courses to anon, authenticated, service_role;
  end if;
end $$;
