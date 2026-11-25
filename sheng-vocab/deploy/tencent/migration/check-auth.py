exec(open('/home/ubuntu/recitewords-selfhost/config/check-data.py').read().split('tables=query')[0])
q='select json_agg(to_jsonb(u) order by id) from auth.users u'
a={x['id']:x for x in json.loads(query(q,True))};b={x['id']:x for x in json.loads(query(q))}
from collections import Counter
changed=Counter(k for i in a for k in set(a[i])|set(b[i]) if a[i].get(k)!=b[i].get(k))
print({'ids_equal':a.keys()==b.keys(),'password_hashes_equal':all(a[i]['encrypted_password']==b[i]['encrypted_password'] for i in a),'changed_fields':dict(changed),'extra_target_columns':sorted(set(next(iter(b.values())))-set(next(iter(a.values()))))})
