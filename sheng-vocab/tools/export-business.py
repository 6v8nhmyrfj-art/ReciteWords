#!/usr/bin/env python3
"""Portable business-data export. Requires psql and standard PG* environment variables.
No credentials or exports belong in Git. This is not an Auth/schema backup.
"""
import argparse, datetime, json, os, pathlib, shutil, subprocess
TABLES=['rw_members','rw_libraries','rw_tasks','rw_bookshelf','rw_progress','rw_answers','rw_review_cards','rw_known_checks','rw_group_tests','rw_book_tests','rw_mastery_sessions']
def validate(doc):
    if doc.get('schema_version')!=1 or set(doc.get('tables',{}))!=set(TABLES):
        raise ValueError('Unsupported format or missing tables')
    members={r['user_id'] for r in doc['tables']['rw_members']}
    tasks={r['id'] for r in doc['tables']['rw_tasks']}
    libraries={r['id'] for r in doc['tables']['rw_libraries']}
    for name,rows in doc['tables'].items():
        if doc['counts'][name]!=len(rows):raise ValueError('Count mismatch: '+name)
        for row in rows:
            owner=row.get('student',row.get('user_id'))
            if owner and owner not in members:raise ValueError('Missing member: '+name)
            if name=='rw_progress' and row['task_id'] not in tasks:raise ValueError('Missing task')
            if name=='rw_bookshelf' and row['library'] not in libraries:raise ValueError('Missing library')
    return doc
parser=argparse.ArgumentParser();parser.add_argument('--output');parser.add_argument('--validate');args=parser.parse_args()
if args.validate:
    validate(json.loads(pathlib.Path(args.validate).read_text()));print('Format, counts and business relations valid');raise SystemExit()
if not args.output:parser.error('--output or --validate required')
if not shutil.which('psql'):parser.error('Install PostgreSQL client tools; configure PGHOST/PGPORT/PGDATABASE/PGUSER and PGPASSFILE')
target=pathlib.Path(args.output)
if target.exists():parser.error('Output already exists; choose a new backup filename')
pairs=','.join("'%s',coalesce((select jsonb_agg(to_jsonb(r)) from public.%s r),'[]'::jsonb)"%(t,t) for t in TABLES)
sql="begin transaction isolation level repeatable read read only; select jsonb_build_object("+pairs+"); rollback;"
r=subprocess.run(['psql','-X','-q','-t','-A','-v','ON_ERROR_STOP=1'],input=sql,text=True,capture_output=True)
if r.returncode:raise SystemExit('Database export failed; check connection/permissions with psql (no credentials printed).')
data=json.loads(r.stdout);doc={'schema_version':1,'exported_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'counts':{k:len(v) for k,v in data.items()},'tables':data}
validate(doc);target.parent.mkdir(parents=True,exist_ok=True)
fd=os.open(target,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
with os.fdopen(fd,'w') as out:json.dump(doc,out,ensure_ascii=False,indent=2)
print('Business export written and validated. Auth users/passwords, schema and storage require separate backups.')
