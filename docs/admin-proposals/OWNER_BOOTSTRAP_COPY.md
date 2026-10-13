# Copie protégée bootstrap v1 — NON exécutée

Accord particulier requis pour ce nouvel artefact et ses ACL de lecture. SHA-256 **961ac181518d132a6d25c43c4a7d989d31024bcf58606834c31205a8912a8a00**,1646fichiers réguliers ; inventaire OWNER_BOOTSTRAP_ARTIFACTS.json. Ancienne archive auth89e53eed inchangée.

Sur VPS : lecture source sousdental-ai, code destination root:runtime440/dossiers750, ACL nominative postgres en lecture/traversée uniquement pour le worker administratif figé. Aucun droit ajouté àdental-ai, aucun rôle SQL changé. Admin700/root seulement.

Sur machine de recette isolée approuvée : l'opérateur transfère préalablement les MÊMES octets de l'archive à `/root/owner-bootstrap-review-v1.tar.gz`, root600/nlink1. Le code est root:postgres440/dossiers750 ; aucun compte runtime Linux requis pour le harness isolé. Aucune connexion réseau/transfert exécuté par ce bloc.

L'opérateur compare la présente empreinte à la revue approuvée, pas seulement à un manifeste fourni avec l'archive. Si le répertoire existe, STOP et inspecter ; ne pas écraser ni supprimer.

```bash
set -euo pipefail
test "$(id -u)" = 0
/usr/bin/python3 -I - <<'PYCOPY'
import hashlib,json,os,pwd,socket,stat,subprocess,tarfile
from pathlib import Path
digest='961ac181518d132a6d25c43c4a7d989d31024bcf58606834c31205a8912a8a00'
base=Path('/var/lib/dental-lab-owner-bootstrap-v1')
env={'PATH':'/usr/bin:/bin','HOME':'/','LANG':'C.UTF-8'}
vps=socket.gethostname()=='vps-28bf7789'
for parent in [Path('/'),Path('/var'),Path('/var/lib')]:
 s=parent.lstat()
 assert stat.S_ISDIR(s.st_mode) and s.st_uid==0 and not s.st_mode&0o022
assert not os.path.lexists(base)
if vps:
 reader="""import os,stat,sys
d=os.open('/srv/dental-lab',os.O_DIRECTORY|os.O_NOFOLLOW)
n=os.open('.local',os.O_DIRECTORY|os.O_NOFOLLOW,dir_fd=d)
f=os.open('owner-bootstrap-review-v1.tar.gz',os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK,dir_fd=n)
s=os.fstat(f)
assert stat.S_ISREG(s.st_mode) and s.st_uid==1002 and s.st_nlink==1 and not s.st_mode&0o077 and 0<s.st_size<52428800
parts=[];total=0
while total<=52428800:
 c=os.read(f,min(65536,52428801-total))
 if not c:break
 total+=len(c);parts.append(c)
assert total==s.st_size
sys.stdout.buffer.write(b''.join(parts))
"""
 data=subprocess.run(['/usr/sbin/runuser','-u','dental-ai','--','/usr/bin/python3','-I','-c',reader],
  env=env,cwd='/',stdin=subprocess.DEVNULL,capture_output=True,check=True,timeout=15).stdout
else:
 source=Path('/root/owner-bootstrap-review-v1.tar.gz')
 s=source.lstat()
 assert stat.S_ISREG(s.st_mode) and s.st_uid==0 and s.st_nlink==1 and not s.st_mode&0o077 and 0<s.st_size<52428800
 data=source.read_bytes()
assert hashlib.sha256(data).hexdigest()==digest
group=pwd.getpwnam('dental-lab-runtime' if vps else 'postgres').pw_gid
base.mkdir(mode=0o750);os.chown(base,0,group)
admin=base/'admin';admin.mkdir(mode=0o700)
archive_path=admin/'review.tar.gz'
with archive_path.open('xb') as output:
 output.write(data);output.flush();os.fsync(output.fileno())
archive_path.chmod(0o400)
assert hashlib.sha256(archive_path.read_bytes()).hexdigest()==digest
release=base/'release'
with tarfile.open(archive_path) as archive:
 members=archive.getmembers()
 assert len(members)==len({m.name for m in members})==1646
 assert all(m.isfile() and not m.name.startswith('/') and '..' not in Path(m.name).parts for m in members)
 assert sum(m.size for m in members)<52428800
 manifest=json.load(archive.extractfile('MANIFEST.json'))
 assert set(manifest)=={m.name for m in members if m.name!='MANIFEST.json'}
 for member in members:
  content=archive.extractfile(member).read()
  if member.name!='MANIFEST.json':assert hashlib.sha256(content).hexdigest()==manifest[member.name]
  target=release/member.name;target.parent.mkdir(parents=True,exist_ok=True,mode=0o700)
  with target.open('xb') as output:output.write(content)
  os.chown(target,0,group);target.chmod(0o440)
for directory in [release,*[p for p in release.rglob('*') if p.is_dir()]]:
 os.chown(directory,0,group);directory.chmod(0o750)
if vps:
 subprocess.run(['/usr/bin/setfacl','-m','u:postgres:rx',str(base)],env=env,check=True)
 subprocess.run(['/usr/bin/setfacl','-R','-m','u:postgres:r-X',str(release)],env=env,check=True)
 subprocess.run(['/usr/sbin/runuser','-u','dental-ai','--','/usr/bin/test','!','-r',str(release/'package.json')],env=env,check=True)
print('BOOTSTRAP_BUNDLE_VERIFIED — aucun bootstrap exécuté')
PYCOPY
```

Contrôler les ACL finales (pas de write nonroot, admin inaccessible au runtime/postgres/agent), les empreintes et l'absence de fichiers inattendus avant d'exécuter FIRST_OWNER_BOOTSTRAP_ADMIN.md. Une interruption pendant la copie ne vaut pas échec certain : conserver la copie partielle et diagnostiquer. Le supervisor revalide les empreintes/root/modes avant utilisation ; il n'accepte jamais un chemin fourni par un utilisateur HTTP.
