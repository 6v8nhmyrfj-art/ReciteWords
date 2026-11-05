create or replace function public.rw_enroll_created_student() returns trigger language plpgsql security definer set search_path='' as $$ begin
if new.raw_app_meta_data ? 'rw_student_name' then
insert into public.rw_members(user_id,role,display_name) values(new.id,'student',left(new.raw_app_meta_data->>'rw_student_name',30)) on conflict (user_id) do nothing;
end if; return new; end $$;
create trigger rw_enroll_on_metadata after update of raw_app_meta_data on auth.users for each row execute function public.rw_enroll_created_student();