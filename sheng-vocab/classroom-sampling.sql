-- Upgrade after classroom.sql and weekly.sql. Legacy/weekly sessions retain five-question grading.
alter table public.rw_class_goals drop constraint rw_class_goals_check;
alter table public.rw_class_goals add constraint rw_class_goals_check check(end_index>=start_index and end_index<=jsonb_array_length(words));
alter table public.rw_class_sessions add column selected_indices int[], add column assessment_version int not null default 1 check(assessment_version in (1,2)), add column final_result jsonb;
alter table public.rw_class_sessions add constraint rw_class_sampling_scope check(assessment_version=1 or (selected_indices is not null and cardinality(selected_indices)>0 and indices<@selected_indices and weekly_item is null));
create or replace function rw_private.classroom(p_action text,p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare
 u uuid:=auth.uid(); who public.rw_members; pupil public.rw_members; g public.rw_class_goals; lib public.rw_libraries;
 sess public.rw_class_sessions; old public.rw_class_events; sid uuid; gid uuid; event_id uuid; mode text;
 a int; b int; n int; off int; idx int; hits int:=0; changed int:=0; is_teacher boolean;
 selected int[]; scope_indices int[]; sample_count int; sampled boolean; batch int[]; w jsonb; q jsonb; opts jsonb; qs jsonb:='[]'; results jsonb:='[]'; answer text; ok boolean; result jsonb; cohort_name text;
begin
 select * into who from public.rw_members where user_id=u;
 if u is null or who.user_id is null or who.role not in ('teacher','student') then raise exception '请先登录班级账号'; end if;
 is_teacher:=who.role='teacher';
 if not is_teacher and not who.password_changed then raise exception '请先修改初始密码'; end if;
 if p_action='catalog' then
  return jsonb_build_object('role',who.role,'member',jsonb_build_object('user_id',u,'display_name',who.display_name,'cohort',who.cohort),
   'members',case when is_teacher then (select coalesce(jsonb_agg(jsonb_build_object('user_id',m.user_id,'display_name',m.display_name,'cohort',m.cohort) order by m.cohort,m.display_name),'[]') from public.rw_members m where m.role='student') else '[]'::jsonb end,
   'libraries',case when is_teacher then (select coalesce(jsonb_agg(jsonb_build_object('id',l.id,'title',l.title,'count',jsonb_array_length(l.words)) order by l.created_at),'[]') from public.rw_libraries l) else '[]'::jsonb end,
   'goals',(select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'cohort',x.cohort,'library',x.library,'title',x.title,'start',x.start_index,'end',x.end_index,'revision',x.revision) order by x.updated_at desc),'[]') from public.rw_class_goals x where is_teacher or x.cohort=who.cohort));
 end if;
 if p_action='set_goal' then
  if not is_teacher then raise exception '仅教师可以设置课堂目标'; end if;
  cohort_name:=btrim(p->>'cohort');
  if cohort_name is null or not exists(select 1 from public.rw_members m where m.role='student' and m.cohort=cohort_name) then raise exception '请选择有效班级'; end if;
  select * into lib from public.rw_libraries where id=(p->>'library')::uuid;
  if not found then raise exception '词书不存在'; end if;
  -- Serialize goal creation and edits; repeated identical save is a no-op.
  perform pg_advisory_xact_lock(hashtextextended(cohort_name||lib.id::text,42));
  select * into g from public.rw_class_goals where cohort=cohort_name and library=lib.id for update;
  a:=(p->>'start')::int; b:=(p->>'end')::int;
  if a is null or b is null or a<1 or b-a+1<1 or b>jsonb_array_length(coalesce(g.words,lib.words)) then raise exception '范围至少 1 个，且不能超出词书'; end if;
  if g.id is null then
   insert into public.rw_class_goals(cohort,library,title,words,start_index,end_index,created_by) values(cohort_name,lib.id,lib.title,lib.words,a,b,u) returning * into g;
  elsif g.start_index<>a or g.end_index<>b then
   if (p->>'revision')::int is distinct from g.revision then raise exception '目标已被更新，请刷新后重试'; end if;
   update public.rw_class_goals set start_index=a,end_index=b,revision=revision+1,updated_at=now() where id=g.id returning * into g;
  end if;
  result:=jsonb_build_object('id',g.id,'revision',g.revision);
  insert into public.rw_class_events(id,actor,goal,kind,payload,result) values(gen_random_uuid(),u,g.id,'range',p,result);
  return result;
 end if;
 if p_action in ('submit','resume') then
  select * into sess from public.rw_class_sessions where id=(p->>'session')::uuid for update;
  if not found or sess.actor<>u then raise exception '测试不存在或不属于当前账号'; end if;
  gid:=sess.goal;sid:=sess.student;mode:=sess.mode;
 else gid:=(p->>'goal')::uuid;sid:=case when is_teacher then (p->>'student')::uuid else u end;mode:=p->>'mode';
  if not is_teacher and p ? 'student' and (p->>'student')::uuid is distinct from u then raise exception '只能访问自己的课堂记录'; end if;
 end if;
 if mode is null or mode not in ('reading','writing') then raise exception '请选择测试方式'; end if;
 select * into g from public.rw_class_goals where id=gid for share;
 select * into pupil from public.rw_members where user_id=sid and role='student';
 if g.id is null or pupil.user_id is null or pupil.cohort is distinct from g.cohort then raise exception '目标或学生不属于这个班级'; end if;
 if not is_teacher and pupil.user_id<>u then raise exception '只能访问自己的课堂记录'; end if;
 if p_action='detail' then
  return jsonb_build_object('goal',jsonb_build_object('id',g.id,'title',g.title,'cohort',g.cohort,'start',g.start_index,'end',g.end_index,'revision',g.revision,'words',g.words),
   'passes',(select coalesce(jsonb_agg(jsonb_build_object('index',r.word_index,'source',r.source,'at',r.passed_at) order by r.word_index),'[]') from public.rw_class_passes r where r.goal=gid and r.student=sid and r.mode=mode and r.word_index between g.start_index and g.end_index),
   'roster',case when is_teacher then (select coalesce(jsonb_agg(to_jsonb(s)),'[]') from (select m.user_id,m.display_name,count(r.word_index) passed from public.rw_members m left join public.rw_class_passes r on r.student=m.user_id and r.goal=gid and r.mode=mode and r.word_index between g.start_index and g.end_index where m.cohort=g.cohort and m.role='student' group by m.user_id,m.display_name order by m.display_name)s) else '[]'::jsonb end);
 end if;
 if p_action in ('mark','unmark') then
  if not is_teacher then raise exception '仅教师可以认定或撤销过关'; end if;
  event_id:=(p->>'id')::uuid;if event_id is null then raise exception '缺少操作编号'; end if;
  perform pg_advisory_xact_lock(hashtextextended(event_id::text,43));
  select * into old from public.rw_class_events where id=event_id;
  if found then
   if old.actor<>u or old.kind<>p_action or old.payload<>p then raise exception '操作编号冲突'; end if; return old.result;
  end if;
  if (p->>'revision')::int is distinct from g.revision then raise exception '目标已更新，请刷新'; end if;
  if jsonb_typeof(p->'indices') is distinct from 'array' or jsonb_array_length(p->'indices') not between 1 and 5000 then raise exception '请选择词条'; end if;
  select array_agg(distinct value::int) into selected from jsonb_array_elements_text(p->'indices');
  if exists(select 1 from unnest(selected)i where i is null or i<g.start_index or i>g.end_index) then raise exception '词条超出目标范围'; end if;
  if p_action='mark' then
   insert into public.rw_class_passes(goal,student,mode,word_index,source,actor) select gid,sid,mode,i,'teacher',u from unnest(selected)i on conflict do nothing;
  else
   delete from public.rw_class_passes r where r.goal=gid and r.student=sid and r.mode=mode and r.word_index=any(selected) and r.source='teacher';
  end if;
  get diagnostics changed=row_count;result:=jsonb_build_object('changed',changed);
  insert into public.rw_class_events(id,actor,student,goal,mode,kind,payload,result) values(event_id,u,sid,gid,mode,p_action,p,result);return result;
 end if;
 if p_action='begin' then
  event_id:=(p->>'id')::uuid;if event_id is null then raise exception '缺少测试编号'; end if;
  perform pg_advisory_xact_lock(hashtextextended(event_id::text,44));
  select * into sess from public.rw_class_sessions where id=event_id;
  if found then
   if sess.actor<>u or sess.student<>sid or sess.goal<>gid or sess.mode<>mode then raise exception '测试编号冲突'; end if;
   if sess.revision<>g.revision then raise exception '课堂目标已更新，请重新开始'; end if;
   return to_jsonb(sess);
  end if;
  if (p->>'revision')::int is distinct from g.revision then raise exception '目标已更新，请刷新'; end if;
  if p->>'size'='custom' then
   a:=(p->>'start')::int;b:=(p->>'end')::int;
   if a is null or b is null or a<g.start_index or b>g.end_index or b-a+1<1 then raise exception '自选范围至少 1 个且须在老师目标内'; end if;
   n:=b-a+1;
  else
   n:=(p->>'size')::int;if n is null or n not in (10,20,50) then raise exception '请选择 10、20、50 或自选范围'; end if;
   a:=g.start_index;b:=g.end_index;
  end if;
  select array_agg(i order by i) into selected from (select i from generate_series(a,b)i where not exists(select 1 from public.rw_class_passes r where r.goal=gid and r.student=sid and r.mode=mode and r.word_index=i) order by i limit n)s;
  if coalesce(cardinality(selected),0)=0 then raise exception '所选范围已全部过关'; end if;
  scope_indices:=selected;sampled:=coalesce(p->>'policy'='sampling90',false);
  sample_count:=case when sampled and cardinality(selected)>=10 then ceil(cardinality(selected)/2.0)::int else cardinality(selected) end;
  select array_agg(i order by random()) into selected from (select i from unnest(selected)i order by random() limit sample_count) chosen;
  foreach idx in array selected loop
   w:=g.words->(idx-1);
   if coalesce(btrim(w->>'en'),'')='' or coalesce(btrim(w->>'zh'),'')='' then raise exception '词书有空词条，请老师检查'; end if;
   opts:='[]';
   if mode='reading' then
    select coalesce(jsonb_agg(jsonb_build_object('en',en,'zh',zh)),'[]') into opts from (select distinct on (x->>'zh') x->>'en' en,x->>'zh' zh from jsonb_array_elements(g.words)x where x->>'zh'<>w->>'zh' and rw_private.mastery_norm(x->>'en')<>rw_private.mastery_norm(w->>'en') and coalesce(x->>'zh','')<>'')d;
    select coalesce(jsonb_agg(x),'[]') into opts from (select x from jsonb_array_elements(opts)x order by random() limit 3)d;
    if jsonb_array_length(opts)<3 then raise exception '这本词书至少需要 4 个不同释义才能进行四选一测试'; end if;
    opts:=opts||jsonb_build_array(jsonb_build_object('en',w->>'en','zh',w->>'zh'));
    select jsonb_agg(x order by random()) into opts from jsonb_array_elements(opts)x;
   end if;
   qs:=qs||jsonb_build_array(jsonb_build_object('index',idx,'word',w,'options',opts));
  end loop;
  insert into public.rw_class_sessions(id,actor,student,goal,revision,mode,indices,questions,selected_indices,assessment_version) values(event_id,u,sid,gid,g.revision,mode,selected,qs,scope_indices,case when sampled then 2 else 1 end) returning * into sess;
  return to_jsonb(sess);
 end if;
 if p_action='resume' then
  if sess.revision<>g.revision then raise exception '课堂目标已更新，请重新开始'; end if;
  return to_jsonb(sess);
 end if;
 if p_action='submit' then
  event_id:=(p->>'id')::uuid;if event_id is null then raise exception '缺少提交编号'; end if;
  select * into old from public.rw_class_events where id=event_id;
  if found then
   if old.actor<>u or old.kind<>'test' or old.payload<>p then raise exception '提交编号冲突'; end if;return old.result;
  end if;
  if sess.revision<>g.revision then raise exception '课堂目标已更新，本次作答未记过关，请重新开始'; end if;
  off:=(p->>'offset')::int;
  if off is distinct from sess.next_offset or off>=cardinality(sess.indices) then raise exception '本组已提交或进度已改变，请恢复测试'; end if;
  if sess.assessment_version=2 and sess.final_result is not null then raise exception '本轮已结算，请查看结果或重新开始';end if;
  n:=case when sess.assessment_version=2 then cardinality(sess.indices) else least(5,cardinality(sess.indices)-off) end;
  if jsonb_typeof(p->'answers') is distinct from 'array' or jsonb_array_length(p->'answers')<>n then raise exception '请完成本组全部题目'; end if;
  for a in 0..n-1 loop
   q:=sess.questions->(off+a);w:=q->'word';idx:=(q->>'index')::int;answer:=p->'answers'->>a;
   if answer is null or length(answer)>1000 then raise exception '答案格式不正确'; end if;
   ok:=rw_private.mastery_norm(answer)<>'' and rw_private.mastery_norm(answer)=rw_private.mastery_norm(w->>'en');
   if mode='writing' and jsonb_typeof(w->'alternatives')='array' then
    ok:=ok or exists(select 1 from jsonb_array_elements_text(w->'alternatives')x where rw_private.mastery_norm(x)=rw_private.mastery_norm(answer) and rw_private.mastery_norm(answer)<>'');
   end if;
   if mode='reading' and answer<>'' and not exists(select 1 from jsonb_array_elements(q->'options')o where o->>'en'=answer) then raise exception '请选择本题提供的选项'; end if;
   if ok then hits:=hits+1; end if;
   results:=results||jsonb_build_array(jsonb_build_object('index',idx,'correct',ok,'word',w,'response',answer));
  end loop;
  if sess.assessment_version=2 then
   ok:=hits*100>=n*90;
   if ok then
    insert into public.rw_class_passes(goal,student,mode,word_index,source,actor)
     select gid,sid,mode,i,'test',u from unnest(sess.selected_indices)i
     on conflict on constraint rw_class_passes_pkey do update set source='test',actor=excluded.actor,passed_at=excluded.passed_at;
   end if;
   result:=jsonb_build_object('passed',ok,'correct',hits,'total',n,'results',results,'next_offset',n,'complete',true,'policy','sampling90','scope_total',cardinality(sess.selected_indices),'required_correct',ceil(n*0.9)::int,'accuracy',round(hits*100.0/n,1));
   update public.rw_class_sessions set next_offset=n,final_result=result where id=sess.id;
  else
  if hits=n then
   batch:=sess.indices[off+1:off+n];
   insert into public.rw_class_passes(goal,student,mode,word_index,source,actor) select gid,sid,mode,i,'test',u from unnest(batch)i on conflict on constraint rw_class_passes_pkey do update set source='test',actor=excluded.actor,passed_at=excluded.passed_at;
   update public.rw_class_sessions set next_offset=off+n where id=sess.id;
  end if;
  result:=jsonb_build_object('passed',hits=n,'correct',hits,'total',n,'results',results,'next_offset',case when hits=n then off+n else off end,'complete',hits=n and off+n=cardinality(sess.indices));
  end if;
  insert into public.rw_class_events(id,actor,student,goal,mode,kind,session,payload,result) values(event_id,u,sid,gid,mode,'test',sess.id,p,result);
  return result;
 end if;
 raise exception '不支持的课堂操作';
end $$;
