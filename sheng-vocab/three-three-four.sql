CREATE OR REPLACE FUNCTION public.rw_submit_five(p_id uuid, p_title text, p_group jsonb, p_answers jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare uid uuid:=auth.uid(); grp text; prior public.rw_group_tests; a jsonb; w jsonb; k text;
 refs jsonb:='[]'; seen text[]:='{}'; n int:=0; ok boolean; t uuid; idx int;
begin
 select cohort into grp from public.rw_members where user_id=uid and role='student' and password_changed;
 if not found then raise exception 'student required';end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 select * into prior from public.rw_group_tests where id=p_id and student=uid;
 if found then return jsonb_build_object('correct',prior.correct,'passed',prior.correct>=5,'answers',prior.answers);end if;
 if p_answers is null or jsonb_typeof(p_answers)<>'array' or jsonb_array_length(p_answers)<>5 then raise exception 'exactly five questions required';end if;
 if p_title is null or length(p_title)>200 then raise exception 'invalid title';end if;
 if p_group is null or jsonb_typeof(p_group)<>'array' or jsonb_array_length(p_group)<>10 then raise exception 'ten learning words required';end if;
 for a in select value from jsonb_array_elements(p_group) loop
 t:=(a->>'task')::uuid;idx:=(a->>'index')::integer;
 if idx is null or idx<0 then raise exception 'invalid index';end if;
 if t is not null then select words->idx into w from public.rw_tasks where id=t and (cohort is null or cohort=grp);
 if w is null then select words->idx into w from public.rw_libraries where id=t;end if;
 else w:='[{"en":"discover","zh":"发现；发觉"},{"en":"balloon","zh":"气球"},{"en":"wheel","zh":"轮子"},{"en":"central","zh":"中心的"},{"en":"although","zh":"虽然；尽管"},{"en":"attach","zh":"系上；连接"},{"en":"pull","zh":"拉；拖"},{"en":"international","zh":"国际的"},{"en":"path","zh":"小路；路径"},{"en":"technique","zh":"技术；技巧"},{"en":"depend","zh":"依靠；取决于"},{"en":"describe","zh":"描述"},{"en":"decide","zh":"决定"},{"en":"develop","zh":"发展；培养"},{"en":"practice","zh":"练习"},{"en":"improve","zh":"提高；改善"},{"en":"knowledge","zh":"知识"},{"en":"journey","zh":"旅程"},{"en":"prepare","zh":"准备"},{"en":"remember","zh":"记住"}]'::jsonb->idx;end if;

 k:=lower(trim(w->>'en'));
 if k is null or k=any(seen) then raise exception 'invalid learning group';end if;
 seen:=array_append(seen,k);
 end loop;
 seen:='{}';
 for a in select value from jsonb_array_elements(p_answers) loop
 if not exists(select 1 from jsonb_array_elements(p_group) g where g->>'task' is not distinct from a->>'task' and g->>'index'=a->>'index') then raise exception 'answer outside group';end if;
 t:=(a->>'task')::uuid;idx:=(a->>'index')::integer;
 if idx is null or idx<0 then raise exception 'invalid index';end if;
 if t is not null then select words->idx into w from public.rw_tasks where id=t and (cohort is null or cohort=grp);
 if w is null then select words->idx into w from public.rw_libraries where id=t;end if;
 else w:='[{"en":"discover","zh":"发现；发觉"},{"en":"balloon","zh":"气球"},{"en":"wheel","zh":"轮子"},{"en":"central","zh":"中心的"},{"en":"although","zh":"虽然；尽管"},{"en":"attach","zh":"系上；连接"},{"en":"pull","zh":"拉；拖"},{"en":"international","zh":"国际的"},{"en":"path","zh":"小路；路径"},{"en":"technique","zh":"技术；技巧"},{"en":"depend","zh":"依靠；取决于"},{"en":"describe","zh":"描述"},{"en":"decide","zh":"决定"},{"en":"develop","zh":"发展；培养"},{"en":"practice","zh":"练习"},{"en":"improve","zh":"提高；改善"},{"en":"knowledge","zh":"知识"},{"en":"journey","zh":"旅程"},{"en":"prepare","zh":"准备"},{"en":"remember","zh":"记住"}]'::jsonb->idx;end if;
 k:=lower(trim(w->>'en'));
 if k is null or k=any(seen) or a->>'choice' is null or length(a->>'choice')>300 then raise exception 'invalid or duplicate word';end if;
 seen:=array_append(seen,k);
 ok:=public.rw_practice(gen_random_uuid(),'quiz',t,idx,k,a->>'choice');
 if ok then n:=n+1;end if;
 refs:=refs||jsonb_build_array(jsonb_build_object('task',t,'index',idx,'word',k,'correct',ok));
 end loop;
 insert into public.rw_group_tests values(p_id,uid,p_title,now(),refs,n);
 if n>=5 then
 for a in select value from jsonb_array_elements(p_group) loop
 if a->>'task' is not null and exists(select 1 from public.rw_tasks where id=(a->>'task')::uuid and (cohort is null or cohort=grp)) then insert into public.rw_progress(user_id,task_id,word_index) values(uid,(a->>'task')::uuid,(a->>'index')::integer) on conflict do nothing;end if;
 end loop;
 end if;
 return jsonb_build_object('correct',n,'passed',n>=5,'answers',refs);
end $function$
;
revoke all on function public.rw_submit_five(uuid,text,jsonb,jsonb) from public,anon;
grant execute on function public.rw_submit_five(uuid,text,jsonb,jsonb) to authenticated;
