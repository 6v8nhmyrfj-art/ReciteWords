begin;
-- Existing assignments stay unchanged; newly published vocabulary targets require speech.
alter table public.rw_weekly_targets add column if not exists pronunciation_required boolean not null default false;
alter table public.rw_weekly_targets alter column pronunciation_required set default true;
create table if not exists public.rw_pronunciation_sessions(
 id uuid primary key default gen_random_uuid(),student uuid not null references public.rw_members(user_id),
 item uuid not null references public.rw_weekly_items(id),revision int not null,words jsonb not null,state jsonb not null,
 version int not null default 0,updated_at timestamptz not null default now(),unique(student,item,revision)
);
alter table public.rw_pronunciation_sessions enable row level security;
revoke all on public.rw_pronunciation_sessions from public,anon,authenticated;
grant select on public.rw_pronunciation_sessions,public.rw_weekly_items,public.rw_weekly_targets,public.rw_class_goals to service_role;
create or replace function public.rw_pronunciation_open(p_item uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare m public.rw_members;i public.rw_weekly_items;t public.rw_weekly_targets;g public.rw_class_goals;s public.rw_pronunciation_sessions;idx jsonb;
begin
select * into m from public.rw_members where user_id=auth.uid();
if m.role is distinct from 'student' or not m.password_changed then raise exception '请用已改密学生账号';end if;
select * into i from public.rw_weekly_items where id=p_item;
select * into t from public.rw_weekly_targets where id=i.target;
if i.id is null or t.cohort is distinct from m.cohort then raise exception '无法访问任务';end if;
if t.kind<>'vocabulary' or not t.pronunciation_required then return jsonb_build_object('required',false);end if;
if i.due_date>(now() at time zone 'Asia/Shanghai')::date then raise exception '任务尚未开始';end if;
select * into g from public.rw_class_goals where id=t.goal;
select jsonb_agg(n order by n) into idx from generate_series(i.start_index,i.end_index)n;
insert into public.rw_pronunciation_sessions(student,item,revision,words,state)
values(m.user_id,i.id,g.revision,g.words,jsonb_build_object('version',1,'indices',idx,'passed','[]'::jsonb,'queue',idx,'missed','[]'::jsonb,'cursor',0,'round',1,'phase','test')) on conflict do nothing;
select * into s from public.rw_pronunciation_sessions where student=m.user_id and item=i.id and revision=g.revision;
return to_jsonb(s)||jsonb_build_object('required',true);
end $$;
revoke all on function public.rw_pronunciation_open(uuid) from public,anon;
grant execute on function public.rw_pronunciation_open(uuid) to authenticated;
-- Only the trusted audio worker may commit a transition. CAS prevents double credit.
create or replace function public.rw_pronunciation_commit(p_id uuid,p_student uuid,p_version int,p_state jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s public.rw_pronunciation_sessions;
begin
select * into s from public.rw_pronunciation_sessions where id=p_id and student=p_student for update;
if s.id is null then raise exception '无法访问发音测试';end if;
if s.version=p_version then
update public.rw_pronunciation_sessions set state=p_state,version=version+1,updated_at=now() where id=p_id returning * into s;
end if;
return to_jsonb(s);
end $$;
revoke all on function public.rw_pronunciation_commit(uuid,uuid,int,jsonb) from public,anon,authenticated;
grant execute on function public.rw_pronunciation_commit(uuid,uuid,int,jsonb) to service_role;
-- Enforce speech completion before a new vocabulary meaning test on all clients.
DO $$declare def text;needle text:='  if it.due_date>today then raise exception ''任务尚未到安排日期'';end if;';begin
select pg_get_functiondef('rw_private.weekly(text,jsonb)'::regprocedure) into def;
if position('请先完成本次发音过关' in def)=0 then
if position(needle in def)=0 then raise exception 'weekly gate anchor changed';end if;
def:=replace(def,needle,needle||E'\n  if t.kind=''vocabulary'' and t.pronunciation_required and not exists(select 1 from public.rw_pronunciation_sessions ps where ps.student=u and ps.item=it.id and ps.revision=g.revision and ps.state->>''phase''=''complete'') then raise exception ''请先完成本次发音过关'';end if;');
execute def;end if;
end $$;
notify pgrst,'reload schema';
commit;
