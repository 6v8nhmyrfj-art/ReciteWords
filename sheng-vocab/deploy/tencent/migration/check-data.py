import subprocess,json,os
source=dict(os.environ,PGPASSFILE='/home/ubuntu/.recitewords-source.pgpass',PGCONNECT_TIMEOUT='20')
conn='host=aws-0-ap-south-1.pooler.supabase.com port=5432 dbname=postgres user=postgres.nnooeadfgsvbddrjwyan sslmode=require'
def query(sql,old=False):
 cmd=['psql',conn,'-X','-w','-At','-v','ON_ERROR_STOP=1','-c',sql] if old else ['sudo','docker','exec','rw-db','psql','-U','supabase_admin','-d','postgres','-At','-v','ON_ERROR_STOP=1','-c',sql]
 return subprocess.check_output(cmd,env=source,text=True).strip()
tables=query("select tablename from pg_tables where schemaname='public' and tablename like 'rw_%' order by tablename").splitlines()
results=[]
for t in ['auth.users','auth.identities']+['public.'+x for x in tables]:
 q="select json_build_object('n',count(*),'digest',md5(coalesce(string_agg(to_jsonb(t)::text,E'\\n' order by to_jsonb(t)::text),''))) from "+t+' t'
 a=json.loads(query(q,True));b=json.loads(query(q));results.append({'table':t,'source_count':a['n'],'target_count':b['n'],'equal':a==b})
print(json.dumps(results,indent=2))
