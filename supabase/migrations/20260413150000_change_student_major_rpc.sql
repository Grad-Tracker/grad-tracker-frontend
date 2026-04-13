create or replace function public.change_student_major(p_student_id bigint, p_program_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
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
  where sp.student_id = p_student_id
    and sp.program_id = p.id
    and p.program_type = 'MAJOR';

  insert into public.student_programs (student_id, program_id)
  values (p_student_id, p_program_id);
end;
$$;

revoke all on function public.change_student_major(bigint, bigint) from public;
grant execute on function public.change_student_major(bigint, bigint) to authenticated;
