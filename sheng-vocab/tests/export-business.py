import ast,pathlib,json,tempfile,subprocess,sys
source=pathlib.Path('tools/export-business.py').read_text();tree=ast.parse(source);prefix=source[:source.index('parser=argparse.ArgumentParser()')];ns={};exec(prefix,ns)
for version,key in [(1,'LEGACY_TABLES'),(2,'V2_TABLES'),(3,'V3_TABLES'),(4,'TABLES')]:
 tables={t:[] for t in ns[key]};doc={'schema_version':version,'tables':tables,'counts':{t:0 for t in tables}};ns['validate'](doc)
assert len(ns['TABLES'])==21
x={'schema_version':4,'tables':{t:[] for t in ns['TABLES']},'counts':{t:0 for t in ns['TABLES']}}
x['tables']['rw_oral_answers']=[{'actor':'missing','session':'missing'}];x['counts']['rw_oral_answers']=1
try:ns['validate'](x);raise AssertionError('orphan accepted')
except ValueError:pass
print('PASS v1-v4 formats, 21-table coverage, orphan rejection')
