# Bundle auth protégé — proposition administrateur NON EXÉCUTÉE

Archive préparée sousdental-ai :`/srv/dental-lab/.local/auth-runtime-review.tar.gz`. SHA-256 **89e53eed1327110f500bae6498f35850a7a3c9d575649aec3a71799152d0c9d0** ;1628fichiers réguliers dontMANIFEST.json. Détail par fichier et dépendance :AUTH_RUNTIME_ARTIFACTS.json. Contient API compilée, contrats et dépendances Express/pg/Zod, shellweb public et probe ; aucune.env/secrets/credential/fixture réelle. Ce bundle de revue n'est pas un service déployé.

Approbation spécifique du bundle et de la copie/sonde requise. Ne pas remplacer le bundle6.1 ni ses reçus. Toute régénération modifiant SHA exige nouvelle revue. La copie ci-dessous lit le source comme dental-ai sans suivre de lien puis vérifie les octets sousroot ; aucun code du projet exécuté root/postgres. Nouveau répertoire dédié, aucun autre projet/service touché. Interruption :inspecter état existant avant reprise, aucune suppression/réécriture aveugle.

## Copie unique après accord

```bash
set -euo pipefail
test "$(id -u)" = 0
test ! -e /var/lib/dental-lab-auth-review
/usr/bin/install -d -o root -g dental-lab-runtime -m 750 /var/lib/dental-lab-auth-review
/usr/bin/install -d -o root -g root -m 700 /var/lib/dental-lab-auth-review/admin
/usr/bin/python3 -I - <<'PYADMIN'
import hashlib,json,os,pwd,stat,subprocess,tarfile
from pathlib import Path
base=Path('/var/lib/dental-lab-auth-review')
env={'PATH':'/usr/bin:/bin','HOME':'/','LANG':'C.UTF-8'}
reader="""import os,stat,sys
d=os.open('/srv/dental-lab',os.O_DIRECTORY|os.O_NOFOLLOW)
n=os.open('.local',os.O_DIRECTORY|os.O_NOFOLLOW,dir_fd=d)
f=os.open('auth-runtime-review.tar.gz',os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK,dir_fd=n)
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
data=subprocess.run(['/usr/sbin/runuser','-u','dental-ai','--','/usr/bin/python3','-I','-c',reader],env=env,cwd='/',stdin=subprocess.DEVNULL,capture_output=True,check=True,timeout=15).stdout
assert hashlib.sha256(data).hexdigest()=='89e53eed1327110f500bae6498f35850a7a3c9d575649aec3a71799152d0c9d0'
archive_path=base/'admin/runtime.tar.gz'
with archive_path.open('xb') as output: output.write(data)
archive_path.chmod(0o400)
assert hashlib.sha256(archive_path.read_bytes()).hexdigest()=='89e53eed1327110f500bae6498f35850a7a3c9d575649aec3a71799152d0c9d0'
release=base/'release';assert not release.exists()
group=pwd.getpwnam('dental-lab-runtime').pw_gid
with tarfile.open(archive_path) as archive:
 members=archive.getmembers()
 assert len(members)==1628 and len({m.name for m in members})==1628
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
print('Protected auth bundle verified; no application executed')
PYADMIN
/usr/sbin/runuser -u dental-ai -- /usr/bin/test ! -r /var/lib/dental-lab-auth-review/release/package.json
```

## Probe réel après accord, bootstrap et migrations reçus

Exige owner_slot approuvé, API runtime arrêtée, aucun autre clientruntime, compteurvide etpolicyNULL ; sinonrefuse sanspurge. Le nouveau compteemployee/credential nonutilisable/sessions/audit/compteurs sontcréés dansunetransaction duclientruntime, contraintesdifférées contrôléesàchaqueopération, puisROLLBACK forcé et absence decomptefixture confirmée. Cela teste SQL/ACL/FK etrotation/révocation/admission séquentielles, pasdurabilitécommit/courseconcurrente/authHTTP. Il ne modifie pas le propriétaire. SQLtimeouttransaction10s/clientquery7s conservés.

La commande crée seulement une unité transitoire bornée pour la sonde, à approuver ; aucune unité persistante ni service voisin modifié. Verrou opérateur existant utilisé ; si une migration/.pending est en cours ou incertaine, ne pas exécuter. Vérifier registre sousadministrateur avantappel.

```bash
set -euo pipefail
test "$(id -u)" = 0
/usr/bin/flock -n /var/lib/dental-lab-migrations/operator.lock \
 /usr/bin/systemd-run --quiet --wait --collect --service-type=exec \
 --unit=dental-lab-auth-probe-review \
 -p User=dental-lab-runtime -p Group=dental-lab-runtime \
 -p WorkingDirectory=/var/lib/dental-lab-auth-review/release \
 -p NoNewPrivileges=yes -p PrivateTmp=yes -p PrivateDevices=yes \
 -p ProtectSystem=strict -p ProtectHome=yes -p RestrictAddressFamilies=AF_UNIX \
 -p TasksMax=16 -p MemoryMax=384M -p CPUQuota=50% -p RuntimeMaxSec=45 -p UMask=0077 \
 /usr/bin/env -i PATH=/usr/bin:/bin UV_THREADPOOL_SIZE=1 \
 DENTAL_LAB_PG_PROBE_APPROVED=rollback-v1 \
 /usr/bin/node --v8-pool-size=1 --max-old-space-size=192 \
 /var/lib/dental-lab-auth-review/release/scripts/auth-postgres-probe.mjs
```

Attendu :code0 et message JSON auth_postgres_rollback/passed/SQL_ACL_FK_sequential_only dans le journal de l’unité précise. Aucun SQL/hash/cookie/e-mail imprimé. Touteerreur :STOP, diagnostic identité/ACL/prérequis/rollback, aucunrejeuaveugle. Ne pas supprimer les reçus ni la copie protégée. Contrôlefinal :aucune session/verrou/fixture de sonde, politiques/compteurs inchangés, NOLOGIN migrateurs, limites et applicationsvoisines intactes.

Mise à jour13/10 : bootstrapprivé et harness commit/courses sur cluster isolé prêts dans FIRST_OWNER_BOOTSTRAP_ADMIN.md (bundle distinct, celui-ci inchangé). Réception HTTP réelle via AUTH_HTTPS_RECIPE.md ; automatisation des pannes HTTP avec vraiebase reste différée. FIRST_LOGIN_RUNTIME.md prépare la configuration et le lancement transitoire, TLS dépend des paramètres approuvés. Le bundle contient le codeAPI, mais ne fournit pas une commande de mise en service sans port/origine/policies et validation19.3/19.4. Voir FIRST_LOGIN_RECEPTION.md.
