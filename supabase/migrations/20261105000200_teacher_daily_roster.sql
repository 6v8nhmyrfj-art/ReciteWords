create function public.rw_today(p_task uuid) returns table(student_id uuid, student_name text, learned bigint) language sql stable security definer set search_path='' as $$
select m.user_id,m.display_name,count(p.word_index)
from public.rw_members m left join public.rw_progress p on p.user_id=m.user_id and p.task_id=p_task and p.learned_on=(now() at time zone 'Asia/Shanghai')::date
where m.role='student' and exists(select 1 from public.rw_members teacher where teacher.user_id=auth.uid() and teacher.role='teacher')
group by m.user_id,m.display_name order by m.display_name,m.user_id
$$;
revoke all on function public.rw_today(uuid) from public,anon;
grant execute on function public.rw_today(uuid) to authenticated;