create function public.rw_student_summary() returns jsonb language sql stable security definer set search_path='' as $$
with member as (select * from public.rw_members where user_id=auth.uid() and role='student' and password_changed),
days as(select p.learned_on,p.task_id,count(*) n,jsonb_array_length(t.words) total from public.rw_progress p join member m on m.user_id=p.user_id join public.rw_tasks t on t.id=p.task_id where p.learned_on>=date_trunc('week',now() at time zone 'Asia/Shanghai')::date group by 1,2,t.words),
answers as(select a.correct from public.rw_answers a join member m on m.user_id=a.student where a.at>=date_trunc('week',now() at time zone 'Asia/Shanghai') at time zone 'Asia/Shanghai')
select jsonb_build_object('today',(select count(distinct lower(trim(t.words->p.word_index->>'en'))) from public.rw_progress p join member m on m.user_id=p.user_id join public.rw_tasks t on t.id=p.task_id where p.learned_on=(now() at time zone 'Asia/Shanghai')::date),'days',(select count(distinct learned_on) from days where n>=total),'accuracy',(select round(avg(correct::int)*100) from answers),'cohort',(select cohort from member))
$$;
create function public.rw_mark_word(p_task uuid,p_index integer) returns date language plpgsql security invoker set search_path='' as $$declare d date:=(now() at time zone 'Asia/Shanghai')::date;begin
insert into public.rw_progress(user_id,task_id,word_index) values(auth.uid(),p_task,p_index) on conflict do nothing;return d;end$$;
revoke all on function public.rw_student_summary(),public.rw_mark_word(uuid,integer) from public,anon;
grant execute on function public.rw_student_summary(),public.rw_mark_word(uuid,integer) to authenticated;