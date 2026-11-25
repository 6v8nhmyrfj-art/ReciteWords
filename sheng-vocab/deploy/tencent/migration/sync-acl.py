# Copy object privileges from the source catalog, not provider defaults.
exec(open('/home/ubuntu/recitewords-selfhost/config/check-data.py').read().split('tables=query')[0])
catalog="""
with objs as (
 select 'TABLE' kind,format('%I.%I',n.nspname,c.relname) name,c.relowner owner,coalesce(c.relacl,acldefault('r',c.relowner)) acl
 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','auth','rw_private') and c.relkind in ('r','p','v','m')
 union all select 'SEQUENCE',format('%I.%I',n.nspname,c.relname),c.relowner,coalesce(c.relacl,acldefault('S',c.relowner))
 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','auth','rw_private') and c.relkind='S'
 union all select 'FUNCTION',format('%I.%I(%s)',n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)),p.proowner,coalesce(p.proacl,acldefault('f',p.proowner))
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','auth','rw_private') and p.prokind='f'
 union all select 'SCHEMA',quote_ident(n.nspname),n.nspowner,coalesce(n.nspacl,acldefault('n',n.nspowner)) from pg_namespace n where n.nspname in ('public','auth','rw_private')
)
select coalesce(json_agg(json_build_object('kind',o.kind,'name',o.name,'role',case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end,'privilege',a.privilege_type,'grantable',a.is_grantable) order by o.kind,o.name,a.grantee,a.privilege_type),'[]') from objs o cross join lateral aclexplode(o.acl) a
"""
a=json.loads(query(catalog,True));b=json.loads(query(catalog))
source_objects={(x['kind'],x['name']) for x in a}
revokes=sorted({(x['kind'],x['name'],x['role']) for x in b if (x['kind'],x['name']) in source_objects})
sql='BEGIN;\n'+'\n'.join('REVOKE ALL PRIVILEGES ON '+k+' '+n+' FROM '+r+' CASCADE;' for k,n,r in revokes)+'\n'
sql+='\n'.join('GRANT '+x['privilege']+' ON '+x['kind']+' '+x['name']+' TO '+x['role']+(' WITH GRANT OPTION' if x['grantable'] else '')+';' for x in a)+'\nCOMMIT;'
cols_query="""select coalesce(json_agg(json_build_object('table',format('%I.%I',n.nspname,c.relname),'column',quote_ident(at.attname),'role',case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end,'privilege',a.privilege_type,'grantable',a.is_grantable)),'[]') from pg_attribute at join pg_class c on c.oid=at.attrelid join pg_namespace n on n.oid=c.relnamespace cross join lateral aclexplode(at.attacl) a where n.nspname in ('public','auth','rw_private') and at.attnum>0 and not at.attisdropped"""
cols=json.loads(query(cols_query,True))
colsql='\n'.join('GRANT '+x['privilege']+' ('+x['column']+') ON TABLE '+x['table']+' TO '+x['role']+(' WITH GRANT OPTION' if x['grantable'] else '')+';' for x in cols)
sql=sql.replace('\nCOMMIT;','\n'+colsql+'\nCOMMIT;')

# Never modify source. Apply only to the isolated rw-db container.
p=subprocess.run(['sudo','docker','exec','-i','rw-db','psql','-U','supabase_admin','-d','postgres','-v','ON_ERROR_STOP=1'],input=sql,text=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
if p.returncode:print(p.stderr);raise SystemExit(p.returncode)
new=json.loads(query(catalog))
canon=lambda rows:{(x['kind'],x['name'],x['role'],x['privilege'],x['grantable']) for x in rows if (x['kind'],x['name']) in source_objects}
assert canon(a)==canon(new),'Privilege comparison failed'
print('Exact source object privileges applied and verified:',len(source_objects),'objects')

assert {json.dumps(x,sort_keys=True) for x in cols}=={json.dumps(x,sort_keys=True) for x in json.loads(query(cols_query))},'Column privileges differ'
print('Column privileges verified:',len(cols))
