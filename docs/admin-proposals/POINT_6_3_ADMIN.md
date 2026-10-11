# Point 6.3 — Proposition administrateur, NON EXÉCUTÉE

Approbation explicite requise pour les deux fichiers et les commandes ci-dessous :
- migrations/0002_identity_clinics_permissions.sql, SHA256 a98661428ffaea3a999d872622cd5af088ddb3c9393253ba559a453a525a9821.
- tests/migrations/identity_constraints.sql, SHA256 99db2d8064e876ef872d4bb99a1db2d8085c867bb544239620ebd07c9a226ebb.

Périmètre : dental_lab uniquement. Neuf tables, une vue et index/contraintes,29définitions de capacités. Aucun compte réel, credential réel, rôle, grant PostgreSQL, HBA ou service à créer/modifier. Pas de nouveau lanceur. L’IA ne peut appliquer cette migration.

La migration DDL utilise exclusivement le lanceur2.6 installé. Le fichier de recette est distinct : il contient un bloc DO de tests négatifs, donc ne doit jamais être transmis au filtre des migrations. L’administrateur contrôle ses octets/SHA puis le passe à psql dans une transaction avec rôle local dental_lab_migrator et ROLLBACK obligatoire. Cette commande de recette nécessite sa propre approbation ; aucun changement LOGIN/permission pour l’IA et aucun script projet exécuté comme root/postgres.

## 1. Revue et contrôles avant migration

Exécuter chaque bloc seulement après contrôle du précédent. STOP à toute divergence. Ne pas rejouer0000/0001/9900/9901, tous enregistrés.

```bash
set -euo pipefail
test "$(id -u)" = 0
printf '%s  %s\n' \
 698472ebcc0ca0f8a1d74151cb7331ecfa9e113d8231f9262b3ba6f535de9ea1 \
 /usr/local/sbin/dental-lab-migrate | /usr/bin/sha256sum -c -
/usr/bin/stat -c '%U:%G %a %h %n' /usr/local/sbin/dental-lab-migrate
printf '%s  %s\n' \
 a98661428ffaea3a999d872622cd5af088ddb3c9393253ba559a453a525a9821 \
 /srv/dental-lab/migrations/0002_identity_clinics_permissions.sql \
 99db2d8064e876ef872d4bb99a1db2d8085c867bb544239620ebd07c9a226ebb \
 /srv/dental-lab/tests/migrations/identity_constraints.sql | \
 /usr/sbin/runuser -u dental-ai -- /usr/bin/sha256sum -c -
/usr/sbin/runuser -u dental-ai -- /usr/bin/cat /srv/dental-lab/migrations/0002_identity_clinics_permissions.sql
/usr/sbin/runuser -u dental-ai -- /usr/bin/cat /srv/dental-lab/tests/migrations/identity_constraints.sql
/usr/bin/python3 -I - <<'PY'
from pathlib import Path
base=Path('/var/lib/dental-lab-migrations/receipts')
assert not any(p.name.endswith('.pending') for p in base.iterdir())
for suffix in ['', '.pending', '.rollback-verified']:
    assert not (base/('0002_identity_clinics_permissions.sql'+suffix)).exists()
print('New version absent; no pending')
PY
/usr/sbin/runuser -u postgres -- /usr/bin/env -i PATH=/usr/bin:/bin HOME=/ LANG=C.UTF-8 \
 /usr/lib/postgresql/17/bin/psql -X -w -U postgres -h /var/run/postgresql -p 5432 \
 -d dental_lab -P pager=off -v ON_ERROR_STOP=1 <<'SQL'
BEGIN READ ONLY;
SELECT 1 / CASE WHEN
 (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname<>'information_schema' AND c.relkind IN ('r','p'))=0
 AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname='dental-migrate' AND NOT rolcanlogin)
 AND NOT EXISTS (SELECT 1 FROM pg_stat_activity WHERE usename IN ('dental-migrate','dental-lab-runtime'))
 THEN 1 ELSE 0 END AS empty_and_closed;
COMMIT;
SQL
```

Attendus : SHA exacts, lanceur root:root555/un lien, aucune version0002 ni pending, empty_and_closed=1. La migration doit échouer sur une collision d’objet, sans IF NOT EXISTS masquant un schéma divergent. Pas de modification des permissions pour faciliter les tests.

## 2. Migration aller approuvée

```bash
set -euo pipefail
test "$(id -u)" = 0
/usr/local/sbin/dental-lab-migrate 0002_identity_clinics_permissions.sql \
 a98661428ffaea3a999d872622cd5af088ddb3c9393253ba559a453a525a9821
```

Attendu : code0, CREATE/ALTER/INDEX/VIEW et INSERT29, receipt success avec le SHA approuvé. La transaction et le verrou appartiennent au lanceur existant. Aucun compte clinique/propriétaire réel n’est initialisé.

## 3. Recette des contraintes, transaction annulée

Bloc Python littéral à revoir, non chargé depuis le dépôt. Lecture du test sous dental-ai, sans suivre les liens ; contrôle SHA avant SQL. Le fichier n’est ni importé ni exécuté comme programme root. Verrou opérateur tenu pendant la recette. Les paramètres administrateur sont constants, puis le SQL de test tourne avec le rôle local migrateur. Ne pas remplacer ce bloc par une exécution root d’un script projet.

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
    receipt=base/'receipts'/'0002_identity_clinics_permissions.sql'
    before=receipt.read_bytes()
    record=json.loads(before)
    assert record['version']=='0002_identity_clinics_permissions.sql'
    assert record['sha256']=='a98661428ffaea3a999d872622cd5af088ddb3c9393253ba559a453a525a9821'
    reader="""import os,stat,sys
d=os.open('/srv/dental-lab',os.O_DIRECTORY|os.O_NOFOLLOW)
for part in ['tests','migrations']:
 n=os.open(part,os.O_DIRECTORY|os.O_NOFOLLOW,dir_fd=d)
 os.close(d);d=n
f=os.open('identity_constraints.sql',os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK,dir_fd=d)
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
    assert hashlib.sha256(data).hexdigest()=='99db2d8064e876ef872d4bb99a1db2d8085c867bb544239620ebd07c9a226ebb'
    preamble="BEGIN; SET LOCAL ROLE dental_lab_migrator; SET LOCAL search_path=pg_catalog,public; SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s'; SELECT pg_advisory_xact_lock(28467789);"
    args=['/usr/sbin/runuser','-u','postgres','--','/usr/lib/postgresql/17/bin/psql',
          '-X','-w','-U','postgres','-h','/var/run/postgresql','-p','5432','-d','dental_lab',
          '-P','pager=off','-v','ON_ERROR_STOP=1','-c',preamble,'-f','-','-c','ROLLBACK;']
    result=subprocess.run(args,env=env,cwd='/',input=data.decode('utf-8'),capture_output=True,text=True)
    assert result.returncode==0,result.stderr
    assert 'identity_constraints passed: 23 negative cases' in result.stderr
    assert 'ROLLBACK' in result.stdout
    assert receipt.read_bytes()==before
    print('identity_constraints passed: 23 negative cases; transaction rolled back; receipt unchanged')
finally:
    os.close(fd)
PY
```

Attendu : 23refus SQLSTATE voulus et cas positifs. Ce test ne démontre pas encore l’authentification, les permissions métier ou la consommation concurrente d’invitation ; ils restent aux chapitres dédiés. Aucun mot de passe/token réel ; données fictives annulées. Le statement_timeout borne le bloc DO. Sur erreur, ON_ERROR_STOP ferme psql et la transaction non engagée est annulée ; vérifier l’absence de fixture avant de poursuivre.

## 4. Audit final en lecture seule

```bash
set -euo pipefail
test "$(id -u)" = 0
/usr/sbin/runuser -u postgres -- /usr/bin/env -i PATH=/usr/bin:/bin HOME=/ LANG=C.UTF-8 \
 /usr/lib/postgresql/17/bin/psql -X -w -U postgres -h /var/run/postgresql -p 5432 \
 -d dental_lab -P pager=off -v ON_ERROR_STOP=1 <<'SQL'
BEGIN READ ONLY;
SELECT c.relname,c.relkind,pg_get_userbyid(c.relowner) AS owner
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relkind IN ('r','v') ORDER BY c.relname;
SELECT conname,contype,condeferrable,condeferred,convalidated
 FROM pg_constraint WHERE connamespace='public'::regnamespace ORDER BY conname;
SELECT 1 / CASE WHEN (SELECT count(*) FROM public.accounts)=0
 AND (SELECT count(*) FROM public.clinics)=0
 AND (SELECT count(*) FROM public.owner_slot)=0
 AND (SELECT count(*) FROM public.credentials)=0
 AND (SELECT count(*) FROM public.invitations)=0
 AND (SELECT count(*) FROM public.sessions)=0
 AND (SELECT count(*) FROM public.account_grants)=0
 AND (SELECT count(*) FROM public.employee_delegation_limits)=0
 AND (SELECT count(*) FROM public.permission_definitions)=29
 THEN 1 ELSE 0 END AS empty_fixture_and_registry;
SELECT rolname,rolcanlogin FROM pg_roles WHERE rolname='dental-migrate';
SELECT count(*) AS migration_sessions FROM pg_stat_activity WHERE usename='dental-migrate';
SELECT count(*) AS migration_locks FROM pg_locks l JOIN pg_stat_activity a ON a.pid=l.pid
 WHERE a.datname='dental_lab' AND a.usename='dental-migrate' AND l.locktype='advisory';
SELECT has_table_privilege('dental-lab-runtime','public.accounts','SELECT') AS runtime_accounts_select,
 has_table_privilege('dental-ai','public.accounts','SELECT') AS audit_accounts_select;
COMMIT;
SQL
/usr/bin/python3 -I - <<'PY'
import hashlib,json
from pathlib import Path
base=Path('/var/lib/dental-lab-migrations')
record=json.loads((base/'receipts'/'0002_identity_clinics_permissions.sql').read_bytes())
assert record['sha256']=='a98661428ffaea3a999d872622cd5af088ddb3c9393253ba559a453a525a9821'
snapshot=Path(record['snapshot'])
assert snapshot.is_absolute() and snapshot.name=='0002_identity_clinics_permissions.sql'
assert snapshot.resolve().is_relative_to(base.resolve()) and not snapshot.is_symlink()
assert hashlib.sha256(snapshot.read_bytes()).hexdigest()==record['sha256']
assert not any(p.name.endswith('.pending') for p in (base/'receipts').iterdir())
print('Snapshot/receipt verified; no pending')
PY
```

Attendus : neuf tables/une vue, ownership dental_lab_migrator, contraintes validées, empty_fixture_and_registry=1, NOLOGIN/sessions0/locks0, SHA snapshot/reçu exacts, aucunpending. Runtime/audit SELECT attendus faux en l’absence de default ACL : ne pas accorder de permissions pour changer le résultat. Reporter tout résultat divergent avant poursuite.

Rapport minimal : migration aller/code0/SHA ; objets/ownership/contraintes ; recette23refus+positifs et ROLLBACK ; zéro fixture ; registre29 ; reçu/snapshot ; NOLOGIN/sessions0/locks0/pending absent ; permissions inchangées.

## Risques et retour arrière

La DDL ajoute un schéma durable et29définitions techniques ; pas de donnée patient. Avant exécution, confirmer base vide et aucune session applicative. Une erreur pendant la migration doit annuler la transaction ; ne pas réexécuter la version, et préserver un éventuel pending pour diagnostic humain avec la procédure2.6.

Après succès, aucun DROP automatique : cette version est enregistrée définitivement. Une correction doit être une nouvelle migration approuvée ; un retour arrière destructif exigerait revue des dépendances et nouvelle autorisation. Les tests ne persistent aucune fixture. Interruption ou résultat incertain : STOP, vérifier la session/unité exacte et le registre, sans tuer des services globaux ni supprimer les reçus. Ne pas commencer6.4 avant réception6.3.
