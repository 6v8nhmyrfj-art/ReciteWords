-- Only the trusted Edge Function service role can read test context for grading.
-- Student/teacher table access remains unchanged and controlled through existing RPCs.
grant select on public.rw_members, public.rw_class_sessions, public.rw_class_goals to service_role;
