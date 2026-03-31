-- View-first read migration
-- Phase 1: notification_preferences prerequisite + strict per-student RLS
-- Phase 2: canonical student read views
-- Phase 3: supporting indexes

begin;

-- -----------------------------------------------------------------------------
-- Phase 1: notification_preferences repair / creation
-- -----------------------------------------------------------------------------

create table if not exists public.notification_preferences (
  student_id bigint primary key,
  notif_requirement_alerts boolean not null default true,
  notif_semester_reminders boolean not null default true,
  notif_graduation_reminders boolean not null default true,
  notif_weekly_digest boolean not null default false
);

alter table public.notification_preferences
  add column if not exists notif_requirement_alerts boolean,
  add column if not exists notif_semester_reminders boolean,
  add column if not exists notif_graduation_reminders boolean,
  add column if not exists notif_weekly_digest boolean;

update public.notification_preferences
set
  notif_requirement_alerts = coalesce(notif_requirement_alerts, true),
  notif_semester_reminders = coalesce(notif_semester_reminders, true),
  notif_graduation_reminders = coalesce(notif_graduation_reminders, true),
  notif_weekly_digest = coalesce(notif_weekly_digest, false)
where
  notif_requirement_alerts is null
  or notif_semester_reminders is null
  or notif_graduation_reminders is null
  or notif_weekly_digest is null;

alter table public.notification_preferences
  alter column notif_requirement_alerts set default true,
  alter column notif_semester_reminders set default true,
  alter column notif_graduation_reminders set default true,
  alter column notif_weekly_digest set default false,
  alter column notif_requirement_alerts set not null,
  alter column notif_semester_reminders set not null,
  alter column notif_graduation_reminders set not null,
  alter column notif_weekly_digest set not null;

-- Ensure FK to students(id) exists with cascade semantics aligned to student lifecycle.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'notification_preferences_student_id_fkey'
      and conrelid = 'public.notification_preferences'::regclass
  ) then
    alter table public.notification_preferences
      add constraint notification_preferences_student_id_fkey
      foreign key (student_id)
      references public.students(id)
      on delete cascade;
  end if;
end $$;

alter table public.notification_preferences enable row level security;

-- Strict per-student policies.
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'notification_preferences'
      and policyname = 'notification_preferences_select_own'
  ) then
    create policy notification_preferences_select_own
      on public.notification_preferences
      for select
      using (
        exists (
          select 1
          from public.students s
          where s.id = notification_preferences.student_id
            and s.auth_user_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'notification_preferences'
      and policyname = 'notification_preferences_insert_own'
  ) then
    create policy notification_preferences_insert_own
      on public.notification_preferences
      for insert
      with check (
        exists (
          select 1
          from public.students s
          where s.id = notification_preferences.student_id
            and s.auth_user_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'notification_preferences'
      and policyname = 'notification_preferences_update_own'
  ) then
    create policy notification_preferences_update_own
      on public.notification_preferences
      for update
      using (
        exists (
          select 1
          from public.students s
          where s.id = notification_preferences.student_id
            and s.auth_user_id = auth.uid()
        )
      )
      with check (
        exists (
          select 1
          from public.students s
          where s.id = notification_preferences.student_id
            and s.auth_user_id = auth.uid()
        )
      );
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Phase 2: canonical read views (security invoker + explicit columns)
-- -----------------------------------------------------------------------------

create or replace view public.v_student_profile
with (security_invoker = true)
as
select
  s.id as student_id,
  s.auth_user_id,
  s.email,
  s.first_name,
  s.last_name,
  coalesce(nullif(trim(concat_ws(' ', s.first_name, s.last_name)), ''), s.email) as full_name,
  s.has_completed_onboarding,
  s.expected_graduation_semester,
  s.expected_graduation_year,
  s.breadth_package_id
from public.students s;

create or replace view public.v_student_major_program
with (security_invoker = true)
as
select
  sp.student_id,
  p.id as program_id,
  p.name as program_name,
  p.catalog_year,
  p.program_type
from public.student_programs sp
join public.programs p on p.id = sp.program_id
where p.program_type = 'MAJOR';

create or replace view public.v_student_course_progress
with (security_invoker = true)
as
select
  sch.student_id,
  sch.course_id,
  null::bigint as plan_id,
  null::bigint as term_id,
  sch.completed,
  sch.grade,
  'COMPLETED'::text as progress_status
from public.student_course_history sch
union all
select
  spc.student_id,
  spc.course_id,
  spc.plan_id,
  spc.term_id,
  false as completed,
  null::text as grade,
  coalesce(spc.status, 'PLANNED')::text as progress_status
from public.student_planned_courses spc;

create or replace view public.v_program_block_courses
with (security_invoker = true)
as
select
  prb.id as block_id,
  prb.program_id,
  p.name as program_name,
  prb.name as block_name,
  prb.rule,
  prb.n_required,
  prb.credits_required,
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
        'credits', c.credits
      )
      order by c.subject, c.number
    ) filter (where c.id is not null),
    '[]'::jsonb
  ) as courses
from public.program_requirement_blocks prb
join public.programs p on p.id = prb.program_id
left join public.program_requirement_courses prc on prc.block_id = prb.id
left join public.courses c on c.id = prc.course_id
group by
  prb.id,
  prb.program_id,
  p.name,
  prb.name,
  prb.rule,
  prb.n_required,
  prb.credits_required;

create or replace view public.v_gened_bucket_courses
with (security_invoker = true)
as
select
  geb.id as bucket_id,
  geb.code as bucket_code,
  geb.name as bucket_name,
  geb.credits_required as bucket_credits_required,
  coalesce(
    array_agg(gebc.course_id order by gebc.course_id)
      filter (where gebc.course_id is not null),
    '{}'::bigint[]
  ) as course_ids,
  coalesce(
    jsonb_agg(
      jsonb_build_object(
        'course_id', c.id,
        'subject', c.subject,
        'number', c.number,
        'title', c.title,
        'credits', c.credits
      )
      order by c.subject, c.number
    ) filter (where c.id is not null),
    '[]'::jsonb
  ) as courses
from public.gen_ed_buckets geb
left join public.gen_ed_bucket_courses gebc on gebc.bucket_id = geb.id
left join public.courses c on c.id = gebc.course_id
group by
  geb.id,
  geb.code,
  geb.name,
  geb.credits_required;

create or replace view public.v_plan_meta
with (security_invoker = true)
as
with program_rollup as (
  select
    pp.plan_id,
    array_agg(pp.program_id order by pp.program_id) as program_ids,
    bool_or(p.program_type = 'GRADUATE') as has_graduate_program
  from public.plan_programs pp
  join public.programs p on p.id = pp.program_id
  group by pp.plan_id
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
  coalesce(pr.program_ids, '{}'::bigint[]) as program_ids,
  coalesce(tr.term_count, 0) as term_count,
  coalesce(cr.course_count, 0) as course_count,
  coalesce(cr.total_credits, 0) as total_credits,
  coalesce(pr.has_graduate_program, false) as has_graduate_program
from public.plans pl
left join program_rollup pr on pr.plan_id = pl.id
left join term_rollup tr on tr.plan_id = pl.id
left join course_rollup cr on cr.plan_id = pl.id;

create or replace view public.v_plan_terms
with (security_invoker = true)
as
select
  stp.student_id,
  stp.plan_id,
  stp.term_id,
  t.season,
  t.year
from public.student_term_plan stp
join public.terms t on t.id = stp.term_id;

create or replace view public.v_plan_courses
with (security_invoker = true)
as
select
  spc.student_id,
  spc.plan_id,
  spc.term_id,
  spc.course_id,
  spc.status,
  c.subject,
  c.number,
  c.title,
  c.credits
from public.student_planned_courses spc
join public.courses c on c.id = spc.course_id;

-- -----------------------------------------------------------------------------
-- Phase 3: index support for view filter/join keys
-- -----------------------------------------------------------------------------

create index if not exists idx_students_auth_user_id on public.students(auth_user_id);
create index if not exists idx_student_programs_student_id on public.student_programs(student_id);
create index if not exists idx_student_programs_program_id on public.student_programs(program_id);
create index if not exists idx_program_requirement_blocks_program_id on public.program_requirement_blocks(program_id);
create index if not exists idx_program_requirement_courses_block_id on public.program_requirement_courses(block_id);
create index if not exists idx_program_requirement_courses_course_id on public.program_requirement_courses(course_id);
create index if not exists idx_gen_ed_bucket_courses_bucket_id on public.gen_ed_bucket_courses(bucket_id);
create index if not exists idx_gen_ed_bucket_courses_course_id on public.gen_ed_bucket_courses(course_id);
create index if not exists idx_plan_programs_plan_id on public.plan_programs(plan_id);
create index if not exists idx_plan_programs_program_id on public.plan_programs(program_id);
create index if not exists idx_student_term_plan_student_plan on public.student_term_plan(student_id, plan_id);
create index if not exists idx_student_term_plan_term_id on public.student_term_plan(term_id);
create index if not exists idx_student_planned_courses_student_plan on public.student_planned_courses(student_id, plan_id);
create index if not exists idx_student_planned_courses_term_id on public.student_planned_courses(term_id);
create index if not exists idx_student_planned_courses_course_id on public.student_planned_courses(course_id);
create index if not exists idx_student_course_history_student_id on public.student_course_history(student_id);
create index if not exists idx_student_course_history_course_id on public.student_course_history(course_id);
create index if not exists idx_notification_preferences_student_id on public.notification_preferences(student_id);

commit;
