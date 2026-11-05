create table public.rw_members (
  user_id uuid primary key references auth.users(id),
  display_name text not null,
  role text not null check (role in ('teacher','student'))
);
create table public.rw_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  words jsonb not null check (jsonb_typeof(words)='array'),
  pass_percent integer not null default 90 check (pass_percent between 1 and 100),
  deadline date,
  created_at timestamptz not null default now()
);
create table public.rw_progress (
  user_id uuid not null references public.rw_members(user_id),
  task_id uuid not null references public.rw_tasks(id),
  word_index integer not null check (word_index >= 0),
  learned_on date not null default ((now() at time zone 'Asia/Shanghai')::date),
  primary key (user_id,task_id,learned_on,word_index)
);
alter table public.rw_members enable row level security;
alter table public.rw_tasks enable row level security;
alter table public.rw_progress enable row level security;
revoke all on public.rw_members,public.rw_tasks,public.rw_progress from public,anon,authenticated;
grant select on public.rw_members,public.rw_tasks,public.rw_progress to authenticated;
grant insert(title,words,pass_percent,deadline) on public.rw_tasks to authenticated;
grant insert(user_id,task_id,word_index) on public.rw_progress to authenticated;
create policy own_membership on public.rw_members for select to authenticated using(user_id=(select auth.uid()));
create policy member_tasks on public.rw_tasks for select to authenticated using(exists(select 1 from public.rw_members));
create policy teacher_publishes on public.rw_tasks for insert to authenticated with check(exists(select 1 from public.rw_members where role='teacher'));
create policy read_progress on public.rw_progress for select to authenticated using(user_id=(select auth.uid()) or exists(select 1 from public.rw_members where role='teacher'));
create policy record_progress on public.rw_progress for insert to authenticated with check(user_id=(select auth.uid()) and exists(select 1 from public.rw_tasks t where t.id=task_id and word_index<jsonb_array_length(t.words)));