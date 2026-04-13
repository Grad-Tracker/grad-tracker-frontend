create or replace function public.change_student_major(p_program_id bigint)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_student_id bigint;
begin
  select id
  into v_student_id
  from public.students
  where auth_user_id = auth.uid();

  if v_student_id is null then
    raise exception 'Student profile not found for authenticated user.';
  end if;

  if not exists (
    select 1
    from public.programs
    where id = p_program_id
      and program_type = 'MAJOR'
  ) then
    raise exception 'Program % is not a major.', p_program_id;
  end if;

  delete from public.student_programs sp
  using public.programs p
  where sp.student_id = v_student_id
    and sp.program_id = p.id
    and p.program_type = 'MAJOR';

  insert into public.student_programs (student_id, program_id)
  values (v_student_id, p_program_id);
end;
$$;

revoke all on function public.change_student_major(bigint) from public;
grant execute on function public.change_student_major(bigint) to authenticated;
