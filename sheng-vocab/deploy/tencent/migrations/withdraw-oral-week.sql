begin;
create table if not exists rw_private.withdrawn_oral_weeks(week_start date primary key,reason text not null,created_at timestamptz not null default now(),check(extract(isodow from week_start)=1));
alter table rw_private.withdrawn_oral_weeks enable row level security;
revoke all on rw_private.withdrawn_oral_weeks from public,anon,authenticated;
insert into rw_private.withdrawn_oral_weeks(week_start,reason) values('2026-11-23','教师撤下上一轮口头抽查，保留学习复习与历史记录') on conflict do nothing;
CREATE OR REPLACE FUNCTION rw_private.weekly(p_action text, p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_variable
declare u uuid:=auth.uid();m public.rw_members;g public.rw_class_goals;t public.rw_weekly_targets;it public.rw_weekly_items;s public.rw_class_sessions;today date:=(now() at time zone 'Asia/Shanghai')::date;wk date;cohort_name text;a int;b int;d int;lo int;hi int;n int;id uuid;idx int;indices int[];questions jsonb:='[]';w jsonb;opts jsonb;data jsonb;
begin
 select * into m from public.rw_members where user_id=u;
 if u is null or m.user_id is null or m.role not in ('teacher','student') or (m.role='student' and not m.password_changed) then raise exception '请先登录并完成首次改密';end if;
 if p_action='publish' then
  if m.role<>'teacher' then raise exception '只有教师可以发布周任务';end if;
  id:=(p->>'id')::uuid;wk:=(p->>'week')::date;a:=(p->>'start')::int;b:=(p->>'end')::int;
  select * into g from public.rw_class_goals where rw_class_goals.id=(p->>'goal')::uuid for share;
  if id is null or g.id is null or wk is null or extract(isodow from wk)<>1 or wk<date_trunc('week',today)::date then raise exception '请选择本周或未来的周一和有效课堂目标';end if;
  if a is null or b is null or a<g.start_index or b>g.end_index or b<a then raise exception '范围须在课堂目标之内';end if;
  if p->>'kind' is null or p->>'kind' not in ('vocabulary','review','transform') or p->>'mode' is null or p->>'mode' not in ('reading','writing') or (p->>'kind'='transform' and p->>'mode'<>'writing') then raise exception '任务类型或题型不正确';end if;
  perform pg_advisory_xact_lock(hashtextextended(id::text,55));
  select * into t from public.rw_weekly_targets where rw_weekly_targets.id=id;
  if found then
   if t.created_by<>u or t.goal<>g.id or t.week_start<>wk or t.kind<>p->>'kind' or t.mode<>p->>'mode' or t.start_index<>a or t.end_index<>b then raise exception '发布编号冲突';end if;
   return jsonb_build_object('id',id);
  end if;
  perform pg_advisory_xact_lock(hashtextextended(g.id::text||wk::text|| (p->>'kind') || (p->>'mode') ||a::text||':'||b::text,57));
  select * into t from public.rw_weekly_targets wt where wt.goal=g.id and wt.week_start=wk and wt.kind=p->>'kind' and wt.mode=p->>'mode' and wt.start_index=a and wt.end_index=b;
  if found then return jsonb_build_object('id',t.id);end if;
  insert into public.rw_weekly_targets(id,cohort,week_start,goal,kind,mode,start_index,end_index,created_by) values(id,g.cohort,wk,g.id,p->>'kind',p->>'mode',a,b,u);
  n:=b-a+1;
  for d in 0..4 loop
   lo:=a+floor(n*d/5.0)::int;hi:=a+floor(n*(d+1)/5.0)::int-1;
   if hi>=lo then insert into public.rw_weekly_items(target,due_date,start_index,end_index) values(id,wk+d,lo,hi);end if;
  end loop;
  return jsonb_build_object('id',id);
 end if;
 if p_action='list' then
  cohort_name:=case when m.role='teacher' then p->>'cohort' else m.cohort end;
  wk:=coalesce((p->>'week')::date,date_trunc('week',today)::date);
  if extract(isodow from wk)<>1 then raise exception '日期须为周一';end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'target',wt.id,'date',i.due_date,'start',i.start_index,'end',i.end_index,'kind',wt.kind,'mode',wt.mode,'title',cg.title,'goal',cg.id,'total',i.end_index-i.start_index+1,'done',(select count(*) from public.rw_weekly_checks c where c.item=i.id and c.student=u)) order by i.due_date,wt.created_at),'[]') into data
  from public.rw_weekly_items i join public.rw_weekly_targets wt on wt.id=i.target join public.rw_class_goals cg on cg.id=wt.goal
  where wt.cohort=cohort_name and (wt.week_start=wk or (m.role='student' and i.due_date<today and wt.week_start<wk and (select count(*) from public.rw_weekly_checks c where c.item=i.id and c.student=u)<i.end_index-i.start_index+1));
  return jsonb_build_object('today',today,'week',wk,'cohort',cohort_name,'items',data,'oral_dates',(select coalesce(jsonb_agg(d order by d),'[]'::jsonb) from (select distinct (x->>'date')::date d from jsonb_array_elements(data) x where (x->>'date')::date<=today and not exists(select 1 from rw_private.withdrawn_oral_weeks w where (x->>'date')::date between w.week_start and w.week_start+6)) dates),'targets',(select coalesce(jsonb_agg(jsonb_build_object('id',wt.id,'title',cg.title,'start',wt.start_index,'end',wt.end_index,'kind',wt.kind,'mode',wt.mode) order by wt.created_at),'[]') from public.rw_weekly_targets wt join public.rw_class_goals cg on cg.id=wt.goal where wt.cohort=cohort_name and wt.week_start=wk));
 end if;
 if p_action='begin' then
  if m.role<>'student' then raise exception '请用学生账号完成周任务';end if;
  id:=(p->>'id')::uuid;
  if id is null then raise exception '缺少测试编号';end if;
  perform pg_advisory_xact_lock(hashtextextended(id::text,56));
  select * into it from public.rw_weekly_items where rw_weekly_items.id=(p->>'item')::uuid;
  select * into t from public.rw_weekly_targets where rw_weekly_targets.id=it.target;
  select * into g from public.rw_class_goals where rw_class_goals.id=t.goal for share;
  if it.id is null or t.cohort is distinct from m.cohort then raise exception '无法访问这个班级任务';end if;
  if it.due_date>today then raise exception '任务尚未到安排日期';end if;
  if it.start_index<g.start_index or it.end_index>g.end_index then raise exception '课堂范围已调整，请老师恢复该任务范围后继续';end if;
  select * into s from public.rw_class_sessions where rw_class_sessions.id=id;
  if found then
   if s.actor<>u or s.weekly_item is distinct from it.id then raise exception '测试编号冲突';end if;
   if s.revision<>g.revision then raise exception '课堂目标已更新，请重新进入任务';end if;
   return to_jsonb(s);
  end if;
  select array_agg(i order by random()) into indices from generate_series(it.start_index,it.end_index)i where not exists(select 1 from public.rw_weekly_checks c where c.item=it.id and c.student=u and c.word_index=i);
  if coalesce(cardinality(indices),0)=0 then raise exception '该任务已完成';end if;
  foreach idx in array indices loop
   w:=g.words->(idx-1);opts:='[]';
   if t.mode='reading' then
    select coalesce(jsonb_agg(jsonb_build_object('en',en,'zh',zh)),'[]') into opts from (select distinct on(x->>'zh') x->>'en' en,x->>'zh' zh from jsonb_array_elements(g.words)x where x->>'zh'<>w->>'zh' and rw_private.mastery_norm(x->>'en')<>rw_private.mastery_norm(w->>'en') and coalesce(x->>'zh','')<>'')d;
    select coalesce(jsonb_agg(x),'[]') into opts from (select x from jsonb_array_elements(opts)x order by random() limit 3)d;
    if jsonb_array_length(opts)<3 then raise exception '词书至少需要四个不同释义';end if;
    opts:=opts||jsonb_build_array(jsonb_build_object('en',w->>'en','zh',w->>'zh'));
    select jsonb_agg(x order by random()) into opts from jsonb_array_elements(opts)x;
   end if;
   questions:=questions||jsonb_build_array(jsonb_build_object('index',idx,'word',w,'options',opts));
  end loop;
  insert into public.rw_class_sessions(id,actor,student,goal,revision,mode,indices,questions,weekly_item) values(id,u,u,g.id,g.revision,t.mode,indices,questions,it.id) returning * into s;
  return to_jsonb(s);
 end if;
 raise exception '不支持的周任务操作';
end $function$

;
CREATE OR REPLACE FUNCTION rw_private.daily_oral(action text, p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_variable
declare u uuid:=auth.uid(); m public.rw_members;s public.rw_daily_oral;day date:=coalesce((p->>'day')::date,(now() at time zone 'Asia/Shanghai')::date);qs jsonb; q jsonb; ans text; correct boolean; results jsonb; hits int; n int; result jsonb;
begin
select * into m from public.rw_members where user_id=u;
if m.role is distinct from 'student' or not m.password_changed then raise exception '请使用已改密的学生账号';end if;
if day>(now() at time zone 'Asia/Shanghai')::date then raise exception '尚未到任务日期';end if;
if exists(select 1 from rw_private.withdrawn_oral_weeks w where day between w.week_start and w.week_start+6) then raise exception '本周口头抽查已撤下，学习和复习任务照常完成';end if;
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
end $function$

;
CREATE OR REPLACE FUNCTION rw_private.teacher_weekly()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  from day_entries where not exists(select 1 from rw_private.withdrawn_oral_weeks w where due_date between w.week_start and w.week_start+6) group by cohort,due_date
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
end $function$
;
notify pgrst,'reload schema';
commit;
