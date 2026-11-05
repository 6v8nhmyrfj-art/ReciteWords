create table public.rw_book_tests (
 id uuid primary key, student uuid not null default auth.uid() references auth.users(id) on delete cascade,
 title text not null check(length(title) between 1 and 200), at timestamptz not null default now(),
 answers jsonb not null check(jsonb_typeof(answers)='array' and jsonb_array_length(answers) between 1 and 20 and octet_length(answers::text)<60000),
 sentence jsonb not null check(jsonb_typeof(sentence)='object' and octet_length(sentence::text)<12000)
);
alter table public.rw_book_tests enable row level security;
revoke all on public.rw_book_tests from public,anon,authenticated;
grant select,insert(id,title,answers,sentence) on public.rw_book_tests to authenticated;
create policy read_own on public.rw_book_tests for select to authenticated using(student=(select auth.uid()));
create policy save_own on public.rw_book_tests for insert to authenticated with check(student=(select auth.uid()) and exists(select 1 from public.rw_members where user_id=(select auth.uid()) and role='student' and password_changed));
create index rw_book_tests_student_at on public.rw_book_tests(student,at desc);
create function public.rw_vocabulary_trend() returns table(day date,total bigint) language sql stable security invoker set search_path='' as $$
 with first_correct as (select word,min((at at time zone 'Asia/Shanghai')::date) as first_day from public.rw_answers where student=auth.uid() and correct group by word),
 days as (select (now() at time zone 'Asia/Shanghai')::date-i as d from generate_series(0,29) i)
 select d,count(word) from days left join first_correct on first_day<=d group by d order by d
$$;
revoke all on function public.rw_vocabulary_trend() from public,anon;
grant execute on function public.rw_vocabulary_trend() to authenticated;
grant select(student,word,correct,at) on public.rw_answers to authenticated;
create policy student_answer_history on public.rw_answers for select to authenticated using(student=(select auth.uid()));
create table public.rw_known_checks(
 student uuid not null references auth.users(id) on delete cascade, word text not null, meaning text not null,
 due_at timestamptz not null, state text not null check(state in ('pending','relearn','verified')),
 primary key(student,word)
);
alter table public.rw_known_checks enable row level security;
revoke all on public.rw_known_checks from public,anon,authenticated;
grant select on public.rw_known_checks to authenticated;
create policy read_my_checks on public.rw_known_checks for select to authenticated using(student=(select auth.uid()));
create function public.rw_skip_familiar(p_task uuid,p_index integer,p_word text,p_meaning text) returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); grp text; w jsonb; k text; m text;
begin
 select cohort into grp from public.rw_members where user_id=uid and role='student' and password_changed;
 if not found then raise exception 'student required'; end if;
 if p_task is not null then
 select words->p_index into w from public.rw_tasks where id=p_task and (cohort is null or cohort=grp) and p_index>=0;
 k:=lower(trim(w->>'en'));m:=w->>'zh';
 else
 k:=lower(trim(p_word));m:=p_meaning;
 if not(k=any(array['discover','balloon','wheel','central','although','attach','pull','international','path','technique','depend','describe','decide','develop','practice','improve','knowledge','journey','prepare','remember'])) then raise exception 'unknown word'; end if;
 end if;
 if k is null or m is null or length(m)>500 then raise exception 'invalid word';end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 insert into public.rw_known_checks values(uid,k,m,now()+interval '1 day' +random()*interval '2 days','pending') on conflict do nothing;
 if exists(select 1 from public.rw_known_checks where student=uid and word=k and (state='relearn' or due_at<=now())) then raise exception '请先完成这个词的抽查或重学';end if;
end $$;
revoke all on function public.rw_skip_familiar(uuid,integer,text,text) from public,anon;
grant execute on function public.rw_skip_familiar(uuid,integer,text,text) to authenticated;
-- Score a recall before revealing its meaning. Ordinary practice cannot verify a skipped word.
create function public.rw_check_familiar(p_id uuid,p_word text,p_choice text) returns boolean language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); c public.rw_known_checks;ok boolean;
begin
 if not exists(select 1 from public.rw_members where user_id=uid and role='student' and password_changed) then raise exception 'student required';end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 select correct into ok from public.rw_answers where student=uid and id=p_id;if found then return ok;end if;
 select * into c from public.rw_known_checks where student=uid and word=p_word and due_at<=now() and state<>'relearn';
 if not found then raise exception 'check no longer due';end if;
 ok:=coalesce(c.word=lower(trim(p_choice)),false);
 insert into public.rw_answers(id,student,word,correct) values(p_id,uid,c.word,ok);
 update public.rw_known_checks set state=case when ok then 'verified' else 'relearn' end,
 due_at=case when ok then now()+ interval '7 days'+ random()*interval '7 days' else now() end where student=uid and word=c.word;
 insert into public.rw_review_cards(student,word,meaning,stage,due_at) values(uid,c.word,c.meaning,case when ok then 1 else 0 end,case when ok then now()+interval '14 days' else now() end)
 on conflict(student,word) do update set meaning=excluded.meaning,stage=excluded.stage,due_at=excluded.due_at;
 return ok;
end $$;
revoke all on function public.rw_check_familiar(uuid,text,text) from public,anon;
grant execute on function public.rw_check_familiar(uuid,text,text) to authenticated;
create function public.rw_finish_relearning() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.correct then update public.rw_known_checks set state='pending',due_at=now()+interval '1 day' where student=new.student and word=new.word and state='relearn';end if;
 return new;
end $$;
revoke all on function public.rw_finish_relearning() from public,anon,authenticated;
create trigger rw_after_relearning after insert on public.rw_answers for each row when(new.correct) execute function public.rw_finish_relearning();
