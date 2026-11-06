create or replace function public.rw_passed_periods()
returns jsonb language sql stable security invoker set search_path='' as $$
with clock as (
 select now() as instant,now() at time zone 'Asia/Shanghai' as local_now
), periods as (
 select p,date_trunc(p,local_now) as starts,local_now,instant,
 date_trunc(p,local_now)+case p when 'day' then interval '1 day' when 'week' then interval '7 days' when 'month' then interval '1 month' else interval '1 year' end as ends,
 case p when 'day' then interval '1 hour' when 'year' then interval '1 month' else interval '1 day' end as step
 from clock cross join (values('day'),('week'),('month'),('year')) v(p)
), events as (
 select lower(regexp_replace(trim(a->>'word'),'\s+',' ','g')) as word,t.at
 from public.rw_group_tests t cross join lateral jsonb_array_elements(t.answers) a
 where t.student=auth.uid() and jsonb_array_length(t.answers)>0
 and t.correct::numeric/nullif(jsonb_array_length(t.answers),0)>=0.9
 and a->>'correct'='true'
 and t.at>=((select min(starts) from periods) at time zone 'Asia/Shanghai')
 and t.at<=(select instant from clock)
), first_pass as (
 select p,word,min(at at time zone 'Asia/Shanghai') as first_at
 from periods join events on at>=(starts at time zone 'Asia/Shanghai')
 where word is not null and word<>'' group by p,word
), buckets as (
 select p,starts,ends,local_now,step,generate_series(starts,ends-step,step) as bucket_at from periods
), points as (
 select b.p,b.starts,b.ends,b.local_now,b.bucket_at,
 case when b.bucket_at>b.local_now then null else count(f.word) end as total
 from buckets b left join first_pass f on f.p=b.p and f.first_at>=b.bucket_at and f.first_at<b.bucket_at+b.step
 group by b.p,b.starts,b.ends,b.local_now,b.bucket_at
), series as (
 select p,jsonb_build_object('start',min(starts)::date,'end',(max(ends)-interval '1 day')::date,'asOf',max(local_now)::date,
 'total',coalesce(sum(total),0),
 'points',jsonb_agg(jsonb_build_object('day',to_char(bucket_at,'YYYY-MM-DD"T"HH24:MI:SS'),'total',total) order by bucket_at)) data
 from points group by p
) select jsonb_object_agg(p,data) from series
$$;
revoke all on function public.rw_passed_periods() from public,anon;
grant execute on function public.rw_passed_periods() to authenticated;
