-- Additive upgrade: keep all existing IDs, records, JSON words and RPC signatures.
set lock_timeout='3s';
create index if not exists rw_answers_student_at on public.rw_answers(student,at desc);
create index if not exists rw_progress_user_day on public.rw_progress(user_id,learned_on desc,task_id,word_index);
create index if not exists rw_progress_task on public.rw_progress(task_id);
create index if not exists rw_bookshelf_library on public.rw_bookshelf(library);
-- rw_review_due and both test-history student/at indexes already exist; do not duplicate them.
alter policy own_reviews on public.rw_review_cards using(
 student=(select auth.uid()) and exists(select 1 from public.rw_members where user_id=(select auth.uid()) and role='student' and password_changed)
);
alter policy teacher_libraries on public.rw_libraries using(
 exists(select 1 from public.rw_members where user_id=(select auth.uid()) and role='teacher')
) with check(exists(select 1 from public.rw_members where user_id=(select auth.uid()) and role='teacher'));
alter table public.rw_libraries add column if not exists updated_at timestamptz not null default now();
alter table public.rw_tasks add column if not exists updated_at timestamptz not null default now();
create or replace function rw_private.touch_content_version() returns trigger language plpgsql security invoker set search_path='' as $$
begin new.updated_at:=clock_timestamp();return new;end $$;
revoke all on function rw_private.touch_content_version() from public,anon,authenticated;
create trigger rw_library_version before update on public.rw_libraries for each row execute function rw_private.touch_content_version();
create trigger rw_task_version before update on public.rw_tasks for each row execute function rw_private.touch_content_version();
create or replace function public.rw_library_catalog()
returns table(id uuid,title text,book text,category text,word_count int,updated_at timestamptz)
language sql stable security invoker set search_path='' as $$
 select id,title,book,category,jsonb_array_length(words),updated_at from public.rw_libraries order by created_at desc,id
$$;
create or replace function public.rw_task_catalog()
returns table(id uuid,title text,category text,cohort text,word_count int,updated_at timestamptz)
language sql stable security invoker set search_path='' as $$
 select id,title,category,cohort,jsonb_array_length(words),updated_at from public.rw_tasks order by created_at desc,id
$$;
create or replace function public.rw_completed_tasks(p_limit int default 30,p_offset int default 0)
returns table(task_id uuid,title text,learned_on date,word_count int)
language sql stable security invoker set search_path='' as $$
 select p.task_id,t.title,p.learned_on,jsonb_array_length(t.words)
 from public.rw_progress p join public.rw_tasks t on t.id=p.task_id
 where p.user_id=(select auth.uid()) and p.word_index>=0 and p.word_index<jsonb_array_length(t.words)
 group by p.task_id,t.id,t.title,p.learned_on
 having count(distinct p.word_index)>=jsonb_array_length(t.words)
 order by p.learned_on desc,p.task_id
 limit greatest(1,least(coalesce(p_limit,30),100)) offset greatest(0,coalesce(p_offset,0))
$$;
revoke all on function public.rw_library_catalog(),public.rw_task_catalog(),public.rw_completed_tasks(int,int) from public,anon;
grant execute on function public.rw_library_catalog(),public.rw_task_catalog(),public.rw_completed_tasks(int,int) to authenticated;
