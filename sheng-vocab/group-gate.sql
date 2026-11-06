create table public.rw_group_tests(
 id uuid primary key,student uuid not null references auth.users(id) on delete cascade,
 title text not null,at timestamptz not null default now(),answers jsonb not null,
 correct integer not null check(correct between 0 and 10)
);
alter table public.rw_group_tests enable row level security;
revoke all on public.rw_group_tests from public,anon,authenticated;
grant select on public.rw_group_tests to authenticated;
create policy own_group_tests on public.rw_group_tests for select to authenticated using(student=(select auth.uid()));
create index rw_group_tests_student_at on public.rw_group_tests(student,at desc);
create function public.rw_submit_group(p_id uuid,p_title text,p_answers jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); grp text; prior public.rw_group_tests; a jsonb; w jsonb; k text;
 refs jsonb:='[]'; seen text[]:='{}'; n int:=0; ok boolean; t uuid; idx int;
begin
 select cohort into grp from public.rw_members where user_id=uid and role='student' and password_changed;
 if not found then raise exception 'student required';end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 select * into prior from public.rw_group_tests where id=p_id and student=uid;
 if found then return jsonb_build_object('correct',prior.correct,'passed',prior.correct>=9,'answers',prior.answers);end if;
 if p_answers is null or jsonb_typeof(p_answers)<>'array' or jsonb_array_length(p_answers)<>10 then raise exception 'exactly ten questions required';end if;
 if p_title is null or length(p_title)>200 then raise exception 'invalid title';end if;
 for a in select value from jsonb_array_elements(p_answers) loop
 t:=(a->>'task')::uuid;idx:=(a->>'index')::integer;
 if idx is null or idx<0 then raise exception 'invalid index';end if;
 if t is not null then select words->idx into w from public.rw_tasks where id=t and (cohort is null or cohort=grp);
 else w:='[{"en":"discover","zh":"发现；发觉"},{"en":"balloon","zh":"气球"},{"en":"wheel","zh":"轮子"},{"en":"central","zh":"中心的"},{"en":"although","zh":"虽然；尽管"},{"en":"attach","zh":"系上；连接"},{"en":"pull","zh":"拉；拖"},{"en":"international","zh":"国际的"},{"en":"path","zh":"小路；路径"},{"en":"technique","zh":"技术；技巧"},{"en":"depend","zh":"依靠；取决于"},{"en":"describe","zh":"描述"},{"en":"decide","zh":"决定"},{"en":"develop","zh":"发展；培养"},{"en":"practice","zh":"练习"},{"en":"improve","zh":"提高；改善"},{"en":"knowledge","zh":"知识"},{"en":"journey","zh":"旅程"},{"en":"prepare","zh":"准备"},{"en":"remember","zh":"记住"}]'::jsonb->idx;end if;
 k:=lower(trim(w->>'en'));
 if k is null or k=any(seen) or a->>'choice' is null or length(a->>'choice')>300 then raise exception 'invalid or duplicate word';end if;
 seen:=array_append(seen,k);
 ok:=public.rw_practice(gen_random_uuid(),'quiz',t,idx,k,a->>'choice');
 if ok then n:=n+1;end if;
 refs:=refs||jsonb_build_array(jsonb_build_object('task',t,'index',idx,'word',k,'correct',ok));
 end loop;
 insert into public.rw_group_tests values(p_id,uid,p_title,now(),refs,n);
 if n>=9 then
 for a in select value from jsonb_array_elements(refs) loop
 if a->>'task' is not null then insert into public.rw_progress(user_id,task_id,word_index) values(uid,(a->>'task')::uuid,(a->>'index')::integer) on conflict do nothing;end if;
 end loop;
 end if;
 return jsonb_build_object('correct',n,'passed',n>=9,'answers',refs);
end $$;
revoke all on function public.rw_submit_group(uuid,text,jsonb) from public,anon;
grant execute on function public.rw_submit_group(uuid,text,jsonb) to authenticated;

CREATE OR REPLACE FUNCTION public.rw_practice(p_id uuid, p_mode text, p_task uuid, p_index integer, p_word text, p_choice text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare uid uuid:=auth.uid(); grp text; w jsonb; k text; oldstage int; due timestamptz; st int; ok boolean; days int[]:=array[1,2,4,7,15,30]; prior boolean;
begin
select cohort into grp from public.rw_members where user_id=uid and role='student' and password_changed;
if not found or p_mode not in ('task','self','quiz','review') or p_mode is null then raise exception 'invalid access';end if;
perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
select correct into prior from public.rw_answers where id=p_id and student=uid;if found then return prior;end if;
if p_mode='review' then select jsonb_build_object('en',word,'zh',meaning) into w from public.rw_review_cards where student=uid and word=p_word;
elsif p_index>=0 and p_task is not null then select words->p_index into w from public.rw_tasks where id=p_task and (cohort is null or cohort=grp);
elsif p_index>=0 and p_mode<>'task' then w='[{"en":"discover","zh":"发现；发觉"},{"en":"balloon","zh":"气球"},{"en":"wheel","zh":"轮子"},{"en":"central","zh":"中心的"},{"en":"although","zh":"虽然；尽管"},{"en":"attach","zh":"系上；连接"},{"en":"pull","zh":"拉；拖"},{"en":"international","zh":"国际的"},{"en":"path","zh":"小路；路径"},{"en":"technique","zh":"技术；技巧"},{"en":"depend","zh":"依靠；取决于"},{"en":"describe","zh":"描述"},{"en":"decide","zh":"决定"},{"en":"develop","zh":"发展；培养"},{"en":"practice","zh":"练习"},{"en":"improve","zh":"提高；改善"},{"en":"knowledge","zh":"知识"},{"en":"journey","zh":"旅程"},{"en":"prepare","zh":"准备"},{"en":"remember","zh":"记住"}]'::jsonb->p_index;end if;
k=lower(trim(w->>'en'));if k is null or p_choice is null then raise exception 'invalid word';end if;
ok=k=lower(trim(p_choice));
insert into public.rw_answers(id,student,word,correct) values(p_id,uid,k,ok);
select stage,due_at into oldstage,due from public.rw_review_cards where student=uid and word=k;
if not ok or due is null or due<=now() then
st=case when ok then least(6,coalesce(oldstage,0)+1) else 0 end;
insert into public.rw_review_cards values(uid,k,w->>'zh',st,case when ok then now()+make_interval(days=>days[st]) else now()+interval '10 minutes' end)
on conflict(student,word) do update set stage=excluded.stage,due_at=excluded.due_at,meaning=excluded.meaning;
end if;

return ok;end$function$
;

revoke insert,update,delete on public.rw_progress from authenticated;
drop policy require_changed_password on public.rw_progress;
drop policy record_progress on public.rw_progress;
