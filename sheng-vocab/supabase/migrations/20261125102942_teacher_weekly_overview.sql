-- Read-only weekly teacher overview. No broad table grants or data mutation.
begin;
create or replace function rw_private.teacher_weekly() returns jsonb
language plpgsql security definer set search_path='' as $$
declare today date:=(now() at time zone 'Asia/Shanghai')::date;
wk date; result jsonb;
begin
 if auth.uid() is null or not exists(select 1 from public.rw_members where user_id=auth.uid() and role='teacher') then
  raise exception '仅教师可查看学生周任务进度' using errcode='42501';
 end if;
 wk:=today-(extract(isodow from today)::int-1);
 with items as materialized (
  select i.id,i.due_date,i.start_index,i.end_index,t.cohort,t.kind,g.title,t.goal,
   i.end_index-i.start_index+1 total
  from public.rw_weekly_items i join public.rw_weekly_targets t on t.id=i.target
  join public.rw_class_goals g on g.id=t.goal where t.week_start=wk
 ), checks as (
  select c.student,c.item,count(*) done from public.rw_weekly_checks c join items i on i.id=c.item
  where c.word_index between i.start_index and i.end_index group by c.student,c.item
 ), goal_entries as materialized (
  select g.id,x.idx,(x.word->>'en') ~ '\s' phrase
  from public.rw_class_goals g cross join lateral jsonb_array_elements(g.words) with ordinality x(word,idx)
  where g.id in (select goal from items)
 ), day_entries as (
  select distinct i.cohort,i.due_date,i.goal,x.idx,x.phrase
  from items i join goal_entries x on x.id=i.goal and x.idx between i.start_index and i.end_index
 ), days as (
  select cohort,due_date,case when greatest(count(*) filter(where phrase),count(*) filter(where not phrase))>=4 then 3 else 1 end rounds
  from day_entries group by cohort,due_date
 ), task_rows as (
  select m.user_id,jsonb_agg(jsonb_build_object('id',i.id,'date',i.due_date,
   'start',i.start_index,'end',i.end_index,'title',i.title,'kind',i.kind,
   'total',i.total,'done',least(i.total,coalesce(c.done,0))) order by i.due_date,i.kind,i.id) rows
  from public.rw_members m join items i on i.cohort=m.cohort
  left join checks c on c.item=i.id and c.student=m.user_id
  where m.role='student' group by m.user_id
 ), oral_rows as (
  select m.user_id,jsonb_agg(jsonb_build_object('date',d.due_date,
   'total',coalesce(nullif(jsonb_array_length(o.questions),0),d.rounds),
   'done',least(greatest(coalesce(o.round,0),0),coalesce(nullif(jsonb_array_length(o.questions),0),d.rounds))) order by d.due_date) rows
  from public.rw_members m join days d on d.cohort=m.cohort
  left join public.rw_daily_oral o on o.student=m.user_id and o.day=d.due_date
  where m.role='student' group by m.user_id
 ) select jsonb_build_object('today',today,'week',wk,'end',wk+6,'students',coalesce(jsonb_agg(
   jsonb_build_object('id',m.user_id,'name',m.display_name,'cohort',coalesce(m.cohort,'待分班'),
    'items',coalesce(t.rows,'[]'::jsonb),'oral',coalesce(o.rows,'[]'::jsonb)) order by m.cohort,m.display_name),'[]'::jsonb))
 into result from public.rw_members m left join task_rows t on t.user_id=m.user_id
 left join oral_rows o on o.user_id=m.user_id where m.role='student';
 return result;
end $$;
revoke all on function rw_private.teacher_weekly() from public,anon;
grant execute on function rw_private.teacher_weekly() to authenticated;
create or replace function public.rw_teacher_weekly() returns jsonb
language sql security invoker set search_path='' as $$select rw_private.teacher_weekly()$$;
revoke all on function public.rw_teacher_weekly() from public,anon;
grant execute on function public.rw_teacher_weekly() to authenticated;
notify pgrst,'reload schema';
commit;
