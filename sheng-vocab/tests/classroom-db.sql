begin;
do $$
declare teacher_id uuid; learner uuid; other_id uuid; class_name text; book uuid; goal uuid; session jsonb; result jsonb; again jsonb; payload jsonb; answers jsonb; row_count int; rejected boolean;
begin
 select user_id into teacher_id from public.rw_members where role='teacher' limit 1;
 select user_id,cohort into learner,class_name from public.rw_members where role='student' and password_changed and cohort is not null limit 1;
 select user_id into other_id from public.rw_members where role='student' and user_id<>learner limit 1;
 select id into book from public.rw_libraries where jsonb_array_length(words)>=20 limit 1;
 if learner is null then raise exception 'test requires an existing changed-password student';end if;
 perform set_config('request.jwt.claim.sub',teacher_id::text,true);
 result:=public.rw_classroom('set_goal',jsonb_build_object('cohort',class_name,'library',book,'start',1,'end',20));goal:=(result->>'id')::uuid;
 perform set_config('request.jwt.claim.sub',learner::text,true);
 rejected:=false;begin perform public.rw_classroom('set_goal',jsonb_build_object('cohort',class_name,'library',book,'start',1,'end',20));exception when others then rejected:=true;end;if not rejected then raise exception 'student changed goal';end if;
 rejected:=false;begin perform public.rw_classroom('detail',jsonb_build_object('goal',goal,'student',other_id,'mode','reading'));exception when others then rejected:=true;end;if not rejected then raise exception 'student read other';end if;
 rejected:=false;begin perform public.rw_classroom('begin',jsonb_build_object('id',gen_random_uuid(),'goal',goal,'mode','reading','revision',1,'size','custom','start',1,'end',9));exception when others then rejected:=true;end;if not rejected then raise exception 'accepted range under 10';end if;
 session:=public.rw_classroom('begin',jsonb_build_object('id',gen_random_uuid(),'goal',goal,'mode','reading','revision',1,'size','10'));
 if jsonb_array_length(session->'questions')<>10 then raise exception 'wrong question count';end if;
 select jsonb_agg(q->'word'->>'en' order by ord) into answers from jsonb_array_elements(session->'questions') with ordinality t(q,ord) where ord<=5;
 payload:=jsonb_build_object('id',gen_random_uuid(),'session',session->>'id','offset',0,'answers',jsonb_set(answers,'{0}','""'));
 result:=public.rw_classroom('submit',payload);if (result->>'passed')::boolean then raise exception 'wrong answers passed';end if;
 if exists(select 1 from public.rw_class_passes r where r.student=learner and r.goal=(session->>'goal')::uuid) then raise exception 'failed batch awarded';end if;
 perform set_config('request.jwt.claim.sub',teacher_id::text,true);
 perform public.rw_classroom('mark',jsonb_build_object('id',gen_random_uuid(),'goal',goal,'student',learner,'mode','reading','revision',1,'indices',jsonb_build_array((session->'questions'->0->>'index')::int)));
 perform set_config('request.jwt.claim.sub',learner::text,true);
 payload:=jsonb_build_object('id',gen_random_uuid(),'session',session->>'id','offset',0,'answers',answers);
 result:=public.rw_classroom('submit',payload);again:=public.rw_classroom('submit',payload);
 if result<>again or not (result->>'passed')::boolean then raise exception 'idempotency failed';end if;
 if exists(select 1 from public.rw_class_passes r where r.student=learner and r.goal=(session->>'goal')::uuid and r.source='teacher') then raise exception 'verified pass should upgrade manual recognition';end if;
 if (select count(*) from public.rw_class_passes r where r.student=learner and r.goal=(session->>'goal')::uuid)<>5 then raise exception 'must grant only 5';end if;
 rejected:=false;begin perform public.rw_classroom('mark',jsonb_build_object('id',gen_random_uuid(),'goal',goal,'mode','reading','revision',1,'indices','[1]'::jsonb));exception when others then rejected:=true;end;if not rejected then raise exception 'student self-certified';end if;
 perform set_config('request.jwt.claim.sub',teacher_id::text,true);
 result:=public.rw_classroom('mark',jsonb_build_object('id',gen_random_uuid(),'goal',goal,'student',learner,'mode','writing','revision',1,'indices','[1,2]'::jsonb));if (result->>'changed')::int<>2 then raise exception 'teacher mark failed';end if;
 result:=public.rw_classroom('unmark',jsonb_build_object('id',gen_random_uuid(),'goal',goal,'student',learner,'mode','writing','revision',1,'indices','[1]'::jsonb));if (result->>'changed')::int<>1 then raise exception 'teacher undo failed';end if;
 result:=public.rw_classroom('detail',jsonb_build_object('goal',goal,'student',learner,'mode','writing'));if jsonb_array_length(result->'passes')<>1 then raise exception 'mode isolation failed';end if;

 -- With only two pending words, a 50-word request tests exactly those two.
 perform public.rw_classroom('mark',jsonb_build_object('id',gen_random_uuid(),'goal',goal,'student',learner,'mode','writing','revision',1,'indices',(select jsonb_agg(i) from generate_series(1,18)i)));
 perform set_config('request.jwt.claim.sub',learner::text,true);
 result:=public.rw_classroom('begin',jsonb_build_object('id',gen_random_uuid(),'goal',goal,'mode','writing','revision',1,'size','50'));
 if jsonb_array_length(result->'questions')<>2 then raise exception 'tail must contain only 2 pending words';end if;
 select jsonb_agg(upper('  '||(q->'word'->>'en')||'  ') order by ord) into answers from jsonb_array_elements(result->'questions') with ordinality t(q,ord);
 again:=public.rw_classroom('submit',jsonb_build_object('id',gen_random_uuid(),'session',result->>'id','offset',0,'answers',answers));
 if not (again->>'passed')::boolean or not (again->>'complete')::boolean then raise exception 'tail or writing normalization failed';end if;
 perform set_config('request.jwt.claim.sub',teacher_id::text,true);
 -- Changing range rejects stale unfinished sessions without rewriting old passes.
 perform public.rw_classroom('set_goal',jsonb_build_object('cohort',class_name,'library',book,'start',2,'end',20,'revision',1));
 perform set_config('request.jwt.claim.sub',learner::text,true);
 rejected:=false;begin perform public.rw_classroom('resume',jsonb_build_object('session',session->>'id'));exception when others then rejected:=true;end;if not rejected then raise exception 'stale session accepted';end if;
 if has_table_privilege('authenticated','public.rw_class_passes','INSERT') or has_table_privilege('anon','public.rw_class_passes','SELECT') or has_function_privilege('anon','public.rw_classroom(text,jsonb)','EXECUTE') then raise exception 'unexpected grants';end if;
end $$;
rollback;
begin;
select set_config('request.jwt.claim.sub',(select user_id::text from public.rw_members where role='teacher' limit 1),true);
set local role authenticated;
select public.rw_classroom('catalog')->>'role' as authenticated_role;
rollback;
select 'PASS range, role isolation, grading, idempotency, per-mode progress, manual mark/undo, stale revision, table grants; all fixtures rolled back' as result;