-- Classroom progress is separate from self-study group-test statistics.
create or replace function rw_private.class_progress(p_student uuid,p_page int) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();who public.rw_members; target uuid;result jsonb;
begin
 select * into who from public.rw_members where user_id=u;
 if u is null or who.user_id is null or who.role not in ('teacher','student') then raise exception '请先登录';end if;
 if who.role='teacher' and p_student is null then
  select jsonb_build_object('students',coalesce(jsonb_agg(to_jsonb(x)),'[]')) into result from (
   select m.user_id,m.display_name,m.cohort,count(distinct rw_private.mastery_norm(g.words->(r.word_index-1)->>'en')) as total,
   count(distinct rw_private.mastery_norm(g.words->(r.word_index-1)->>'en')) filter(where r.mode='reading') as reading,
   count(distinct rw_private.mastery_norm(g.words->(r.word_index-1)->>'en')) filter(where r.mode='writing') as writing
   from public.rw_members m left join public.rw_class_passes r on r.student=m.user_id left join public.rw_class_goals g on g.id=r.goal
   where m.role='student' group by m.user_id,m.display_name,m.cohort order by m.cohort,m.display_name
  ) x;return result;
 end if;
 target:=coalesce(p_student,u);
 if who.role<>'teacher' and target<>u then raise exception '只能查看自己的过关记录';end if;
 if not exists(select 1 from public.rw_members where user_id=target and role='student') then raise exception '学生不存在';end if;
 if p_page is null or p_page<0 or p_page>100000 then raise exception '页码无效';end if;
 with records as (
  select r.*,g.library,g.title,g.words->(r.word_index-1)->>'en' as word,g.words->(r.word_index-1)->>'zh' as meaning,
  rw_private.mastery_norm(g.words->(r.word_index-1)->>'en') as word_key
  from public.rw_class_passes r join public.rw_class_goals g on g.id=r.goal where r.student=target
 ), books as (
  select library,title,mode,count(distinct word_key) as passed,max(passed_at) as latest from records group by library,title,mode
 ), recent as (select word,meaning,title,mode,source,passed_at from records order by passed_at desc,goal,mode,word_index limit 10 offset p_page*10)
 select jsonb_build_object('total',count(distinct word_key),'reading',count(distinct word_key) filter(where mode='reading'),
 'writing',count(distinct word_key) filter(where mode='writing'),'teacher',count(distinct word_key) filter(where source='teacher'),
 'record_count',count(*),'page',p_page,'books',(select coalesce(jsonb_agg(to_jsonb(b) order by latest desc),'[]') from books b),
 'records',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from recent x)) into result from records;
 return result;
end $$;
revoke all on function rw_private.class_progress(uuid,int) from public,anon,authenticated;
grant execute on function rw_private.class_progress(uuid,int) to authenticated;
create or replace function public.rw_class_progress(p_student uuid default null,p_page int default 0) returns jsonb
language sql security invoker set search_path='' as $$select rw_private.class_progress(p_student,p_page)$$;
revoke all on function public.rw_class_progress(uuid,int) from public,anon;
grant execute on function public.rw_class_progress(uuid,int) to authenticated;
