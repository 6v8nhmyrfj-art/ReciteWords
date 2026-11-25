#!/usr/bin/env python3
"""Prepare an isolated self-hosted backend directory. Never overwrite credentials."""
import argparse,base64,hashlib,hmac,json,os,pathlib,secrets,shutil,time
p=argparse.ArgumentParser();p.add_argument('--output',required=True);a=p.parse_args()
root=pathlib.Path(__file__).resolve().parents[2];out=pathlib.Path(a.output).resolve()
if out.exists():raise SystemExit('Output exists; refusing to overwrite credentials or data')
out.mkdir(parents=True,mode=0o700)
shutil.copytree(pathlib.Path(__file__).with_name('backend'),out,dirs_exist_ok=True)
c={'POSTGRES_PASSWORD':secrets.token_hex(32),'JWT_SECRET':secrets.token_hex(48)}
def jwt(role):
 enc=lambda x:base64.urlsafe_b64encode(json.dumps(x,separators=(',',':')).encode()).rstrip(b'=').decode()
 s=enc({'alg':'HS256','typ':'JWT'})+'.'+enc({'role':role,'iss':'supabase','iat':int(time.time()),'exp':int(time.time())+86400*365*5})
 return s+'.'+base64.urlsafe_b64encode(hmac.new(c['JWT_SECRET'].encode(),s.encode(),hashlib.sha256).digest()).rstrip(b'=').decode()
c.update(ANON_KEY=jwt('anon'),SERVICE_ROLE_KEY=jwt('service_role'))
def private_file(name,text):
 fd=os.open(out/name,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
 with os.fdopen(fd,'w') as f:f.write(text)
private_file('credentials.json',json.dumps(c))
private_file('.env','\n'.join(k+'='+v for k,v in c.items())+'\n')
private_file('functions.env','CLOUDFLARE_ACCOUNT_ID=\nCLOUDFLARE_API_TOKEN=\n')
mapping={'main':['runtime-main.ts'],'rw-create-student':['create-student-index.ts'],'rw-daily-oral':['daily-oral-index.ts','cloudflare-ai.mjs'],'rw-oral':['oral-index.ts','oral-handler.mjs','cloudflare-ai.mjs','local-grade.mjs']}
for slug,files in mapping.items():
 d=out/'functions'/slug;d.mkdir(parents=True)
 for i,name in enumerate(files):shutil.copy2(root/'server'/name,d/('index.ts' if i==0 else name))
print('Prepared backend; secrets are private files and are not printed. Configure functions.env before starting.')
