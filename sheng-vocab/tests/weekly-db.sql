begin;
do $$
#variable_conflict use_variable
declare tid uuid;sid uuid;cohort_name text;lib uuid;gid uuid;target uuid:=gen_random_uuid();data jsonb;s jsonb;answers jsonb;r jsonb;item uuid;payload jsonb;reject boolean;wk date:=date_trunc('week',(now() at time zone 'Asia/Shanghai')::date)::date;
begin
 select user_id into tid from public.rw_members where role='teacher' limit 1;
 select user_id,cohort into sid,cohort_name from public.rw_members where role='student' and password_changed and cohort is not null limit 1;
 insert into public.rw_libraries(title,words) values('weekly rollback fixture',(select jsonb_agg(jsonb_build_object('en','word'||i,'zh','释义'||i,'pos','n.')) from generate_series(1,10)i)) returning id into lib;
 perform set_config('request.jwt.claim.sub',tid::text,true);
 gid:=(public.rw_classroom('set_goal',jsonb_build_object('cohort',cohort_name,'library',lib,'start',1,'end',10))->>'id')::uuid;
 payload:=jsonb_build_object('id',target,'goal',gid,'week',wk,'kind','review','mode','reading','start',1,'end',10);
 perform public.rw_weekly('publish',payload);perform public.rw_weekly('publish',payload);
 r:=public.rw_weekly('publish',jsonb_set(payload,'{id}',to_jsonb(gen_random_uuid()::text)));
 if r->>'id'<>target::text then raise exception 'duplicate publish with fresh id';end if;
 if (select count(*) from public.rw_weekly_items where rw_weekly_items.target=target)<>5 then raise exception 'not five or duplicate';end if;
 -- Historical classroom passes must not credit this week's review.
 perform public.rw_classroom('mark',jsonb_build_object('id',gen_random_uuid(),'goal',gid,'student',sid,'mode','reading','revision',1,'indices','[1,2,3,4,5,6,7,8,9,10]'::jsonb));
 perform set_config('request.jwt.claim.sub',sid::text,true);
 reject:=false;begin perform public.rw_weekly('publish',payload);exception when others then reject:=true;end;if not reject then raise exception 'student published';end if;
 data:=public.rw_weekly('list','{}');
 select id into item from public.rw_weekly_items where rw_weekly_items.target=target order by due_date limit 1;
 s:=public.rw_weekly('begin',jsonb_build_object('id',gen_random_uuid(),'item',item));
 if jsonb_array_length(s->'questions')<>2 then raise exception 'review inherited classroom passes or wrong tail';end if;
 select jsonb_agg(q->'word'->>'en' order by ord) into answers from jsonb_array_elements(s->'questions') with ordinality t(q,ord);
 payload:=jsonb_build_object('id',gen_random_uuid(),'session',s->>'id','offset',0,'answers','["",""]'::jsonb);
 perform public.rw_classroom('submit',payload);
 if exists(select 1 from public.rw_weekly_checks c where c.item=item) then raise exception 'wrong answers credited';end if;
 payload:=jsonb_build_object('id',gen_random_uuid(),'session',s->>'id','offset',0,'answers',answers);
 r:=public.rw_classroom('submit',payload);perform public.rw_classroom('submit',payload);
 if (select count(*) from public.rw_weekly_checks c where c.item=item)<>2 then raise exception 'completion missing or duplicate';end if;
 data:=public.rw_weekly('list','{}');
 if not exists(select 1 from jsonb_array_elements(data->'items')i where i->>'id'=item::text and (i->>'done')::int=2) then raise exception 'list did not refresh credit';end if;
 perform set_config('request.jwt.claim.sub',tid::text,true);
 target:=gen_random_uuid();perform public.rw_weekly('publish',jsonb_build_object('id',target,'goal',gid,'week',wk+7,'kind','transform','mode','writing','start',1,'end',10));
 select id into item from public.rw_weekly_items where rw_weekly_items.target=target order by due_date limit 1;
 perform set_config('request.jwt.claim.sub',sid::text,true);
 reject:=false;begin perform public.rw_weekly('begin',jsonb_build_object('id',gen_random_uuid(),'item',item));exception when others then reject:=true;end;if not reject then raise exception 'future unlocked';end if;
 if has_table_privilege('authenticated','public.rw_weekly_checks','INSERT') or has_function_privilege('anon','public.rw_weekly(text,jsonb)','EXECUTE') then raise exception 'bad grants';end if;
end $$;
rollback;
select 'PASS weekly publish/5-day partition/idempotency/student permissions/fresh review/server completion/retry/future lock; rolled back' as result;
