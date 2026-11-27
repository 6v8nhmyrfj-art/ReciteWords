#!/usr/bin/env python3
"""Build a static-only release. API configuration must be supplied explicitly."""
import argparse,pathlib,json,re,hashlib,shutil,tarfile,base64,html
p=argparse.ArgumentParser();p.add_argument('--config',required=True);p.add_argument('--output',required=True);a=p.parse_args()
root=pathlib.Path(__file__).resolve().parents[2];out=pathlib.Path(a.output).resolve();cfg=json.loads(pathlib.Path(a.config).read_text())
for k in ('baseUrl','publishableKey','environment'):assert isinstance(cfg.get(k),str) and cfg[k],k+' required'
assert cfg['baseUrl'].startswith('https://'),'HTTPS required'
assert 'service_role' not in json.dumps(cfg) and not cfg['publishableKey'].startswith('sb_secret_'),'Public key only'
if cfg['publishableKey'].startswith('eyJ'):
 payload=cfg['publishableKey'].split('.')[1]
 assert json.loads(base64.urlsafe_b64decode(payload+'='*(-len(payload)%4))).get('role')=='anon','Only anon JWT keys may be published'
assert not out.exists(),'Choose a new output directory'
out.mkdir(parents=True);site=out/'site';site.mkdir()
for f in root.iterdir():
 if f.name=='index.html' or f.suffix in ('.mjs','.css'):shutil.copy2(f,site/f.name)
(site/'backend-config.mjs').write_text('export const backendConfig=Object.freeze('+json.dumps({'provider':'supabase','contractVersion':1,'oralEnabled':True,**cfg},ensure_ascii=False)+');\n')
if cfg.get('deploymentLabel'):
 label=html.escape(cfg['deploymentLabel'])
 entry=site/'index.html'
 entry.write_text(entry.read_text().replace('<title>', '<style>html::before{content:attr(data-deployment);position:fixed;top:0;left:0;right:0;z-index:10000;padding:5px;background:#fff1cf;color:#62460a;text-align:center;font:12px sans-serif;pointer-events:none}body{padding-top:26px!important}.cr-root{top:26px!important}</style><title>',1).replace('<html lang="zh-CN">','<html lang="zh-CN" data-deployment="'+label+'">',1))
# Validate referenced local modules and styles, including lazy imports.
for f in site.iterdir():
 if f.suffix not in ('.html','.mjs','.css'):continue
 for ref in re.findall(r'''["'](?:\./)?([\w./-]+\.(?:mjs|js|css|json|svg|mp3|png))(?:\?[^"']*)?["']''',f.read_text()):
  assert (site/ref).is_file(),f'{f.name}: missing {ref}'
manifest={'format':1,'environment':cfg['environment'],'api':cfg['baseUrl'],'files':{f.name:hashlib.sha256(f.read_bytes()).hexdigest() for f in sorted(site.iterdir())}}
(out/'manifest.json').write_text(json.dumps(manifest,indent=2))
with tarfile.open(out/'website.tar.gz','w:gz') as t:
 t.add(site,arcname='site');t.add(out/'manifest.json',arcname='manifest.json')
print('Static release verified:',len(manifest['files']),'files; no server code, SQL, exports or credentials included')
