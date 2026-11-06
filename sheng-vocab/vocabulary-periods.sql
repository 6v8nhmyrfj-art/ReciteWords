create or replace function public.rw_vocabulary_periods()
returns jsonb language sql stable security invoker set search_path='' as $$
with clock as (
 select now() as instant,now() at time zone 'Asia/Shanghai' as local_now
), periods as (
 select p, date_trunc(p,local_now)::date as start_day,local_now::date as today,instant
 from clock cross join (values('week'),('month'),('year')) v(p)
), events as (
 select lower(regexp_replace(trim(word),'\s+',' ','g')) word,at
 from public.rw_answers
 where student=auth.uid() and correct and at>=((select min(start_day)::timestamp from periods) at time zone 'Asia/Shanghai')
 union all
 select lower(regexp_replace(trim(a->>'word'),'\s+',' ','g')),b.at
 from public.rw_book_tests b cross join lateral jsonb_array_elements(b.answers) a
 where b.student=auth.uid() and a->>'correct'='true'
 and b.at>=((select min(start_day)::timestamp from periods) at time zone 'Asia/Shanghai')
), first_answers as (
 select p,word,min((at at time zone 'Asia/Shanghai')::date) first_day
 from periods join events on at>=start_day::timestamp at time zone 'Asia/Shanghai' and at<=instant
 where word is not null and word<>'' group by p,word
), buckets as (
 select p,start_day,today,generate_series(start_day::timestamp,
 case when p='year' then date_trunc('month',today::timestamp) else today::timestamp end,
 case when p='year' then interval '1 month' else interval '1 day' end)::date as bucket_day
 from periods
), points as (
 select b.p,b.start_day,b.today,b.bucket_day,count(f.word) total
 from buckets b left join first_answers f on f.p=b.p and
 f.first_day<=case when b.p='year' then least(b.today,(b.bucket_day+interval '1 month'-interval '1 day')::date) else b.bucket_day end
 group by b.p,b.start_day,b.today,b.bucket_day
), series as (
 select p,jsonb_build_object('start',min(start_day),'end',max(today),'total',max(total),
 'points',jsonb_agg(jsonb_build_object('day',bucket_day,'total',total) order by bucket_day)) data
 from points group by p
) select jsonb_object_agg(p,data) from series
$$;
revoke all on function public.rw_vocabulary_periods() from public,anon;
grant execute on function public.rw_vocabulary_periods() to authenticated;
