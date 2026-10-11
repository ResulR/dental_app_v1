# Point 6.5 — Proposition administrateur, NON EXÉCUTÉE

Implémentation et validation hors ligne distinctes de l'application/réception. Prérequis : 0002 et 0003 enregistrées ; terminer la recette restante 6.4 avant réception définitive de 6.5. Ne rejouer aucune migration enregistrée. Utiliser exclusivement dental_lab et le lanceur révision3 installé, inchangé.

Approbation spécifique nécessaire pour les deux fichiers :

| Fichier | SHA-256 à approuver |
|---|---|
| migrations/0004_orders_versions.sql | 4f4ce930b1422394e410ba5f9c3ee0ab90ce593718cfcf350f0c6c24a736c395 |
| tests/migrations/orders_constraints.sql | 959891f4413f720f9db62e9476db83350710d621b5342ec28e4a4b5c133bd60a |

Impact : 8 tables, index, FKs et ajout UNIQUE(id,kind) aux snapshots ; aucune donnée initiale ni modification de rôle/grant/HBA/service. Le compteur IDENTITY appartient au migrateur ; sa consommation en recette peut laisser des trous après ROLLBACK, ce qui est autorisé. Ne pas réinitialiser de séquence.

## Précontrôles

Administrateur : mêmes contrôles sécurisés de chemins/ownership/modes600/liens uniques et SHA que POINT_6_4_ADMIN.md ; lire sous dental-ai, jamais exécuter un programme projet comme root. Contrôler lanceur SHA 698472ebcc0ca0f8a1d74151cb7331ecfa9e113d8231f9262b3ba6f535de9ea1/root:root555. Registre : reçu et snapshot0003 conformes, aucun.pending, aucun reçu/snapshot0004 existant. Confirmer PostgreSQL17/dental_lab, migrateurNOLOGIN, sessions/verrous0 et absence des 8 nouveaux objets. Arrêt sur divergence. Les commandes et recettes ne sont pas autorisées par leur seule présence dans ce fichier.

## Application unique après approbation

```bash
set -euo pipefail
test "$(id -u)" = 0
/usr/local/sbin/dental-lab-migrate 0004_orders_versions.sql \
 4f4ce930b1422394e410ba5f9c3ee0ab90ce593718cfcf350f0c6c24a736c395
```

## Recette après application

Bloc littéral repris du mécanisme de recette 6.4, lecture sécurisée sous dental-ai, verrou opérateur, SQL approuvé sous rôle local migrateur dans transaction annulée ; aucun changement LOGIN et aucun script éditable exécuté root. Les comptes/catalogues de test doivent être vides.

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
    receipt=base/'receipts'/'0004_orders_versions.sql'
    before=receipt.read_bytes()
    record=json.loads(before)
    assert record['version']=='0004_orders_versions.sql'
    assert record['sha256']=='4f4ce930b1422394e410ba5f9c3ee0ab90ce593718cfcf350f0c6c24a736c395'
    reader="""import os,stat,sys
d=os.open('/srv/dental-lab',os.O_DIRECTORY|os.O_NOFOLLOW)
for part in ['tests','migrations']:
 n=os.open(part,os.O_DIRECTORY|os.O_NOFOLLOW,dir_fd=d)
 os.close(d);d=n
f=os.open('orders_constraints.sql',os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK,dir_fd=d)
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
    assert hashlib.sha256(data).hexdigest()=='959891f4413f720f9db62e9476db83350710d621b5342ec28e4a4b5c133bd60a'
    preamble="BEGIN; SET LOCAL ROLE dental_lab_migrator; SET LOCAL search_path=pg_catalog,public; SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s'; SELECT pg_advisory_xact_lock(28467789);"
    args=['/usr/sbin/runuser','-u','postgres','--','/usr/lib/postgresql/17/bin/psql',
          '-X','-w','-U','postgres','-h','/var/run/postgresql','-p','5432','-d','dental_lab',
          '-P','pager=off','-v','ON_ERROR_STOP=1','-c',preamble,'-f','-','-c','ROLLBACK;']
    result=subprocess.run(args,env=env,cwd='/',input=data.decode('utf-8'),capture_output=True,text=True)
    assert result.returncode==0,result.stderr
    assert 'orders_constraints passed: 15 negative cases' in result.stderr
    assert 'zero teeth and version history preserved' in result.stderr
    assert 'ROLLBACK' in result.stdout
    assert receipt.read_bytes()==before
    print('orders_constraints passed: 15 negative cases; transaction rolled back; receipt unchanged')
finally:
    os.close(fd)
PY
```

Attendus : code0,15refus SQLSTATE et cas positifs (référence patient ou nom complet, zéro dent/description, historique de versions), ROLLBACK et reçu inchangé. En erreur : transaction annulée à fermeture de psql, arrêt et audit des résidus, aucun rejeu automatique.

## Audit final et clôture

Reprendre l'audit final readonly et contrôle reçu/snapshot de POINT_6_4_ADMIN.md pour version 0004_orders_versions.sql/SHA 4f4ce930b1422394e410ba5f9c3ee0ab90ce593718cfcf350f0c6c24a736c395, avec objets : orders, order_versions, order_version_teeth, order_logistics, order_status_events, order_logistics_events, order_security_blocks, submission_receipts. Les 8 tables doivent appartenir à dental_lab_migrator ; toutes contraintes validées. Chaque table nouvelle, accounts/clinics/owner_slot et catalog_reference_snapshots doit être vide après ROLLBACK ; permission_definitions reste29. NOLOGIN/sessions0/verrous0/aucun.pending, reçu et snapshot SHA conformes. SELECT/INSERT runtime et audit restent refusés jusqu'à6.11 ; ne pas élargir les permissions pour la recette.

La recette schéma ne prouve pas encore les workflows serveur, permissions, verrouillage concurrent des instructions, audit/outbox ou rétention. Les champs/logistiques/historiques ont leurs contrôles aux services et6.11. DDL durable : retour arrière par nouvelle migration approuvée, aucun DROP/CASCADE/effacement de reçu automatique. Pas de données médicales réelles. Les recettes seront regroupées dans le dossier de fin de chapitre.
