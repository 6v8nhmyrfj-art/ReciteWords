-- Tencent production: student onboarding and two-answer password recovery.
begin;
create table if not exists rw_private.student_recovery (
 student uuid primary key references public.rw_members(user_id) on delete cascade,
 question text not null, proof_hash text not null,
 failures integer not null default 0, blocked_until timestamptz,
 updated_at timestamptz not null default now()
);
alter table rw_private.student_recovery enable row level security;
revoke all on rw_private.student_recovery from public,anon,authenticated;
create or replace function rw_private.recovery_proof(answer text,birth text) returns text
language sql immutable set search_path='' as $$
 select encode(extensions.digest(lower(regexp_replace(trim(answer),'\s+',' ','g'))||chr(10)||birth,'sha256'),'hex')
$$;
revoke all on function rw_private.recovery_proof(text,text) from public,anon,authenticated;
create or replace function rw_private.student_security(action text,p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); m public.rw_members; u auth.users; r rw_private.student_recovery;
 username text:=lower(trim(coalesce(p->>'username',''))); password text:=p->>'password';
 question text:=trim(p->>'question'); answer text:=trim(p->>'answer'); birthday date; proof text; sid uuid;
begin
 if action in ('status','setup') then
  sid:=nullif(auth.jwt()->>'session_id','')::uuid;
  if uid is null or not exists(select 1 from auth.sessions where id=sid and user_id=uid) then
   raise exception '登录已失效，请重新登录' using errcode='42501';
  end if;
  select * into m from public.rw_members where user_id=uid;
  if m.role is distinct from 'student' then raise exception '仅学生账号可设置密保';end if;
  if action='status' then return jsonb_build_object('configured',exists(select 1 from rw_private.student_recovery where student=uid));end if;
  if question is null or char_length(question) not between 2 and 100 or answer is null or char_length(answer) not between 1 and 100 then
   return jsonb_build_object('ok',false,'message','请填写密保问题（2–100字）和答案（1–100字）');end if;
  select * into u from auth.users where id=uid for update;
  if coalesce(p->>'current_password','')='' or u.encrypted_password is distinct from extensions.crypt(p->>'current_password',u.encrypted_password) then
   return jsonb_build_object('ok',false,'message','当前密码不正确，请重新输入');end if;
 elsif action in ('question','reset') then
  if username !~ '^[a-z0-9_-]{1,24}$' then return jsonb_build_object('ok',false,'message','请输入学生的拼音账号');end if;
  select users.* into u from auth.users users join public.rw_members members on members.user_id=users.id
   where users.email=username||'@students.recitewords.invalid' and members.role='student';
  uid:=u.id;
  -- Serialize all recovery attempts for an account, including concurrent requests.
  if uid is not null then perform pg_advisory_xact_lock(hashtextextended(uid::text,713));end if;
  select * into r from rw_private.student_recovery where student=uid for update;
  if r.student is null then return jsonb_build_object('ok',false,'message','账号尚未设置密保或不存在，请联系老师重置密码');end if;
  if r.blocked_until>now() then return jsonb_build_object('ok',false,'message','尝试次数过多，请15分钟后重试，或联系老师');end if;
  if action='question' then return jsonb_build_object('ok',true,'question',r.question);end if;
 else raise exception '不支持的操作';end if;
 if password is null or password !~ '^[A-Za-z0-9]{6,72}$' or password='12345678' then
  return jsonb_build_object('ok',false,'message','新密码需为6–72位字母或数字，不能使用初始密码12345678');end if;
 begin
  if coalesce(p->>'birthday','') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'invalid date';end if;
  birthday:=(p->>'birthday')::date;
  if birthday<date '1900-01-01' or birthday>(now() at time zone 'Asia/Shanghai')::date then raise exception 'invalid date';end if;
 exception when others then return jsonb_build_object('ok',false,'message','请选择有效的出生年月日');end;
 if answer is null or char_length(answer) not between 1 and 100 then
  return jsonb_build_object('ok',false,'message','请输入密保答案');end if;
 proof:=rw_private.recovery_proof(answer,to_char(birthday,'YYYY-MM-DD'));
 if action='reset' then
  if r.proof_hash is distinct from extensions.crypt(proof,r.proof_hash) then
   update rw_private.student_recovery set
    failures=case when blocked_until is not null and blocked_until<=now() then 1 else failures+1 end,
    blocked_until=case when (case when blocked_until is not null and blocked_until<=now() then 1 else failures+1 end)>=5 then now()+interval '15 minutes' else null end
    where student=uid;
   return jsonb_build_object('ok',false,'message','密保答案或生日不正确；连续错误5次将暂停15分钟');
  end if;
  update rw_private.student_recovery set failures=0,blocked_until=null,updated_at=now() where student=uid;
 else
  insert into rw_private.student_recovery(student,question,proof_hash)
   values(uid,question,extensions.crypt(proof,extensions.gen_salt('bf',10)))
   on conflict(student) do update set question=excluded.question,proof_hash=excluded.proof_hash,failures=0,blocked_until=null,updated_at=now();
 end if;
 update auth.users set encrypted_password=extensions.crypt(password,extensions.gen_salt('bf',10)),updated_at=now() where id=uid;
 update public.rw_members set password_changed=true where user_id=uid;
 delete from auth.sessions where user_id=uid;
 return jsonb_build_object('ok',true);
end $$;
revoke all on function rw_private.student_security(text,jsonb) from public,anon,authenticated;
-- The public wrapper is the only entry point; private schema stays inaccessible.
create or replace function public.rw_student_security(p_action text,p_payload jsonb default '{}') returns jsonb
language sql security definer set search_path='' as $$ select rw_private.student_security(p_action,p_payload) $$;
revoke all on function public.rw_student_security(text,jsonb) from public;
grant execute on function public.rw_student_security(text,jsonb) to anon,authenticated;
notify pgrst,'reload schema';
commit;
