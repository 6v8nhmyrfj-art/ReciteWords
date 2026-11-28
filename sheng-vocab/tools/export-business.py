#!/usr/bin/env python3
"""Portable business-data export. Requires psql and standard PG* environment variables.
No credentials or exports belong in Git. This is not an Auth/schema backup.
"""
import argparse, datetime, json, os, pathlib, shutil, subprocess
LEGACY_TABLES=['rw_members','rw_libraries','rw_tasks','rw_bookshelf','rw_progress','rw_answers','rw_review_cards','rw_known_checks','rw_group_tests','rw_book_tests','rw_mastery_sessions']
V2_TABLES=LEGACY_TABLES+['rw_class_goals','rw_class_passes','rw_class_sessions','rw_class_events']
V3_TABLES=V2_TABLES+['rw_weekly_targets','rw_weekly_items','rw_weekly_checks']
V4_TABLES=V3_TABLES+['rw_oral_answers','rw_oral_usage','rw_daily_oral']
TABLES=V4_TABLES+['rw_pronunciation_sessions']
def validate(doc):
    expected=LEGACY_TABLES if doc.get('schema_version')==1 else V2_TABLES if doc.get('schema_version')==2 else V3_TABLES if doc.get('schema_version')==3 else V4_TABLES if doc.get('schema_version')==4 else TABLES
    if doc.get('schema_version') not in (1,2,3,4,5) or set(doc.get('tables',{}))!=set(expected):
        raise ValueError('Unsupported format or missing tables')
    members={r['user_id'] for r in doc['tables']['rw_members']}
    tasks={r['id'] for r in doc['tables']['rw_tasks']}
    libraries={r['id'] for r in doc['tables']['rw_libraries']}
    goals={r['id'] for r in doc['tables'].get('rw_class_goals',[])}
    sessions={r['id'] for r in doc['tables'].get('rw_class_sessions',[])}
    targets={r['id'] for r in doc['tables'].get('rw_weekly_targets',[])}
    items={r['id'] for r in doc['tables'].get('rw_weekly_items',[])}
    for name,rows in doc['tables'].items():
        if doc['counts'][name]!=len(rows):raise ValueError('Count mismatch: '+name)
        for row in rows:
            owner=row.get('student',row.get('user_id'))
            if owner and owner not in members:raise ValueError('Missing member: '+name)
            if name=='rw_progress' and row['task_id'] not in tasks:raise ValueError('Missing task')
            if row.get('created_by') and row['created_by'] not in members:raise ValueError('Missing creator')
            if row.get('actor') and row['actor'] not in members:raise ValueError('Missing actor')
            if name.startswith(('rw_class_','rw_weekly_')) and row.get('goal') and row['goal'] not in goals:raise ValueError('Missing classroom goal')
            if name=='rw_class_goals' and row['library'] not in libraries:raise ValueError('Missing classroom library')
            if name in ('rw_class_events','rw_oral_answers') and row.get('session') and row['session'] not in sessions:raise ValueError('Missing classroom session')
            if name=='rw_weekly_items' and row['target'] not in targets:raise ValueError('Missing weekly target')
            if name in ('rw_weekly_checks','rw_pronunciation_sessions') and row['item'] not in items:raise ValueError('Missing weekly item')
            if name=='rw_class_sessions' and row.get('weekly_item') and row['weekly_item'] not in items:raise ValueError('Missing session weekly item')
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
data=json.loads(r.stdout);doc={'schema_version':5,'exported_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'counts':{k:len(v) for k,v in data.items()},'tables':data}
validate(doc);target.parent.mkdir(parents=True,exist_ok=True)
fd=os.open(target,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
with os.fdopen(fd,'w') as out:json.dump(doc,out,ensure_ascii=False,indent=2)
print('Business export written and validated. Auth users/passwords, schema and storage require separate backups.')
