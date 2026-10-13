# Point 7.1 — Limiteur durable0013 — proposition NON EXÉCUTÉE

Les commandes ci-dessous sont destinées à l'administrateur après approbation spécifique. Aucun appel privilégié par dental-ai ; ne rejouer aucune version reçue. Suivre les précontrôles/ordre/reçus du dossier chapitre6, puis chapitre7. La migration crée uniquement deux tables dédiées et un index ; aucune modification de rôle, HBA, service ou application voisine.

| Source à approuver | SHA-256 |
|---|---|
| migrations/0013_login_attempt_limits.sql | 5934c8f803168fad85efb63a19bbc2d50ee487c02f254d0caf523db01c7821d3 |
| tests/migrations/login_limits_constraints.sql | 74d9bd664fad932ac20cca336d5aef250c2a67da26db9da68edc2ab8c48cd013 |

Statuts : préparée et vérifiée par le filtre immuable hors ligne ; NON appliquée et NON réceptionnée. Les tests SQL ne sont pas exécutés. Dépendance directe de table : aucun objet métier/FK ; dépendances de login opérationnel :0002/0008/0010/0011 et runtime dédié. Conserver0012 dans l'ordre de chapitre validé, sans le prétendre nécessaire à la connexion.

Droits préparés minimaux dental_lab_app : SELECT deux tables, UPDATE(policy_digest) du singleton, INSERT/DELETE/UPDATE(attempts) des compteurs. Aucun droit DDL, DELETE du singleton ou UPDATE de l'expiration. Propriétaire migrateur selon mécanisme existant. Singleton seed=1 ; premiers compteurs absents. Application gère le verrou de ligne, fenêtre fixe et deux clés atomiques, pas un trigger inventé. Le schéma ne démontre pas seul la course ni la capacité : recette runtime complémentaire indispensable.

Risques : DDL durable ; singleton peut devenir contention sur charge élevée, fenêtre/limites/capacité à choisir et tester. Une configuration incompatible échoue fermée ; pas de reset automatique des compteurs/politique. Corrections par nouvelle migration approuvée, aucun DROP/rejeu ni purge globale. Garder API auth désactivée avant recette SQL ; la recette exige un limiteur inutilisé et refuse sinon. Une interruption n'autorise pas de rejouer : vérifier reçu/.pending et état SQL d'abord. Plan de vérification :8refus et cas positifs en ROLLBACK, droits et ownership, intégration/partage/redémarrage/charge, puis audit final.

## Application unique approuvée

```bash
set -euo pipefail
test "$(id -u)" = 0
/usr/local/sbin/dental-lab-migrate 0013_login_attempt_limits.sql \
 5934c8f803168fad85efb63a19bbc2d50ee487c02f254d0caf523db01c7821d3
```

## Recette transaction annulée

Lecture sécurisée sous dental-ai, SHA exact, verrou opérateur et recette locale migrateur du mécanisme6.4. Aucun script projet exécuté root. Limiteur jamais activé : compteurs vides et empreinte de politique NULL ; aucun nettoyage de compteurs actifs.

```bash
set -euo pipefail
test "$(id -u)" = 0
/usr/bin/python3 -I - <<'PY'
import fcntl,hashlib,json,os,stat,subprocess
from pathlib import Path
assert os.geteuid()==0
env={'PATH':'/usr/bin:/bin','HOME':'/','LANG':'C.UTF-8'}
base=Path('/var/lib/dental-lab-migrations')
launcher=Path('/usr/local/sbin/dental-lab-migrate')
assert hashlib.sha256(launcher.read_bytes()).hexdigest()=='698472ebcc0ca0f8a1d74151cb7331ecfa9e113d8231f9262b3ba6f535de9ea1'
fd=os.open(base/'operator.lock',os.O_RDWR|os.O_NOFOLLOW|os.O_NONBLOCK)
try:
    st=os.fstat(fd)
    assert stat.S_ISREG(st.st_mode) and st.st_uid==0 and st.st_nlink==1 and not st.st_mode&0o077
    fcntl.flock(fd,fcntl.LOCK_EX|fcntl.LOCK_NB)
    assert not any(p.name.endswith('.pending') for p in (base/'receipts').iterdir())
    receipt=base/'receipts'/'0013_login_attempt_limits.sql'
    before=receipt.read_bytes()
    record=json.loads(before)
    assert record['version']=='0013_login_attempt_limits.sql'
    assert record['sha256']=='5934c8f803168fad85efb63a19bbc2d50ee487c02f254d0caf523db01c7821d3'
    reader="""import os,stat,sys
d=os.open('/srv/dental-lab',os.O_DIRECTORY|os.O_NOFOLLOW)
for part in ['tests','migrations']:
 n=os.open(part,os.O_DIRECTORY|os.O_NOFOLLOW,dir_fd=d)
 os.close(d);d=n
f=os.open('login_limits_constraints.sql',os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK,dir_fd=d)
s=os.fstat(f)
assert stat.S_ISREG(s.st_mode) and s.st_uid==1002 and s.st_nlink==1 and not s.st_mode&0o077 and 0<s.st_size<65536
data=b''
while len(data)<=65536:
 chunk=os.read(f,min(4096,65537-len(data)))
 if not chunk:break
 data+=chunk
assert 0<len(data)<65536
sys.stdout.buffer.write(data)
"""
    data=subprocess.run(['/usr/sbin/runuser','-u','dental-ai','--','/usr/bin/python3','-I','-c',reader],
                        env=env,cwd='/',stdin=subprocess.DEVNULL,capture_output=True,check=True,timeout=10).stdout
    assert hashlib.sha256(data).hexdigest()=='74d9bd664fad932ac20cca336d5aef250c2a67da26db9da68edc2ab8c48cd013'
    preamble="BEGIN; SET LOCAL ROLE dental_lab_migrator; SET LOCAL search_path=pg_catalog,public; SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s'; SELECT pg_advisory_xact_lock(28467789);"
    args=['/usr/sbin/runuser','-u','postgres','--','/usr/lib/postgresql/17/bin/psql',
          '-X','-w','-U','postgres','-h','/var/run/postgresql','-p','5432','-d','dental_lab',
          '-P','pager=off','-v','ON_ERROR_STOP=1','-c',preamble,'-f','-','-c','ROLLBACK;']
    result=subprocess.run(args,env=env,cwd='/',input=data.decode('utf-8'),capture_output=True,text=True)
    assert result.returncode==0,result.stderr
    assert 'login_limits_constraints passed: 8 negative cases' in result.stderr
    assert 'ROLLBACK' in result.stdout
    assert receipt.read_bytes()==before
    print('login_limits_constraints passed: 8 negative cases; transaction rolled back; receipt unchanged')
finally:
    os.close(fd)
PY
```

Attendus : code0,8refus SQLSTATE attendus, incrément et suppression positifs, ROLLBACK/reçu inchangé. Audit final administrateur : deux tables/un index, contraintes validées, seed singleton=1/policy_digest NULL, zéro compteur fictif ; ownership migrateur, ACL ci-dessus exactes, rôle migrateur NOLOGIN/sessions0/verrous0, aucun.pending, reçu/snapshot SHA conformes. Ne pas modifier les reçus ni les protections existantes. Toute divergence arrête le lot.

Réception du code et des courses : [POINT_7_1_2_INTEGRATION_ADMIN](POINT_7_1_2_INTEGRATION_ADMIN.md). Cette proposition ne démarre aucun service ni compte réel.
