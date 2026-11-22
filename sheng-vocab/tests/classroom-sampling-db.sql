begin;
do $$
#variable_conflict use_variable
declare teacher_id uuid;student_id uuid;cohort_name text;book uuid;goal_id uuid;s jsonb;r jsonb;p jsonb;answers jsonb;count_pass int;n int;questions int;bad boolean;policy_revision int;
begin
 select user_id into teacher_id from public.rw_members where role='teacher' limit 1;
 select user_id,cohort into student_id,cohort_name from public.rw_members where role='student' and password_changed and cohort is not null limit 1;
 insert into public.rw_libraries(title,words) values('sampling rollback fixture',(select jsonb_agg(jsonb_build_object('en','word'||i,'zh','释义'||i)) from generate_series(1,60)i)) returning id into book;
 perform set_config('request.jwt.claim.sub',teacher_id::text,true);
 goal_id:=(public.rw_classroom('set_goal',jsonb_build_object('cohort',cohort_name,'library',book,'start',1,'end',60))->>'id')::uuid;
 perform set_config('request.jwt.claim.sub',student_id::text,true);
 foreach n in array array[1,9,10,11,20,50] loop
  s:=public.rw_classroom('begin',jsonb_build_object('id',gen_random_uuid(),'goal',goal_id,'mode','writing','revision',1,'size','custom','start',1,'end',n,'policy','sampling90'));
  questions:=case when n<10 then n else ceil(n/2.0)::int end;
  if jsonb_array_length(s->'questions')<>questions or jsonb_array_length(s->'selected_indices')<>n then raise exception 'sample size % incorrect',n;end if;
 end loop;
 s:=public.rw_classroom('begin',jsonb_build_object('id',gen_random_uuid(),'goal',goal_id,'mode','writing','revision',1,'size','20','policy','sampling90'));
 select jsonb_agg(q->'word'->>'en' order by ord) into answers from jsonb_array_elements(s->'questions') with ordinality a(q,ord);
 answers:=jsonb_set(answers,'{0}','"wrong"');answers:=jsonb_set(answers,'{1}','"wrong"');
 r:=public.rw_classroom('submit',jsonb_build_object('id',gen_random_uuid(),'session',s->>'id','offset',0,'answers',answers));
 if (r->>'passed')::boolean or (r->>'correct')::int<>8 or not (r->>'complete')::boolean then raise exception '80 percent failed threshold';end if;
 if exists(select 1 from public.rw_class_passes cp where cp.goal=goal_id) then raise exception 'failed session awarded';end if;
 bad:=false;begin perform public.rw_classroom('submit',jsonb_build_object('id',gen_random_uuid(),'session',s->>'id','offset',0,'answers',answers));exception when others then bad:=true;end;if not bad then raise exception 'sealed attempt resubmitted';end if;
 s:=public.rw_classroom('begin',jsonb_build_object('id',gen_random_uuid(),'goal',goal_id,'mode','writing','revision',1,'size','20','policy','sampling90'));
 select jsonb_agg(q->'word'->>'en' order by ord) into answers from jsonb_array_elements(s->'questions') with ordinality a(q,ord);
 answers:=jsonb_set(answers,'{0}','"wrong"');p:=jsonb_build_object('id',gen_random_uuid(),'session',s->>'id','offset',0,'answers',answers);
 r:=public.rw_classroom('submit',p);perform public.rw_classroom('submit',p);
 if not (r->>'passed')::boolean or (r->>'accuracy')::numeric<>90 then raise exception '90 percent rejected';end if;
 select count(*) into count_pass from public.rw_class_passes cp where cp.goal=goal_id and cp.student=student_id and cp.mode='writing';
 if count_pass<>20 then raise exception 'expected all twenty scope passes, got %',count_pass;end if;
 r:=public.rw_classroom('resume',jsonb_build_object('session',s->>'id'));if r->'final_result'->>'passed'<>'true' then raise exception 'resume lost final result';end if;
 -- Remaining selection, mode isolation and ownership.
 s:=public.rw_classroom('begin',jsonb_build_object('id',gen_random_uuid(),'goal',goal_id,'mode','writing','revision',1,'size','custom','start',1,'end',25,'policy','sampling90'));
 if jsonb_array_length(s->'questions')<>5 then raise exception 'remaining under ten must all be tested';end if;
 s:=public.rw_classroom('begin',jsonb_build_object('id',gen_random_uuid(),'goal',goal_id,'mode','reading','revision',1,'size','20','policy','sampling90'));
 if jsonb_array_length(s->'questions')<>10 then raise exception 'reading progress contaminated';end if;
 perform set_config('request.jwt.claim.sub',teacher_id::text,true);
 bad:=false;begin perform public.rw_classroom('resume',jsonb_build_object('session',s->>'id'));exception when others then bad:=true;end;if not bad then raise exception 'other actor accessed';end if;
 -- A teacher can now create a short goal.
 r:=public.rw_classroom('set_goal',jsonb_build_object('cohort',cohort_name,'library',book,'start',1,'end',7,'revision',1));
end $$;
rollback;
select 'PASS sampling sizes 1/9/10/11/20/50, 80 fail/90 pass, whole-range credit, idempotency, sealed attempts, resume, mode and actor isolation, short goals; rolled back' as result;
