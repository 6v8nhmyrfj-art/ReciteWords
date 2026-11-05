alter table public.rw_members add column cohort text;
update public.rw_members m set cohort=u.raw_app_meta_data->>'rw_group' from auth.users u where u.id=m.user_id;
alter table public.rw_tasks add column cohort text;
grant insert(cohort) on public.rw_tasks to authenticated;
create policy task_audience on public.rw_tasks as restrictive for select to authenticated using(cohort is null or exists(select from public.rw_members m where m.user_id=auth.uid() and (m.role='teacher' or m.cohort=rw_tasks.cohort)));
create table public.rw_libraries(id uuid primary key default gen_random_uuid(),title text not null check(length(trim(title)) between 1 and 100),book text not null default '',words jsonb not null check(jsonb_typeof(words)='array' and jsonb_array_length(words) between 1 and 2000),created_at timestamptz default now());
alter table public.rw_libraries enable row level security;
revoke all on public.rw_libraries from public,anon,authenticated;
grant select,insert on public.rw_libraries to authenticated;
create policy teacher_libraries on public.rw_libraries to authenticated using(exists(select from public.rw_members where user_id=auth.uid() and role='teacher')) with check(exists(select from public.rw_members where user_id=auth.uid() and role='teacher'));
create table public.rw_answers(id uuid primary key,student uuid not null references public.rw_members(user_id),word text not null,correct boolean not null,at timestamptz not null default now());
alter table public.rw_answers enable row level security;
revoke all on public.rw_answers from public,anon,authenticated;
create function public.rw_answer(p_id uuid,p_task uuid,p_index integer,p_answer text) returns boolean language plpgsql security definer set search_path='' as $$ declare target text; ok boolean;begin
select t.words->p_index->>'en' into target from public.rw_tasks t join public.rw_members m on m.user_id=auth.uid() where t.id=p_task and m.role='student' and m.password_changed and (t.cohort is null or t.cohort=m.cohort) and p_index>=0;
if target is null then raise exception 'invalid task'; end if;
ok=lower(trim(target))=lower(trim(p_answer));insert into public.rw_answers values(p_id,auth.uid(),lower(trim(target)),ok,now()) on conflict do nothing;return ok;end$$;
create function public.rw_dashboard() returns jsonb language plpgsql stable security definer set search_path='' as $$ begin
if not exists(select from public.rw_members where user_id=auth.uid() and role='teacher') then raise exception 'teacher required';end if;
return jsonb_build_object('members',(select coalesce(jsonb_agg(to_jsonb(s)),'[]') from(select user_id,display_name,cohort from public.rw_members where role='student')s),'learned',(select coalesce(jsonb_agg(to_jsonb(s)),'[]') from(select p.user_id,lower(trim(t.words->p.word_index->>'en')) word,max(p.learned_on) last_day from public.rw_progress p join public.rw_tasks t on t.id=p.task_id group by 1,2)s),'checked',(select coalesce(jsonb_agg(distinct s.user_id),'[]') from(select p.user_id from public.rw_progress p join public.rw_tasks t on t.id=p.task_id where p.learned_on=(now() at time zone 'Asia/Shanghai')::date group by p.user_id,t.id,t.words having count(*)>=jsonb_array_length(t.words))s),'answers',(select coalesce(jsonb_agg(to_jsonb(s)),'[]') from(select student,word,count(*) n,count(*) filter(where correct) hits from public.rw_answers where at>=date_trunc('week',now() at time zone 'Asia/Shanghai') at time zone 'Asia/Shanghai' group by 1,2)s));end$$;
revoke all on function public.rw_answer(uuid,uuid,integer,text),public.rw_dashboard() from public,anon;
grant execute on function public.rw_answer(uuid,uuid,integer,text),public.rw_dashboard() to authenticated;