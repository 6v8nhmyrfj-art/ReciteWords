create function public.rw_reset_student_password(p_student uuid,p_password text) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.rw_members where user_id=auth.uid() and role='teacher') then raise exception 'teacher required' using errcode='42501'; end if;
 if p_password is null or char_length(p_password)<8 or octet_length(p_password)>72 or trim(p_password)='' then raise exception 'invalid temporary password'; end if;
 perform 1 from public.rw_members where user_id=p_student and role='student' for update;
 if not found then raise exception 'student required'; end if;
 update auth.users set encrypted_password=extensions.crypt(p_password,extensions.gen_salt('bf',10)),updated_at=now() where id=p_student;
 update public.rw_members set password_changed=false where user_id=p_student;
 delete from auth.sessions where user_id=p_student;
end $$;
revoke all on function public.rw_reset_student_password(uuid,text) from public,anon;
grant execute on function public.rw_reset_student_password(uuid,text) to authenticated;