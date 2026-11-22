begin;
do $$
declare t uuid;u uuid;c text;b uuid;g uuid;s jsonb;r jsonb;a uuid:=gen_random_uuid();bad boolean;
begin
 select user_id into t from public.rw_members where role='teacher' limit 1;
 select user_id,cohort into u,c from public.rw_members where role='student' and password_changed and cohort is not null limit 1;
 insert into public.rw_libraries(title,words) values('oral rollback fixture','[{"en":"improve","zh":"提高","example":"I improve my English."}]') returning id into b;
 perform set_config('request.jwt.claim.sub',t::text,true);
 g:=(public.rw_classroom('set_goal',jsonb_build_object('cohort',c,'library',b,'start',1,'end',1))->>'id')::uuid;
 perform set_config('request.jwt.claim.sub',u::text,true);
 s:=public.rw_classroom('begin',jsonb_build_object('id',gen_random_uuid(),'goal',g,'mode','reading','revision',1,'size','10','policy','sampling90','response_mode','oral'));
 if s->>'response_mode'<>'oral' then raise exception 'oral not enabled';end if;
 insert into public.rw_oral_answers(id,session,actor,question_index,transcript) values(a,(s->>'id')::uuid,u,1,'改善');
 bad:=false;begin perform public.rw_classroom('submit',jsonb_build_object('id',gen_random_uuid(),'session',s->>'id','offset',0,'answers',jsonb_build_array('oral:'||a)));exception when others then bad:=true;end;if not bad then raise exception 'ungraded accepted';end if;
 update public.rw_oral_answers set verdict='uncertain' where id=a;
 bad:=false;begin perform public.rw_classroom('submit',jsonb_build_object('id',gen_random_uuid(),'session',s->>'id','offset',0,'answers',jsonb_build_array('oral:'||a)));exception when others then bad:=true;end;if not bad then raise exception 'uncertain accepted';end if;
 update public.rw_oral_answers set verdict='correct',actor=t where id=a;
 bad:=false;begin perform public.rw_classroom('submit',jsonb_build_object('id',gen_random_uuid(),'session',s->>'id','offset',0,'answers',jsonb_build_array('oral:'||a)));exception when others then bad:=true;end;if not bad then raise exception 'other actor accepted';end if;
 update public.rw_oral_answers set actor=u where id=a;
 r:=public.rw_classroom('submit',jsonb_build_object('id',gen_random_uuid(),'session',s->>'id','offset',0,'answers',jsonb_build_array('oral:'||a)));
 if r->>'passed'<>'true' or r->'results'->0->>'response'<>'改善' then raise exception 'verified answer not counted';end if;
 if has_table_privilege('authenticated','public.rw_oral_answers','INSERT') then raise exception 'client can forge grades';end if;
end $$;
rollback;
