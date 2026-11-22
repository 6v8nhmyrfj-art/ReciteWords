create table public.rw_weekly_targets(id uuid primary key,cohort text not null,week_start date not null,goal uuid not null references public.rw_class_goals(id),kind text not null check(kind in ('vocabulary','review','transform')),mode text not null check(mode in ('reading','writing')),start_index int not null,end_index int not null,created_by uuid not null references public.rw_members(user_id),created_at timestamptz not null default now(),check(extract(isodow from week_start)=1),check(start_index>0 and end_index>=start_index));
create index rw_weekly_targets_class_week on public.rw_weekly_targets(cohort,week_start);
create index rw_weekly_targets_goal on public.rw_weekly_targets(goal);
create index rw_weekly_targets_creator on public.rw_weekly_targets(created_by);
create table public.rw_weekly_items(id uuid primary key default gen_random_uuid(),target uuid not null references public.rw_weekly_targets(id),due_date date not null,start_index int not null,end_index int not null,unique(target,due_date));
create table public.rw_weekly_checks(item uuid not null references public.rw_weekly_items(id),student uuid not null references public.rw_members(user_id),word_index int not null,passed_at timestamptz not null default now(),primary key(item,student,word_index));
create index rw_weekly_checks_student on public.rw_weekly_checks(student);
alter table public.rw_class_sessions add column weekly_item uuid references public.rw_weekly_items(id);
create index rw_class_sessions_weekly_item on public.rw_class_sessions(weekly_item);
alter table public.rw_weekly_targets enable row level security;
alter table public.rw_weekly_items enable row level security;
alter table public.rw_weekly_checks enable row level security;
revoke all on public.rw_weekly_targets,public.rw_weekly_items,public.rw_weekly_checks from public,anon,authenticated;
create function rw_private.weekly_credit() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.weekly_item is not null and new.next_offset>old.next_offset then
 insert into public.rw_weekly_checks(item,student,word_index) select new.weekly_item,new.student,i from unnest(new.indices[old.next_offset+1:new.next_offset])i on conflict do nothing;
 end if;return new;
end $$;
revoke all on function rw_private.weekly_credit() from public,anon,authenticated;
create trigger rw_weekly_session_credit after update of next_offset on public.rw_class_sessions for each row execute function rw_private.weekly_credit();
create function rw_private.weekly(p_action text,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
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
  return jsonb_build_object('today',today,'week',wk,'cohort',cohort_name,'items',data,'targets',(select coalesce(jsonb_agg(jsonb_build_object('id',wt.id,'title',cg.title,'start',wt.start_index,'end',wt.end_index,'kind',wt.kind,'mode',wt.mode) order by wt.created_at),'[]') from public.rw_weekly_targets wt join public.rw_class_goals cg on cg.id=wt.goal where wt.cohort=cohort_name and wt.week_start=wk));
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
end $$;
revoke all on function rw_private.weekly(text,jsonb) from public,anon;
grant execute on function rw_private.weekly(text,jsonb) to authenticated;
create function public.rw_weekly(p_action text,p_payload jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$select rw_private.weekly(p_action,p_payload)$$;
revoke all on function public.rw_weekly(text,jsonb) from public,anon;
grant execute on function public.rw_weekly(text,jsonb) to authenticated;
