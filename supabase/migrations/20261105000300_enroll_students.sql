create function public.rw_enroll_created_student() returns trigger language plpgsql security definer set search_path='' as $$ begin
if new.raw_app_meta_data ? 'rw_student_name' then
insert into public.rw_members(user_id,role,display_name) values(new.id,'student',left(new.raw_app_meta_data->>'rw_student_name',30));
end if; return new; end $$;
revoke all on function public.rw_enroll_created_student() from public,anon,authenticated;
create trigger rw_enroll_student after insert on auth.users for each row execute function public.rw_enroll_created_student();