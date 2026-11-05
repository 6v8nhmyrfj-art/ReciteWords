alter table public.rw_members add column password_changed boolean not null default false;
create function public.rw_password_changed() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.encrypted_password is distinct from new.encrypted_password and coalesce(old.encrypted_password,'')<>'' then
 update public.rw_members set password_changed=true where user_id=new.id and role='student';
 end if;
 return new;
end $$;
revoke all on function public.rw_password_changed() from public,anon,authenticated;
create trigger rw_after_password_change after update of encrypted_password on auth.users for each row execute function public.rw_password_changed();
create policy require_changed_password on public.rw_tasks as restrictive for all to authenticated using(exists(select 1 from public.rw_members where user_id=(select auth.uid()) and (role='teacher' or password_changed))) with check(exists(select 1 from public.rw_members where user_id=(select auth.uid()) and (role='teacher' or password_changed)));
create policy require_changed_password on public.rw_progress as restrictive for all to authenticated using(exists(select 1 from public.rw_members where user_id=(select auth.uid()) and (role='teacher' or password_changed))) with check(exists(select 1 from public.rw_members where user_id=(select auth.uid()) and (role='teacher' or password_changed)));
