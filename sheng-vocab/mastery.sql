-- Server-scored book assessments and separate reading/writing evidence.
create schema if not exists rw_private;
revoke all on schema rw_private from public,anon,authenticated;

create or replace function rw_private.mastery_norm(value text)
returns text language sql immutable set search_path='' as $$
 select lower(regexp_replace(btrim(translate(coalesce(value,''),'’‘','''''')),'\s+',' ','g'))
$$;

create or replace function rw_private.mastery_source(p_kind text,p_source uuid)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare uid uuid:=auth.uid(); grp text; b jsonb; pool jsonb;
begin
 select cohort into grp from public.rw_members where user_id=uid and role='student' and password_changed;
 if not found then raise exception 'student_required';end if;
 if p_kind='library' then
  select jsonb_build_object('id',id,'title',case when nullif(btrim(book),'') is null then title else book||' · '||title end,
    'category',category,'words',words) into b from public.rw_libraries where id=p_source;
 elsif p_kind='task' then
  select jsonb_build_object('id',id,'title',title,'category',category,'words',words) into b
  from public.rw_tasks where id=p_source and (cohort is null or cohort=grp);
 elsif p_kind='basic' and p_source is null then
  b:=jsonb_build_object('id',null,'title','基础词汇','category','reading','words','[{"en":"discover","zh":"发现；发觉","pos":"v.","example":"We hope to discover a new star.","translation":"我们希望发现一颗新星。"},{"en":"balloon","zh":"气球","pos":"n.","example":"The red balloon flew away.","translation":"那个红气球飞走了。"},{"en":"wheel","zh":"轮子","pos":"n.","example":"My bike has a broken wheel.","translation":"我的自行车有一个轮子坏了。"},{"en":"central","zh":"中心的","pos":"adj.","example":"Meet me at the central station.","translation":"在中心车站和我见面吧。"},{"en":"although","zh":"虽然；尽管","pos":"conj.","example":"Although it was cold, we went outside.","translation":"虽然天气很冷，我们还是出门了。"},{"en":"attach","zh":"系上；连接","pos":"v.","example":"Please attach a photo to your email.","translation":"请在邮件中附上一张照片。"},{"en":"pull","zh":"拉；拖","pos":"v.","example":"Please pull the door open.","translation":"请把门拉开。"},{"en":"international","zh":"国际的","pos":"adj.","example":"She studies at an international school.","translation":"她在一所国际学校学习。"},{"en":"path","zh":"小路；路径","pos":"n.","example":"Follow the path to the lake.","translation":"沿着小路走到湖边。"},{"en":"technique","zh":"技术；技巧","pos":"n.","example":"Our coach taught us a new swimming technique.","translation":"教练教了我们一种新的游泳技巧。"},{"en":"depend","zh":"依靠；取决于","pos":"v.","example":"Young birds depend on their parents.","translation":"幼鸟依靠父母生活。"},{"en":"describe","zh":"描述","pos":"v.","example":"Can you describe your room?","translation":"你能描述一下你的房间吗？"},{"en":"decide","zh":"决定","pos":"v.","example":"We must decide where to go.","translation":"我们必须决定去哪里。"},{"en":"develop","zh":"发展；培养","pos":"v.","example":"We can develop good habits at school.","translation":"我们可以在学校培养好习惯。"},{"en":"practice","zh":"练习","pos":"v.","example":"We practice English after school.","translation":"我们放学后练习英语。"},{"en":"improve","zh":"提高；改善","pos":"v.","example":"Reading helps me improve my English.","translation":"阅读帮助我提高英语水平。"},{"en":"knowledge","zh":"知识","pos":"n.","example":"Books give us knowledge.","translation":"书籍给我们知识。"},{"en":"journey","zh":"旅程","pos":"n.","example":"Our journey began on Monday.","translation":"我们的旅程从星期一开始。"},{"en":"prepare","zh":"准备","pos":"v.","example":"Let''s prepare lunch together.","translation":"我们一起准备午餐吧。"},{"en":"remember","zh":"记住","pos":"v.","example":"I remember your name.","translation":"我记得你的名字。"}]'::jsonb);
 end if;
 if b is null then raise exception 'book_unavailable';end if;
 with items as (
  select w,ordinality, rw_private.mastery_norm(w->>'en') en_key,
   md5(rw_private.mastery_norm(w->>'en')||chr(31)||rw_private.mastery_norm(w->>'zh')) word_key
  from jsonb_array_elements(b->'words') with ordinality x(w,ordinality)
  where nullif(btrim(w->>'en'),'') is not null and nullif(btrim(w->>'zh'),'') is not null
 ), unique_items as (
  select distinct on(en_key) * from items order by en_key,ordinality
 )
 select coalesce(jsonb_agg(w||jsonb_build_object('word_key',word_key,'en_key',en_key,
    'difficulty',case when w->>'difficulty' in ('1','2','3') then (w->>'difficulty')::int else 2 end,
    'graded',w->>'difficulty' in ('1','2','3')) order by ordinality),'[]') into pool from unique_items;
 return b||jsonb_build_object('kind',p_kind,'source_key',p_kind||':'||coalesce(p_source::text,'default'),'words',pool);
end $$;

create table public.rw_mastery_sessions(
 id uuid primary key default gen_random_uuid(),
 student uuid not null references auth.users(id) on delete cascade,
 source_kind text not null check(source_kind in ('library','task','basic')),
 source_id uuid,
 source_key text not null,
 mode text not null check(mode in ('reading','writing')),
 title text not null,
 source_version text not null,
 questions jsonb not null check(jsonb_typeof(questions)='array' and jsonb_array_length(questions) between 1 and 20),
 status text not null default 'active' check(status in ('active','completed','abandoned')),
 started_at timestamptz not null default now(),
 submitted_at timestamptz,
 results jsonb,
 check((status='completed')=(submitted_at is not null))
);
alter table public.rw_mastery_sessions enable row level security;
revoke all on public.rw_mastery_sessions from public,anon,authenticated;
grant select on public.rw_mastery_sessions to authenticated;
create policy own_mastery_sessions on public.rw_mastery_sessions for select to authenticated using(student=(select auth.uid()));
create unique index rw_one_active_mastery on public.rw_mastery_sessions(student,source_key,mode) where status='active';
create index rw_mastery_history on public.rw_mastery_sessions(student,source_key,mode,submitted_at desc) where status='completed';

create or replace function rw_private.mastery_summary(p_kind text,p_source uuid,p_mode text)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare b jsonb; pool jsonb; report jsonb;
begin
 b:=rw_private.mastery_source(p_kind,p_source);pool:=b->'words';
 if p_mode not in ('reading','writing') then raise exception 'invalid_mode';end if;
 with population as (
  select w->>'word_key' key,(w->>'difficulty')::int level from jsonb_array_elements(pool) w
 ), events as (
  select r->>'word_key' key,(r->>'correct')::boolean correct,s.submitted_at at,s.id,
   row_number() over(partition by r->>'word_key' order by s.submitted_at desc,s.id desc) rank
  from public.rw_mastery_sessions s cross join lateral jsonb_array_elements(s.results) r
  join population p on p.key=r->>'word_key'
  where s.student=auth.uid() and s.source_key=b->>'source_key' and s.mode=p_mode and s.status='completed'
    and not coalesce((r->>'assisted')::boolean,false)
 ), latest as (
  select * from events where rank=1
 ), delayed as (
  select l.key from latest l
  where l.correct and exists(
   select 1 from events e where e.key=l.key and e.correct and e.at<=l.at-interval '24 hours'
   and not exists(select 1 from events bad where bad.key=l.key and not bad.correct and bad.at>=e.at and bad.at<=l.at)
  )
 ), levels as (
  select p.level,count(*) n,count(l.key) tested,count(*) filter(where l.correct) correct
  from population p left join latest l using(key) group by p.level
 )
 select jsonb_build_object(
  'total',(select count(*) from population),
  'tested',(select count(*) from latest),
  'correct',(select count(*) from latest where correct),
  'delayed',(select count(*) from delayed),
  'coverage',coalesce(round(100.0*(select count(*) from latest)/nullif((select count(*) from population),0)),0),
  'estimate',case when min(tested)>0 and sum(tested)>=least(5,sum(n)) then
   case when sum(tested)=sum(n) then round(100.0*sum(correct)/nullif(sum(n),0))
    else 5*round(20.0*sum(n*correct::numeric/nullif(tested,0))/nullif(sum(n),0)) end else null end,
  'last_test',(select max(at) from latest),
  'ungraded',(select count(*) from jsonb_array_elements(pool) w where not coalesce((w->>'graded')::boolean,false))
 ) into report from levels;
 return report;
end $$;

create or replace function public.rw_mastery_books()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare uid uuid:=auth.uid(); grp text; r record; b jsonb; result jsonb:='[]';
begin
 select cohort into grp from public.rw_members where user_id=uid and role='student' and password_changed;
 if not found then raise exception 'student_required';end if;
 for r in
  select 'basic'::text kind,null::uuid id
  union all select 'library',l.id from public.rw_libraries l join public.rw_bookshelf s on s.library=l.id and s.student=uid
  union all select 'task',t.id from public.rw_tasks t where t.cohort is null or t.cohort=grp
 loop
  b:=rw_private.mastery_source(r.kind,r.id);
  if jsonb_array_length(b->'words')>0 then
   result:=result||jsonb_build_array((b-'words')||jsonb_build_object('summary',rw_private.mastery_summary(r.kind,r.id,b->>'category')));
  end if;
 end loop;
 return result;
end $$;

create or replace function public.rw_begin_mastery(p_kind text,p_source uuid,p_mode text default null,p_restart boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); b jsonb; pool jsonb; mode_value text; version text; session public.rw_mastery_sessions;
 questions jsonb:='[]'; candidates jsonb; options jsonb; q jsonb; w jsonb; item record;
begin
 b:=rw_private.mastery_source(p_kind,p_source);
 mode_value:=coalesce(p_mode,b->>'category');
 if mode_value not in ('reading','writing') then raise exception 'invalid_mode';end if;
 pool:=b->'words';version:=md5(pool::text);
 if jsonb_array_length(pool)=0 then raise exception 'empty_book';end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 select * into session from public.rw_mastery_sessions
 where student=uid and source_key=b->>'source_key' and mode=mode_value and status='active' for update;
 if found and not p_restart and session.source_version=version then return to_jsonb(session)-'student';end if;
 if session.id is not null then update public.rw_mastery_sessions set status='abandoned' where id=session.id;end if;
 -- Round-robin random sampling across teacher-labelled difficulty bands.
 for item in
  with ranked as (
   select value w,row_number() over(partition by value->>'difficulty' order by random()) band_rank,random() tie
   from jsonb_array_elements(pool)
  ), sample as (
   select * from ranked order by band_rank,tie limit least(20,jsonb_array_length(pool))
  )
  select sample.w from sample order by (sample.w->>'difficulty')::int,
    length(regexp_replace(sample.w->>'en','[^A-Za-z]','','g')),tie
 loop
  w:=item.w;options:='[]';
  if mode_value='reading' then
   candidates:=pool||'[{"en":"discover","zh":"发现；发觉","pos":"v.","example":"We hope to discover a new star.","translation":"我们希望发现一颗新星。"},{"en":"balloon","zh":"气球","pos":"n.","example":"The red balloon flew away.","translation":"那个红气球飞走了。"},{"en":"wheel","zh":"轮子","pos":"n.","example":"My bike has a broken wheel.","translation":"我的自行车有一个轮子坏了。"},{"en":"central","zh":"中心的","pos":"adj.","example":"Meet me at the central station.","translation":"在中心车站和我见面吧。"},{"en":"although","zh":"虽然；尽管","pos":"conj.","example":"Although it was cold, we went outside.","translation":"虽然天气很冷，我们还是出门了。"},{"en":"attach","zh":"系上；连接","pos":"v.","example":"Please attach a photo to your email.","translation":"请在邮件中附上一张照片。"},{"en":"pull","zh":"拉；拖","pos":"v.","example":"Please pull the door open.","translation":"请把门拉开。"},{"en":"international","zh":"国际的","pos":"adj.","example":"She studies at an international school.","translation":"她在一所国际学校学习。"},{"en":"path","zh":"小路；路径","pos":"n.","example":"Follow the path to the lake.","translation":"沿着小路走到湖边。"},{"en":"technique","zh":"技术；技巧","pos":"n.","example":"Our coach taught us a new swimming technique.","translation":"教练教了我们一种新的游泳技巧。"},{"en":"depend","zh":"依靠；取决于","pos":"v.","example":"Young birds depend on their parents.","translation":"幼鸟依靠父母生活。"},{"en":"describe","zh":"描述","pos":"v.","example":"Can you describe your room?","translation":"你能描述一下你的房间吗？"},{"en":"decide","zh":"决定","pos":"v.","example":"We must decide where to go.","translation":"我们必须决定去哪里。"},{"en":"develop","zh":"发展；培养","pos":"v.","example":"We can develop good habits at school.","translation":"我们可以在学校培养好习惯。"},{"en":"practice","zh":"练习","pos":"v.","example":"We practice English after school.","translation":"我们放学后练习英语。"},{"en":"improve","zh":"提高；改善","pos":"v.","example":"Reading helps me improve my English.","translation":"阅读帮助我提高英语水平。"},{"en":"knowledge","zh":"知识","pos":"n.","example":"Books give us knowledge.","translation":"书籍给我们知识。"},{"en":"journey","zh":"旅程","pos":"n.","example":"Our journey began on Monday.","translation":"我们的旅程从星期一开始。"},{"en":"prepare","zh":"准备","pos":"v.","example":"Let''s prepare lunch together.","translation":"我们一起准备午餐吧。"},{"en":"remember","zh":"记住","pos":"v.","example":"I remember your name.","translation":"我记得你的名字。"}]'::jsonb;
   with distinct_choices as (
    select distinct on(rw_private.mastery_norm(v->>'zh')) v,random() shuffle
    from jsonb_array_elements(candidates) v
    where rw_private.mastery_norm(v->>'en')<>rw_private.mastery_norm(w->>'en')
      and nullif(btrim(v->>'zh'),'') is not null
      and not(regexp_split_to_array(rw_private.mastery_norm(v->>'zh'),'[;；、]') &&
              regexp_split_to_array(rw_private.mastery_norm(w->>'zh'),'[;；、]'))
    order by rw_private.mastery_norm(v->>'zh'),random()
   ), distractors as (
    select jsonb_build_object('en',v->>'en','zh',v->>'zh') v from distinct_choices
    order by case when v->>'pos'=w->>'pos' then 0 else 1 end,shuffle limit 3
   ), all_options as (
    select v from distractors union all select jsonb_build_object('en',w->>'en','zh',w->>'zh')
   )
   select jsonb_agg(v order by random()) into options from all_options;
   if jsonb_array_length(options)<>4 then raise exception 'not_enough_distinct_options';end if;
  end if;
  q:=w||jsonb_build_object('options',options);
  questions:=questions||jsonb_build_array(q);
 end loop;
 insert into public.rw_mastery_sessions(student,source_kind,source_id,source_key,mode,title,source_version,questions)
 values(uid,p_kind,p_source,b->>'source_key',mode_value,b->>'title',version,questions) returning * into session;
 return to_jsonb(session)-'student';
end $$;

create or replace function public.rw_finish_mastery(p_test uuid,p_responses jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); s public.rw_mastery_sessions; q jsonb; a jsonb; result_rows jsonb:='[]'; i int;
 response text; ok boolean; canonical boolean; assisted boolean; current_book jsonb;
begin
 if not exists(select 1 from public.rw_members where user_id=uid and role='student' and password_changed) then raise exception 'student_required';end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 select * into s from public.rw_mastery_sessions where id=p_test and student=uid for update;
 if not found then raise exception 'test_unavailable';end if;
 if s.status='abandoned' then raise exception 'test_restarted';end if;
 -- Permission and current word meanings are checked again on submission.
 current_book:=rw_private.mastery_source(s.source_kind,s.source_id);
 if s.status='completed' then
  return jsonb_build_object('id',s.id,'results',s.results,'mode',s.mode,
   'summary',rw_private.mastery_summary(s.source_kind,s.source_id,s.mode));
 end if;
 if p_responses is null or jsonb_typeof(p_responses)<>'array' or jsonb_array_length(p_responses)<>jsonb_array_length(s.questions) then raise exception 'incomplete_test';end if;
 for i in 0..jsonb_array_length(s.questions)-1 loop
  q:=s.questions->i;a:=p_responses->i;
  if jsonb_typeof(a)<>'object' or a->>'value' is null or length(a->>'value')>1000 then raise exception 'invalid_response';end if;
  response:=rw_private.mastery_norm(a->>'value');
  assisted:=coalesce((a->>'assisted')::boolean,false);
  if s.mode='reading' and response<>'' and not exists(select 1 from jsonb_array_elements(q->'options') o where rw_private.mastery_norm(o->>'en')=response) then raise exception 'invalid_option';end if;
  canonical:=response<>'' and response=rw_private.mastery_norm(q->>'en');
  ok:=canonical;
  if s.mode='writing' and not ok and jsonb_typeof(q->'alternatives')='array' then
   select exists(select 1 from jsonb_array_elements_text(q->'alternatives') v where response<>'' and rw_private.mastery_norm(v)=response) into ok;
  end if;
  result_rows:=result_rows||jsonb_build_array(jsonb_build_object('word',q->>'en','meaning',q->>'zh','pos',q->>'pos',
   'word_key',q->>'word_key','difficulty',q->'difficulty','response',a->>'value','correct',ok,'assisted',assisted,
   'alternative',ok and not canonical,'type',case s.mode when 'reading' then '阅读辨义' else '作文默写' end));
 end loop;
 update public.rw_mastery_sessions set status='completed',submitted_at=now(),results=result_rows where id=s.id;
 -- Keep the existing personal history entry point useful.
 insert into public.rw_book_tests(id,student,title,at,answers,sentence)
 values(s.id,uid,s.title,now(),result_rows,jsonb_build_object('kind','mastery','mode',s.mode,'source_key',s.source_key));
 return jsonb_build_object('id',s.id,'results',result_rows,'mode',s.mode,
  'summary',rw_private.mastery_summary(s.source_kind,s.source_id,s.mode));
end $$;

-- Helpers are intentionally accessible only through the authenticated API.
revoke all on all functions in schema rw_private from public,anon,authenticated;
revoke all on function public.rw_mastery_books() from public,anon;
revoke all on function public.rw_begin_mastery(text,uuid,text,boolean) from public,anon;
revoke all on function public.rw_finish_mastery(uuid,jsonb) from public,anon;
grant execute on function public.rw_mastery_books() to authenticated;
grant execute on function public.rw_begin_mastery(text,uuid,text,boolean) to authenticated;
grant execute on function public.rw_finish_mastery(uuid,jsonb) to authenticated;

-- Task catalogues and test sources must respect class membership.
drop policy if exists member_tasks on public.rw_tasks;
drop policy if exists require_changed_password on public.rw_tasks;
drop policy if exists task_audience on public.rw_tasks;
create policy task_audience on public.rw_tasks for select to authenticated using(
 exists(select 1 from public.rw_members m where m.user_id=(select auth.uid()) and
 (m.role='teacher' or (m.role='student' and m.password_changed and (rw_tasks.cohort is null or m.cohort=rw_tasks.cohort))))
);
create policy teacher_updates_tasks on public.rw_tasks for update to authenticated
 using(exists(select 1 from public.rw_members m where m.user_id=(select auth.uid()) and m.role='teacher'))
 with check(exists(select 1 from public.rw_members m where m.user_id=(select auth.uid()) and m.role='teacher'));
