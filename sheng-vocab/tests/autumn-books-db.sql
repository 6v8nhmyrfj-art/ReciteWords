begin;
select set_config('request.jwt.claim.sub',(select user_id::text from public.rw_members where role='student' and password_changed limit 1),true);
set local role authenticated;
do $$
declare lib record; n int; refs jsonb;answers jsonb; result jsonb; idx int; entry record;
begin
 select count(*) into n from public.rw_library_catalog() c where c.title like '2026年秋季%';
 if n<>9 then raise exception 'student catalog missing books';end if;
 for lib in select id,words from public.rw_libraries where title like '2026年秋季%' and category='writing' loop
  refs:='[]';answers:='[]';
  for entry in select distinct on (w->>'kind') w,(ord-1)::int as idx from jsonb_array_elements(lib.words) with ordinality a(w,ord) order by w->>'kind',ord loop
   refs:=refs||jsonb_build_array(jsonb_build_object('task',lib.id,'index',entry.idx));
   answers:=answers||jsonb_build_array(jsonb_build_object('task',lib.id,'index',entry.idx,'choice',entry.w->>'en'));
  end loop;
  result:=public.rw_submit_review_batch(gen_random_uuid(),'autumn rollback verification',refs,answers);
  if not (result->>'passed')::boolean or (result->>'correct')::int<>3 then raise exception 'word/phrase/sentence dictation failed';end if;
  answers:=jsonb_set(answers,'{0,choice}','"wrong spelling"');
  result:=public.rw_submit_review_batch(gen_random_uuid(),'autumn rollback failure',refs,answers);
  if (result->>'passed')::boolean then raise exception 'wrong spelling passed';end if;
 end loop;
end $$;
rollback;
select 'PASS writing words/phrases/sentences, wrong spelling rejected, student access; all attempts rolled back' as result;
