create table public.rw_daily_oral (
 id uuid primary key default gen_random_uuid(), student uuid not null references public.rw_members(user_id), day date not null,
 questions jsonb not null, round int not null default 0, offset_index int not null default 0,
 answers jsonb not null default '[]', passed_rounds jsonb not null default '[]', attempt int not null default 1,
 unique(student,day)
);
alter table public.rw_daily_oral enable row level security;
revoke all on public.rw_daily_oral from public,anon,authenticated;
grant select on public.rw_daily_oral to service_role;
create index rw_daily_oral_student on public.rw_daily_oral(student);
create function rw_private.daily_oral(action text,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare u uuid:=auth.uid(); m public.rw_members;s public.rw_daily_oral;day date:=coalesce((p->>'day')::date,(now() at time zone 'Asia/Shanghai')::date);qs jsonb; q jsonb; ans text; correct boolean; results jsonb; hits int; n int; result jsonb;
begin
select * into m from public.rw_members where user_id=u;
if m.role is distinct from 'student' or not m.password_changed then raise exception '请使用已改密的学生账号';end if;
if day>(now() at time zone 'Asia/Shanghai')::date then raise exception '尚未到任务日期';end if;
perform pg_advisory_xact_lock(hashtextextended(u::text||day::text,84));
select * into s from public.rw_daily_oral where student=u and rw_daily_oral.day=day for update;
if action='open' and s.id is null then
with entries as (
 select distinct g.id source,x.idx,g.words->(x.idx-1) word
 from public.rw_weekly_items i join public.rw_weekly_targets t on t.id=i.target join public.rw_class_goals g on g.id=t.goal
 cross join lateral generate_series(i.start_index,i.end_index)x(idx)
 where t.cohort=m.cohort and i.due_date=day
), ranked as (
 select *,row_number() over(partition by case when word->>'en' ~ '\s' then 'phrase' else 'word' end order by source,idx) rn,
 count(*) over(partition by case when word->>'en' ~ '\s' then 'phrase' else 'word' end) cnt from entries
), grouped as (
 select *,case when rn<=floor(cnt*.3) then 0 when rn<=floor(cnt*.3)*2 then 1 else 2 end bucket from ranked
), rounds as (
 select bucket,jsonb_agg(jsonb_build_object('source',source,'index',idx,'word',word) order by random()) items from grouped group by bucket order by bucket
) select jsonb_agg(items order by bucket) into qs from rounds;
if qs is null then raise exception '当天没有学习或复习任务';end if;
insert into public.rw_daily_oral(student,day,questions) values(u,day,qs) returning * into s;
end if;
if s.id is null then raise exception '请先打开当天口头抽查';end if;
if action='answer' then
if (p->>'session')::uuid is distinct from s.id then raise exception '测试编号不一致';end if;
-- Exact retry returns current state; stale different answers cannot advance.
if (p->>'round')::int is distinct from s.round or (p->>'offset')::int is distinct from s.offset_index or (p->>'attempt')::int is distinct from s.attempt then return to_jsonb(s)-'student';end if;
if s.round>=jsonb_array_length(s.questions) then return to_jsonb(s)-'student';end if;
ans:=trim(p->>'text');if ans is null or length(ans)>500 then raise exception '识别内容无效';end if;
q:=s.questions->s.round->s.offset_index;
correct:=rw_private.mastery_norm(regexp_replace(ans,'[.!?,;:]+$','','g'))=rw_private.mastery_norm(q->'word'->>'en') and ans<>'';
if jsonb_typeof(q->'word'->'alternatives')='array' then correct:=correct or exists(select 1 from jsonb_array_elements_text(q->'word'->'alternatives') a where rw_private.mastery_norm(a)=rw_private.mastery_norm(ans) and ans<>'');end if;
results:=s.answers||jsonb_build_array(jsonb_build_object('text',ans,'correct',correct,'input',case when p->>'input'='cloud' then 'cloud' else 'local' end));
n:=jsonb_array_length(s.questions->s.round);
update public.rw_daily_oral set answers=results,offset_index=offset_index+1 where id=s.id returning * into s;
if s.offset_index=n then
select count(*) into hits from jsonb_array_elements(results) a where (a->>'correct')::boolean;
if hits*100>=n*90 then update public.rw_daily_oral set round=round+1,offset_index=0,answers='[]',passed_rounds=passed_rounds||jsonb_build_array(jsonb_build_object('round',s.round+1,'correct',hits,'total',n,'at',now())) where id=s.id returning * into s;end if;
end if;
elsif action='retry' then
if s.round<jsonb_array_length(s.questions) and s.offset_index=jsonb_array_length(s.questions->s.round) then update public.rw_daily_oral set offset_index=0,answers='[]',attempt=attempt+1 where id=s.id returning * into s;end if;
elsif action<>'open' then raise exception '不支持的操作';end if;
return to_jsonb(s)-'student';
end $$;
revoke all on function rw_private.daily_oral(text,jsonb) from public,anon;
grant execute on function rw_private.daily_oral(text,jsonb) to authenticated;
create function public.rw_daily_oral_run(p_action text,p_payload jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$select rw_private.daily_oral(p_action,p_payload)$$;
revoke all on function public.rw_daily_oral_run(text,jsonb) from public,anon;
grant execute on function public.rw_daily_oral_run(text,jsonb) to authenticated;

create or replace function public.rw_oral_take_quota(p_actor uuid) returns boolean language plpgsql security invoker set search_path='' as $$
declare used int;lim int;
begin
 select case when role='teacher' then 2000 else 1200 end into lim from public.rw_members where user_id=p_actor;
 if lim is null then return false;end if;
 insert into public.rw_oral_usage values(p_actor,(now() at time zone 'Asia/Shanghai')::date,1)
 on conflict(actor,day) do update set n=public.rw_oral_usage.n+1 where public.rw_oral_usage.n<lim returning n into used;
 return used is not null;
end $$;
revoke all on function public.rw_oral_take_quota(uuid) from public,anon,authenticated;
grant execute on function public.rw_oral_take_quota(uuid) to service_role;
