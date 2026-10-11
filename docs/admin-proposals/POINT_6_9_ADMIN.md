# Point 6.9 — Proposition administrateur NON EXÉCUTÉE

Application et réception différées ; voir dossier consolidé de fin chapitre6 pour précontrôles/audit exacts et ordre des dépendances. Aucun rejeu d'une version enregistrée. Approbation spécifique des deux fichiers obligatoire.

| Fichier | SHA-256 à approuver |
|---|---|
| migrations/0008_events_notifications_audit.sql | 118d11a1c0608e7e1a19c26c2b1d143d3ce8fcd2e4304f7fc9597876fc28f54c |
| tests/migrations/events_constraints.sql | 019e45f1d83ffb4e9a0c4ce64dd78b742d58b7340b4752a689fdea96c02a8c61 |

Prérequis0004. 7tables, outboxappend distincte du dispatcher etdesenvois, auditminimisé. 11refus/caspositifs panne e-mail sans perte événement/ordre préparés. Portaudit existant conservé ; pas deadapterdurable/worker/provider installé. Permissions immutable/futureownerlecture6.11, retries/destinataires/rappels/SSE auxservices.

Objets : outbox_events, outbox_dispatches, internal_notifications, email_category_recipients, notification_deliveries, notification_attempts, audit_events. Aucune modification de rôle/HBA/service/projet voisin. Risque DDL durable : correction par nouvelle migration approuvée, aucun DROP/rejeu automatique. Les contraintes/services non testés restent explicitement différés.

## Application unique approuvée

```bash
set -euo pipefail
test "$(id -u)" = 0
/usr/local/sbin/dental-lab-migrate 0008_events_notifications_audit.sql \
 118d11a1c0608e7e1a19c26c2b1d143d3ce8fcd2e4304f7fc9597876fc28f54c
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
    receipt=base/'receipts'/'0008_events_notifications_audit.sql'
    before=receipt.read_bytes()
    record=json.loads(before)
    assert record['version']=='0008_events_notifications_audit.sql'
    assert record['sha256']=='118d11a1c0608e7e1a19c26c2b1d143d3ce8fcd2e4304f7fc9597876fc28f54c'
    reader="""import os,stat,sys
d=os.open('/srv/dental-lab',os.O_DIRECTORY|os.O_NOFOLLOW)
for part in ['tests','migrations']:
 n=os.open(part,os.O_DIRECTORY|os.O_NOFOLLOW,dir_fd=d)
 os.close(d);d=n
f=os.open('events_constraints.sql',os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK,dir_fd=d)
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
    assert hashlib.sha256(data).hexdigest()=='019e45f1d83ffb4e9a0c4ce64dd78b742d58b7340b4752a689fdea96c02a8c61'
    preamble="BEGIN; SET LOCAL ROLE dental_lab_migrator; SET LOCAL search_path=pg_catalog,public; SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s'; SELECT pg_advisory_xact_lock(28467789);"
    args=['/usr/sbin/runuser','-u','postgres','--','/usr/lib/postgresql/17/bin/psql',
          '-X','-w','-U','postgres','-h','/var/run/postgresql','-p','5432','-d','dental_lab',
          '-P','pager=off','-v','ON_ERROR_STOP=1','-c',preamble,'-f','-','-c','ROLLBACK;']
    result=subprocess.run(args,env=env,cwd='/',input=data.decode('utf-8'),capture_output=True,text=True)
    assert result.returncode==0,result.stderr
    assert 'events_constraints passed: 11 negative cases' in result.stderr
    assert 'ROLLBACK' in result.stdout
    assert receipt.read_bytes()==before
    print('events_constraints passed: 11 negative cases; transaction rolled back; receipt unchanged')
finally:
    os.close(fd)
PY
```

Attendus : code0,11refus SQLSTATE voulus, cas positifs, ROLLBACK/reçu inchangé. Audit final requis : objets/ownership migrateur/contraintes validées, zérofixture dans tables et parents, NOLOGIN/sessions0/verrous0/aucun.pending, reçu/snapshot SHA conformes, permissions inchangées. Arrêt sur toute divergence. Jamais de données médicales réelles.
