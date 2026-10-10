# Point6.1 — R19 : proposition administrateur, NON EXÉCUTÉE

## État vérifié et périmètre

10/10/2026, agent dental-ai UID1002, dépôt main propre avant intervention, PostgreSQL170011 sur dental_lab. dental_lab_app : NOLOGIN, sans attribut administratif, CONNECT/CREATE/TEMP faux ; USAGE/CREATE public faux. public appartient à pg_database_owner ; seuls audit USAGE et migrateur USAGE/CREATE sont présents dans son ACL. dental-ai est uniquement membre dental_lab_audit. Identité Linux/SQL dental-lab-runtime absente. SELECT pg_hba_file_rules refusé par les permissions (capacité SELECT=false) : règles actuellement chargées NON vérifiées par l'agent.

R19 autorise la préparation et les parties indépendantes, pas l'exécution administrateur. Les blocs ci-dessous sont destinés à une revue humaine puis à une approbation explicite. Ne pas installer avant le rapport A et l'approbation des blocs B. Aucun service, port, Nginx, secret, droit IA, rôle/HBA migrateur2.6 ni composant dental-site ne change.

## Mécanisme minimal proposé

- Compte système Linux dental-lab-runtime non interactif, groupe propre, sans sudo.
- Rôle SQL du même nom, LOGIN par peer sur socket local ; aucun mot de passe créé. Membre uniquement dental_lab_app, sans ADMIN OPTION.
- CONNECT dental_lab et USAGE public accordés à dental_lab_app ; aucun droit sur table/séquence/fonction métier aujourd'hui, aucune propriété/DDL/TEMP. Les futurs droits DML explicites accompagneront les migrations approuvées. Pas de grants par défaut sur toutes les tables.
- Quatre règles HBA exclusivement pour la nouvelle identité : socket dental_lab peer ; toutes autres connexions locales reject ; tous TCP IPv4/IPv6 reject. Les droits PUBLIC d'autres bases ne peuvent pas être annulés par un REVOKE individuel : le refus d'authentification HBA constitue la frontière, à démontrer réellement.
- Test Node réel depuis une copie root protégée de 142 fichiers réguliers du client et de ses dépendances. Exécution uniquement sous le nouveau compte non privilégié ; jamais code projet éditable sous root/postgres. IA incapable de traverser le répertoire protégé, aucun secret nécessaire.
- Pas de démarrage d'API ni d'unité de production. L'API HTTP existante n'est pas raccordée automatiquement à ce client tant que la réception réelle est incomplète.

## A — Contrôle administrateur minimal en lecture seule

À exécuter par l'administrateur ; renvoyer les résultats non sensibles. Ne transmettre aucun fichier d'environnement.

```bash
/usr/bin/getent passwd dental-lab-runtime
/usr/bin/getent group dental-lab-runtime
/usr/bin/stat -c '%U:%G %a %n' /var/lib
/usr/bin/test ! -e /var/lib/dental-lab-client-test
/usr/sbin/runuser -u postgres -- /usr/bin/psql -X -d dental_lab -v ON_ERROR_STOP=1 <<'SQL'
BEGIN READ ONLY;
SHOW hba_file;
SELECT pg_conf_load_time();
SELECT rule_number, file_name, line_number, type, database, user_name,
       address, netmask, auth_method, error
FROM pg_hba_file_rules
WHERE error IS NOT NULL
   OR 'all' = ANY(user_name)
   OR 'dental-lab-runtime' = ANY(user_name)
   OR '+dental_lab_app' = ANY(user_name)
ORDER BY rule_number;
SELECT rolname, rolcanlogin, rolsuper, rolcreatedb, rolcreaterole,
       rolreplication, rolbypassrls, rolconnlimit
FROM pg_roles WHERE rolname IN
 ('dental-lab-runtime','dental_lab_app','dental_lab_owner','dental_lab_migrator','dental-ai');
SELECT pg_get_userbyid(member) AS member, pg_get_userbyid(roleid) AS role, admin_option
FROM pg_auth_members WHERE member IN
 (SELECT oid FROM pg_roles WHERE rolname IN ('dental_lab_app','dental-lab-runtime','dental-ai'))
 OR roleid=(SELECT oid FROM pg_roles WHERE rolname='dental_lab_app');
SELECT has_database_privilege('dental_lab_app','dental_lab','CONNECT') AS connect,
       has_database_privilege('dental_lab_app','dental_lab','CREATE') AS create_db,
       has_database_privilege('dental_lab_app','dental_lab','TEMP') AS temp,
       has_schema_privilege('dental_lab_app','public','USAGE') AS usage,
       has_schema_privilege('dental_lab_app','public','CREATE') AS create_schema;
SELECT datname FROM pg_database WHERE datname='postgres' AND datallowconn;
COMMIT;
SQL
```

getent absent et test de non-existence réussis sont attendus ; pas un script set-e interprétant getent absent comme une panne. Si collision, rôle/app héritant d'autres permissions, fichier HBA différent de /etc/postgresql/17/main/pg_hba.conf, erreurs HBA ou chemin existant : STOP et adapter après revue. Le catalogue décrit le fichier, pas directement la configuration chargée : corréler rechargement et tests ultérieurs. postgres n'est choisi pour un test d'authentification négatif que si son existence est démontrée par ce catalogue.

## B — Commandes proposées après A et approbation, administrateur uniquement

Conserver la sortie et les empreintes dans le rapport administrateur privé. Toutes les préconditions sont obligatoires ; ne pas transformer un échec en poursuite.

### B1 — Identités et grants uniquement dental_lab

A doit confirmer les attributs NOLOGIN/non administratifs de dental_lab_app et l’absence de tout membre applicatif existant. Aucun droit existant ne doit être élargi implicitement à une autre identité.

```bash
set -euo pipefail
test "$(id -u)" = 0
test ! -e /var/lib/dental-lab-client-test
if /usr/bin/getent passwd dental-lab-runtime >/dev/null; then exit 1; fi
if /usr/bin/getent group dental-lab-runtime >/dev/null; then exit 1; fi
/usr/sbin/useradd --system --user-group --no-create-home \
  --home-dir /nonexistent --shell /usr/sbin/nologin dental-lab-runtime
/usr/sbin/runuser -u postgres -- /usr/bin/psql -X -d dental_lab -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
DO $check$
BEGIN
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='dental-lab-runtime')
 OR has_database_privilege('dental_lab_app','dental_lab','CONNECT')
 OR has_schema_privilege('dental_lab_app','public','USAGE')
 OR has_database_privilege('dental_lab_app','dental_lab','CREATE')
 OR has_database_privilege('dental_lab_app','dental_lab','TEMP')
 OR has_schema_privilege('dental_lab_app','public','CREATE')
 OR EXISTS (SELECT 1 FROM pg_auth_members WHERE member =
       (SELECT oid FROM pg_roles WHERE rolname='dental_lab_app')
       OR roleid=(SELECT oid FROM pg_roles WHERE rolname='dental_lab_app'))
 THEN RAISE EXCEPTION 'R19 precondition failed'; END IF;
END $check$;
CREATE ROLE "dental-lab-runtime" NOLOGIN INHERIT NOSUPERUSER NOCREATEDB
 NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 2;
GRANT dental_lab_app TO "dental-lab-runtime";
GRANT CONNECT ON DATABASE dental_lab TO dental_lab_app;
GRANT USAGE ON SCHEMA public TO dental_lab_app;
COMMIT;
SQL
/usr/bin/id dental-lab-runtime
```

Impact : nouveau compte, rôle initialement NOLOGIN, deux grants applicatifs dans dental_lab. Aucun accès audit/migrator/owner, aucune modification d'ACL des autres bases. Si SQL échoue, le compte Linux reste créé mais ne peut pas accéder à SQL : STOP, retour arrière ciblé, pas de relance aveugle.

### B2 — Copie immuable du client approuvé

Archive existante générée par scripts/prepare-database-probe.py :
/srv/dental-lab/.local/point-6-1-client.tar.gz
SHA256 **1f581644a9691efa17f4d54583fb02e310772c33add3844056e56e8b72e1dbdd**.
Liste SHA de chaque fichier : POINT_6_1_ARTIFACTS.json. Une régénération différente impose nouvelle revue.

```bash
/usr/bin/install -d -o root -g dental-lab-runtime -m 750 /var/lib/dental-lab-client-test
/usr/bin/install -d -o root -g root -m 700 /var/lib/dental-lab-client-test/admin
/usr/bin/install -o root -g root -m 400 \
 /srv/dental-lab/.local/point-6-1-client.tar.gz \
 /var/lib/dental-lab-client-test/admin/client.tar.gz
printf '%s  %s\n' \
 1f581644a9691efa17f4d54583fb02e310772c33add3844056e56e8b72e1dbdd \
 /var/lib/dental-lab-client-test/admin/client.tar.gz | /usr/bin/sha256sum -c -
/usr/bin/python3 -I - <<'PY'
import hashlib,json,os,pwd,tarfile
from pathlib import Path
base=Path('/var/lib/dental-lab-client-test')
release=base/'release'
assert not release.exists()
group=pwd.getpwnam('dental-lab-runtime').pw_gid
with tarfile.open(base/'admin/client.tar.gz') as archive:
    members=archive.getmembers()
    assert len(members)==142 and len({m.name for m in members})==142
    assert all(m.isfile() and not m.name.startswith('/')
               and '..' not in Path(m.name).parts for m in members)
    manifest=json.load(archive.extractfile('MANIFEST.json'))
    assert set(manifest)=={m.name for m in members if m.name!='MANIFEST.json'}
    for member in members:
        data=archive.extractfile(member).read()
        if member.name!='MANIFEST.json':
            assert hashlib.sha256(data).hexdigest()==manifest[member.name]
        path=release/member.name
        path.parent.mkdir(parents=True,exist_ok=True,mode=0o700)
        with path.open('xb') as output: output.write(data)
        os.chown(path,0,group);path.chmod(0o440)
for directory in [release,*[p for p in release.rglob('*') if p.is_dir()]]:
    os.chown(directory,0,group);directory.chmod(0o750)
print('Protected archive verified and copied')
PY
/usr/sbin/runuser -u dental-ai -- /usr/bin/test ! -r /var/lib/dental-lab-client-test/release/package.json
/usr/bin/stat -c '%U:%G %a %n' /var/lib/dental-lab-client-test \
 /var/lib/dental-lab-client-test/release/apps/api/dist/shared/database.js
```

La copie protégée est vérifiée APRÈS transfert pour éviter la course avec le source éditable. L'administrateur exécute uniquement le code Python littéral ci-dessus comme root ; le client Node reste non privilégié.

### B3 — Changement HBA ciblé, sauvegarde, validation, rechargement

Modification PostgreSQL nécessaire : préfixer exactement ces quatre règles. Aucun port/listen_addresses ne change. Aucun redémarrage ; seul un rechargement de configuration du cluster partagé est nécessaire et doit être explicitement approuvé. Les autres règles sont conservées byte pour byte.

```bash
/usr/bin/python3 -I - <<'PY'
import hashlib,os,tempfile
from pathlib import Path
hba=Path('/etc/postgresql/17/main/pg_hba.conf')
backup=Path('/var/lib/dental-lab-client-test/admin/hba.before')
after=Path('/var/lib/dental-lab-client-test/admin/hba.after.sha256')
assert hba.is_file() and not hba.is_symlink() and not backup.exists() and not after.exists()
old=hba.read_bytes()
assert b'dental-lab-runtime' not in old
prefix=b'# BEGIN dental-lab R19\nlocal dental_lab dental-lab-runtime peer\nlocal all dental-lab-runtime reject\nhost all dental-lab-runtime 0.0.0.0/0 reject\nhost all dental-lab-runtime ::/0 reject\n# END dental-lab R19\n'
with backup.open('xb') as output: output.write(old)
backup.chmod(0o400)
stat=hba.stat()
fd,name=tempfile.mkstemp(dir=hba.parent,prefix='.dental-lab-r19-')
try:
    with os.fdopen(fd,'wb') as output:
        output.write(prefix+old);output.flush();os.fsync(output.fileno())
    os.chown(name,stat.st_uid,stat.st_gid);os.chmod(name,stat.st_mode & 0o777)
    for attribute in os.listxattr(hba):
        os.setxattr(name,attribute,os.getxattr(hba,attribute))
    # Refuse a concurrent administrator change.
    assert hba.read_bytes()==old
    os.replace(name,hba)
finally:
    if Path(name).exists():Path(name).unlink()
digest=hashlib.sha256(hba.read_bytes()).hexdigest()
after.write_text(digest+'\n');after.chmod(0o400)
print('before',hashlib.sha256(old).hexdigest(),'after',digest)
PY
/usr/sbin/runuser -u postgres -- /usr/bin/psql -X -d dental_lab -v ON_ERROR_STOP=1 <<'SQL'
DO $check$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_hba_file_rules WHERE error IS NOT NULL)
 THEN RAISE EXCEPTION 'HBA invalid: restore before reload'; END IF;
END $check$;
SELECT rule_number,type,database,user_name,address,auth_method,error
FROM pg_hba_file_rules WHERE 'dental-lab-runtime'=ANY(user_name) ORDER BY rule_number;
SELECT pg_reload_conf();
SQL
```

Contrôler quatre règles exactement, placées avant toute règle pouvant accepter cette identité, reload=true. Refaire SELECT pg_conf_load_time() dans une NOUVELLE session ; ce résultat plus les tests d'authentification constituent la preuve. La copie atomique conserve propriétaire, mode et attributs étendus (dont ACL) ; une erreur de conservation impose STOP avant remplacement. Aucun ajustement des règles2.6.

### B4 — Activation uniquement après rechargement démontré

Le rôle reste NOLOGIN pendant la préparation. Dans une nouvelle session, attendre et vérifier que le dernier rechargement est postérieur au remplacement HBA ; aucun démarrage/restart de service.

```bash
/usr/sbin/runuser -u postgres -- /usr/bin/psql -X -d dental_lab -v ON_ERROR_STOP=1 <<'SQL'
DO $check$ BEGIN
 IF pg_conf_load_time() < (pg_stat_file('/etc/postgresql/17/main/pg_hba.conf')).modification
 OR EXISTS (SELECT 1 FROM pg_hba_file_rules WHERE error IS NOT NULL)
 OR (SELECT count(*) FROM pg_hba_file_rules
     WHERE 'dental-lab-runtime'=ANY(user_name)) <> 4
 THEN RAISE EXCEPTION 'R19 reload not established'; END IF;
END $check$;
ALTER ROLE "dental-lab-runtime" LOGIN;
SQL
```

### B5 — Tests réels positifs et négatifs

```bash
/usr/bin/env -i PATH=/usr/bin:/bin UV_THREADPOOL_SIZE=1 \
 /usr/bin/timeout --signal=TERM --kill-after=3s 25s \
 /usr/sbin/runuser -u dental-lab-runtime -- \
 /usr/bin/node --v8-pool-size=1 --max-old-space-size=128 \
 /var/lib/dental-lab-client-test/release/scripts/database-probe.mjs
```

Attendu : code0 et real_pg_client passed. Le vrai client pg vérifie DB/identité/session/version17/membershipapp/absenceadministration/CREATE/TEMP/CREATEschéma, aucune autre membership ni propriété d’objet avant SELECT1. Pas une simulation de permissions.

Pour chaque test suivant : exécuter séparément depuis l'administrateur, consigner code NON ZÉRO et SQLSTATE42501 (VERBOSITY verbose) ; code0 signifie échec du contrôle. Chaque essai ouvre sa propre connexion et son éventuelle opération est entourée par BEGIN/ROLLBACK ; la fermeture psql après erreur annule la transaction. Aucun objet durable attendu.

```bash
/usr/sbin/runuser -u dental-lab-runtime -- /usr/bin/env -i PATH=/usr/bin:/bin \
 /usr/bin/psql -X -w -h /var/run/postgresql -U dental-lab-runtime -d dental_lab \
 -v ON_ERROR_STOP=1 -v VERBOSITY=verbose \
 -c 'BEGIN; CREATE TABLE public.r19_forbidden_probe(id integer); ROLLBACK;'
/usr/sbin/runuser -u dental-lab-runtime -- /usr/bin/env -i PATH=/usr/bin:/bin \
 /usr/bin/psql -X -w -h /var/run/postgresql -U dental-lab-runtime -d dental_lab \
 -v ON_ERROR_STOP=1 -v VERBOSITY=verbose \
 -c 'BEGIN; CREATE TEMP TABLE r19_forbidden_temp(id integer); ROLLBACK;'
/usr/sbin/runuser -u dental-lab-runtime -- /usr/bin/env -i PATH=/usr/bin:/bin \
 /usr/bin/psql -X -w -h /var/run/postgresql -U dental-lab-runtime -d dental_lab \
 -v ON_ERROR_STOP=1 -v VERBOSITY=verbose \
 -c 'BEGIN; SET ROLE dental_lab_owner; ROLLBACK;'
/usr/sbin/runuser -u dental-lab-runtime -- /usr/bin/env -i PATH=/usr/bin:/bin \
 /usr/bin/psql -X -w -h /var/run/postgresql -U dental-lab-runtime -d dental_lab \
 -v ON_ERROR_STOP=1 -v VERBOSITY=verbose \
 -c 'BEGIN; SET ROLE dental_lab_migrator; ROLLBACK;'
```

Authentification hors périmètre : seulement refus, avant SQL, sans lire les autres bases. postgres doit être confirmé existant par A ; sinon adapter le nom après revue. Ne pas tester les services applicatifs voisins.

```bash
/usr/sbin/runuser -u dental-lab-runtime -- /usr/bin/env -i PATH=/usr/bin:/bin PGCONNECT_TIMEOUT=5 \
 /usr/bin/psql -X -w -h /var/run/postgresql -U dental-lab-runtime -d postgres -c 'SELECT 1'
/usr/sbin/runuser -u dental-lab-runtime -- /usr/bin/env -i PATH=/usr/bin:/bin PGCONNECT_TIMEOUT=5 \
 /usr/bin/psql -X -w -h 127.0.0.1 -U dental-lab-runtime -d dental_lab -c 'SELECT 1'
/usr/sbin/runuser -u dental-lab-runtime -- /usr/bin/env -i PATH=/usr/bin:/bin PGCONNECT_TIMEOUT=5 \
 /usr/bin/psql -X -w -h ::1 -U dental-lab-runtime -d dental_lab -c 'SELECT 1'
/usr/sbin/runuser -u dental-ai -- /usr/bin/env -i PATH=/usr/bin:/bin PGCONNECT_TIMEOUT=5 \
 /usr/bin/psql -X -w -h /var/run/postgresql -U dental-lab-runtime -d dental_lab -c 'SELECT 1'
```

Attendu : HBA reject explicite hors DB/TCP, peer refusé depuis dental-ai. Connection refused TCP seul n'établit pas HBA : règles ciblées et refus socket hors DB obligatoires. Règles host all couvrent aussi d'autres adresses ; aucune exploration réseau nécessaire. Audit final dans dental_lab uniquement :
```bash
/usr/sbin/runuser -u postgres -- /usr/bin/psql -X -d dental_lab -v ON_ERROR_STOP=1 <<'SQL'
BEGIN READ ONLY;
SELECT to_regclass('public.r19_forbidden_probe') IS NULL AS no_probe_table;
SELECT count(*) AS runtime_sessions FROM pg_stat_activity WHERE usename='dental-lab-runtime';
SELECT rolname,rolcanlogin,rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls
FROM pg_roles WHERE rolname IN ('dental-lab-runtime','dental-ai','dental-migrate');
SELECT pg_conf_load_time();
COMMIT;
SQL
```
Attendu no_probe_table=true, sessions0, runtimeLOGIN sans attributs administratifs, migrateurNOLOGIN, audit inchangé. Aucun replay des fixtures2.6.

## Retour arrière proposé, administrateur uniquement

STOP le déroulement si un contrôle échoue. Révoquer l'identité avant toute restauration de HBA pour éviter une fenêtre d'authentification générale. Si un autre changement a touché HBA depuis B3, ne jamais écraser : restauration à préparer et revoir.

```bash
/usr/sbin/runuser -u postgres -- /usr/bin/psql -X -d dental_lab -v ON_ERROR_STOP=1 <<'SQL'
ALTER ROLE "dental-lab-runtime" NOLOGIN;
SELECT pg_terminate_backend(pid) FROM pg_stat_activity
WHERE usename='dental-lab-runtime' AND pid<>pg_backend_pid();
BEGIN;
REVOKE dental_lab_app FROM "dental-lab-runtime";
DROP ROLE "dental-lab-runtime";
REVOKE CONNECT ON DATABASE dental_lab FROM dental_lab_app;
REVOKE USAGE ON SCHEMA public FROM dental_lab_app;
COMMIT;
SQL
/usr/bin/python3 -I - <<'PY'
import hashlib,os,tempfile
from pathlib import Path
hba=Path('/etc/postgresql/17/main/pg_hba.conf')
admin=Path('/var/lib/dental-lab-client-test/admin')
assert hashlib.sha256(hba.read_bytes()).hexdigest()==(admin/'hba.after.sha256').read_text().strip()
stat=hba.stat()
fd,name=tempfile.mkstemp(dir=hba.parent,prefix='.dental-lab-r19-rollback-')
try:
    with os.fdopen(fd,'wb') as output:
        output.write((admin/'hba.before').read_bytes());output.flush();os.fsync(output.fileno())
    os.chown(name,stat.st_uid,stat.st_gid);os.chmod(name,stat.st_mode & 0o777)
    os.replace(name,hba)
finally:
    if Path(name).exists():Path(name).unlink()
print('HBA restored; reload still required')
PY
/usr/sbin/runuser -u postgres -- /usr/bin/psql -X -d dental_lab -v ON_ERROR_STOP=1 \
 -c 'SELECT pg_reload_conf();'
/usr/sbin/userdel dental-lab-runtime
/usr/bin/chown -R root:root /var/lib/dental-lab-client-test
/usr/bin/chmod 700 /var/lib/dental-lab-client-test
```

Retour aux grants faux observés AVANT R19 ; ne pas révoquer ces grants si de nouvelles opérations approuvées en dépendent depuis. Ne pas utiliser DROP OWNED/CASCADE, suppression récursive ou userdel -r. Conserver les preuves root protégées ; compte absent, rôle absent, empreinte HBA restaurée, erreursHBA0, session0, audit CONNECT réussi et migrateurNOLOGIN à vérifier. Si échec avant B3, ne pas exécuter la portion HBA sans ses fichiers de preuve.

## Validation actuelle et limites

Client préparé ; version pg8.23.1/types8.23.1 vérifiée dans le registre à l'installation, compatible Node22 et TS6. Pool max2, connexion5s, statement5s, lock2s, transactioninactive10s, attenteclient7s. Toutes les variables PG non reconnues, identités ou destinations différentes refusées ; aucune récupération de mot de passe/pgpass via le client peer. Listener idle sans texte d'erreur sensible. Les repositories futurs devront paramétrer leurs requêtes ; ce module ne remplace aucune permission métier.

Tests indépendants : configuration/refus, garde de session, passage de paramètres, libération et destruction des clients après erreur, fermeture du pool ; Pool simulé explicitement. Test réel NON EXÉCUTÉ. HBA et installation NON MODIFIÉS. Les droits métier sur tables seront validés quand le schéma existera. peer identifie un compte Linux, pas une clinique ; cloisonnement clinique applicatif à développer.

Le mécanisme proposé ne constitue pas une isolation complète du VPS : réseau/processus/IPC/ressources restent partagés. Nouveau rôle limité à deux connexions, délais imposés par client ; utilisateur Linux sans confinement permanent de production créé ici. Pas de données médicales réelles ; contrôles production19.3/19.4, sécurité, réseau, confidentialité, recette navigateur R17 demeurent exigés. Point6.1 reste BLOQUÉ sur réception réelle ; pas6.2.

Références officielles : https://node-postgres.com/apis/pool ; https://node-postgres.com/features/connecting ; https://www.postgresql.org/docs/17/auth-peer.html ; https://www.postgresql.org/docs/17/auth-pg-hba-conf.html .
