#!/usr/bin/env python3
"""Run on server after tests pass. Also supports rollback to a verified prior release."""
import argparse,pathlib,json,hashlib,os,re
p=argparse.ArgumentParser();p.add_argument('release');p.add_argument('--root',default='/opt/recitewords-web');a=p.parse_args()
assert re.fullmatch(r'[A-Za-z0-9_-]+',a.release),'Invalid release ID'
root=pathlib.Path(a.root).resolve();release=root/'releases'/a.release;m=json.loads((release/'manifest.json').read_text())
assert '.invalid' not in m['api'] and m['environment']!='staging-unconfigured','Backend not configured: refusing activation'
for name,digest in m['files'].items():
 assert pathlib.Path(name).name==name,'Invalid asset path'
 assert hashlib.sha256((release/'site'/name).read_bytes()).hexdigest()==digest,'Asset changed: '+name
current=root/'current';previous=root/'previous'
if current.is_symlink():
 old=current.resolve();tmp=root/'.previous-next';tmp.unlink(missing_ok=True);tmp.symlink_to(old);os.replace(tmp,previous)
tmp=root/'.current-next';tmp.unlink(missing_ok=True);tmp.symlink_to(release);os.replace(tmp,current)
print('Activated verified release:',a.release)
