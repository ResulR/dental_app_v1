#!/usr/bin/env python3
"""Bounded Git guard; reads index blobs, never ignored secrets or neighbours."""
import json,re,subprocess,sys
from pathlib import PurePosixPath
def sensitive(name):
 p=PurePosixPath(name)
 return any(x in {'node_modules','uploads','storage','backups','.npm-cache','.browser-qa','.local'} for x in p.parts) or (p.name.startswith('.env') and p.name!='.env.example') or p.suffix.lower() in {'.pem','.key','.p12','.pfx','.dump'} or p.name in {'id_rsa','id_ed25519'}
PATTERNS=[rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----',rb'ghp_[A-Za-z0-9]{36}',rb'github_pat_[A-Za-z0-9_]{60,}',rb'AKIA[A-Z0-9]{16}']
def secret(data):return any(re.search(p,data) for p in PATTERNS)
def main():
 staged='--staged' in sys.argv
 args=['git','diff','--cached','--name-only','--diff-filter=ACM','-z'] if staged else ['git','ls-files','-z']
 errors=[]
 for name in filter(None,subprocess.check_output(args).decode().split('\0')):
  if sensitive(name):errors.append(name+': sensitive path');continue
  data=subprocess.check_output(['git','show',':'+name])
  if secret(data):errors.append(name+': credential signature')
  if PurePosixPath(name).name=='package.json':
   for key,value in json.loads(data).get('scripts',{}).items():
    if re.search(r'\b(?:sudo|systemctl|psql|killall)\b|dental-lab-migrate|npm\s+(?:i|install)\s+-g',value):errors.append(name+': privileged/global script '+key)
 if errors:print('\n'.join(errors),file=sys.stderr);return 1
 print('Versioning guard OK ('+('staged' if staged else 'tracked index')+')');return 0
if __name__=='__main__':sys.exit(main())
