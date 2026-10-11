# Point 6.11 — Proposition administrateur NON EXÉCUTÉE

Application et réception différées ; voir dossier consolidé de fin chapitre6 pour précontrôles/audit exacts et ordre des dépendances. Aucun rejeu d'une version enregistrée. Approbation spécifique des deux fichiers obligatoire.

| Fichier | SHA-256 à approuver |
|---|---|
| migrations/0010_application_table_privileges.sql | 32889ead7b3c9db974835fa2efd0394d93593e1c8d287807fb9205f661e3c64b |
| tests/migrations/privileges_constraints.sql | 267a95afd402d70932a1f60eef4518fa76eca79e95ba2afb432bda5c08690449 |

Prérequis0009 et47tables/3vues. GRANT app explicites, UPDATE parcolonnes, histories/audit append-only, audit dental-ai inchangé. AucuneACLpardéfaut/futuretable ni rôle/HBA modifié. 17refus sous rôleslocaux etpositifs cascade/numéroIDENTITY/CAS réelSQL préparés. Attention session_user restepostgres pendantSETLOCALROLE : cette recette ne prouve pas les refus de SETROLE/login du runtime ; reprendre identitépeer réelle R19 via client protégé, aucune explorationvoisin.

Objets : . Aucune modification de rôle/HBA/service/projet voisin. Risque DDL durable : correction par nouvelle migration approuvée, aucun DROP/rejeu automatique. Les contraintes/services non testés restent explicitement différés.

## Application unique approuvée

```bash
set -euo pipefail
test "$(id -u)" = 0
/usr/local/sbin/dental-lab-migrate 0010_application_table_privileges.sql \
 32889ead7b3c9db974835fa2efd0394d93593e1c8d287807fb9205f661e3c64b
```

## Recette transaction annulée

Lecture sécurisée sous dental-ai, SHA exact, verrou opérateur et recette locale migrateur du mécanisme6.4. Aucun script projet exécuté root. Comptes de test vides.

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
    receipt=base/'receipts'/'0010_application_table_privileges.sql'
    before=receipt.read_bytes()
    record=json.loads(before)
    assert record['version']=='0010_application_table_privileges.sql'
    assert record['sha256']=='32889ead7b3c9db974835fa2efd0394d93593e1c8d287807fb9205f661e3c64b'
    reader="""import os,stat,sys
d=os.open('/srv/dental-lab',os.O_DIRECTORY|os.O_NOFOLLOW)
for part in ['tests','migrations']:
 n=os.open(part,os.O_DIRECTORY|os.O_NOFOLLOW,dir_fd=d)
 os.close(d);d=n
f=os.open('privileges_constraints.sql',os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK,dir_fd=d)
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
    assert hashlib.sha256(data).hexdigest()=='267a95afd402d70932a1f60eef4518fa76eca79e95ba2afb432bda5c08690449'
    preamble="BEGIN; SET LOCAL ROLE dental_lab_migrator; SET LOCAL search_path=pg_catalog,public; SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s'; SELECT pg_advisory_xact_lock(28467789);"
    args=['/usr/sbin/runuser','-u','postgres','--','/usr/lib/postgresql/17/bin/psql',
          '-X','-w','-U','postgres','-h','/var/run/postgresql','-p','5432','-d','dental_lab',
          '-P','pager=off','-v','ON_ERROR_STOP=1','-c',preamble,'-f','-','-c','ROLLBACK;']
    result=subprocess.run(args,env=env,cwd='/',input=data.decode('utf-8'),capture_output=True,text=True)
    assert result.returncode==0,result.stderr
    assert 'privileges_constraints passed: 17 negative cases' in result.stderr
    assert 'ROLLBACK' in result.stdout
    assert receipt.read_bytes()==before
    print('privileges_constraints passed: 17 negative cases; transaction rolled back; receipt unchanged')
finally:
    os.close(fd)
PY
```

Attendus : code0,17refus SQLSTATE voulus, cas positifs, ROLLBACK/reçu inchangé. Audit final requis : objets/ownership migrateur/contraintes validées, zérofixture dans tables et parents, NOLOGIN/sessions0/verrous0/aucun.pending, reçu/snapshot SHA conformes, permissions inchangées. Arrêt sur toute divergence. Jamais de données médicales réelles.
