create table public.rw_review_cards(student uuid not null references public.rw_members(user_id),word text not null,meaning text not null,stage smallint not null,due_at timestamptz not null,primary key(student,word));
create index rw_review_due on public.rw_review_cards(student,due_at);
alter table public.rw_review_cards enable row level security;
revoke all on public.rw_review_cards from public,anon,authenticated;grant select on public.rw_review_cards to authenticated;
create policy own_reviews on public.rw_review_cards for select to authenticated using(student=auth.uid() and exists(select from public.rw_members where user_id=auth.uid() and role='student' and password_changed));
create function public.rw_practice(p_id uuid,p_mode text,p_task uuid,p_index integer,p_word text,p_choice text) returns boolean language plpgsql security definer set search_path='' as $$
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
if not ok or due is null or due<=now() or oldstage=0 then
st=case when ok then least(6,coalesce(oldstage,0)+1) else 0 end;
insert into public.rw_review_cards values(uid,k,w->>'zh',st,case when ok then now()+make_interval(days=>days[st]) else now()+interval '10 minutes' end)
on conflict(student,word) do update set stage=excluded.stage,due_at=excluded.due_at,meaning=excluded.meaning;
end if;
if ok and p_mode='task' then insert into public.rw_progress(user_id,task_id,word_index) values(uid,p_task,p_index) on conflict do nothing;end if;
return ok;end$$;
revoke all on function public.rw_practice(uuid,text,uuid,integer,text,text) from public,anon;
grant execute on function public.rw_practice(uuid,text,uuid,integer,text,text) to authenticated;