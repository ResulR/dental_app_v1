# Point 2.6 — Mécanisme installé et validé, révision 3

Clôture du 10/10/2026, Europe/Brussels. Installation administrateur et intégration réelle réussies selon rapport utilisateur, corroborées en lecture seule par l'agent : lanceur root:root 0555, SHA256 698472ebcc0ca0f8a1d74151cb7331ecfa9e113d8231f9262b3ba6f535de9ea1 ; dental-migrate NOLOGIN, zéro session ; aucune table des deux fixtures persistante ; compte dental-ai sans migration/owner/CREATE. Services concernés actifs.

## Contrat actuel — ne pas réinstaller

- Copie protégée : /usr/local/sbin/dental-lab-migrate. Source non privilégiée correspondante : docs/admin-proposals/dental-lab-migrate.py. La révision 2 installée a été sauvegardée par l'administrateur dans /var/lib/dental-lab-migrations/admin-backup/dental-lab-migrate.rev2.before-rev3.
- Chaque SQL et son SHA256 exigent une approbation administrateur explicite, après classification du risque, sauvegarde/restauration selon impact et revue des effets non transactionnels. Aucun sudo général, secret administrateur ni privilège de migration permanent pour l'IA. Identité Linux/SQL dédiée ; cible fixe dental_lab ; SQL jamais superuser.
- Invocation humaine uniquement : lanceur protégé avec nom de fichier versionné et SHA256 approuvés. Aucune exécution automatique depuis le projet ou Git ; ne pas rejouer les trois fixtures déjà traitées.
- Le rapport administrateur établit deux reçus succès (0000 et 9901), l'archive 9900_atomicity_failure_probe.sql.rollback-verified, aucun pending et contrôle du snapshot/SHA avant archivage. Le registre privé root, sa sauvegarde et HBA ne sont pas relus par l'IA via un contournement.
- CASE/END admis par contrôle lexical ciblé ; END transactionnel, autres commandes de contrôle transaction/session et effets déjà interdits restent refusés. Ce filtre ne remplace ni revue humaine ni sandbox SQL.
- Réseau/processus/IPC/ressources hôte partagés ; quotas du client systemd distincts du serveur PostgreSQL ; NOLOGIN ne tue pas les sessions ; panne/SIGKILL/commit incertain nécessitent audit humain et pending bloquant. Rétention snapshots, sauvegardes et isolation de production restent à valider.

## Historique de proposition révision 2 — OBSOLÈTE, NE PAS EXÉCUTER

Les blocs ci-dessous sont conservés uniquement pour la traçabilité de la préparation. Ils décrivent un état antérieur et des empreintes révision 2 ; ils ne sont plus une procédure applicable. Ne recréer aucun compte/rôle, ne changer ni HBA ni service et ne relancer aucun test sur leur base.

# Point 2.6 — Proposition soumise à l’administrateur

09/10/2026 — Révision 2 après revue transactionnelle. **Non installé, non validé.** Ne pas passer à 2.7.

## Audit terminé

Remote en ligne ; commandes vérifiées UID 1002/dental-ai et répertoire physique /srv/dental-lab. PostgreSQL 17.11 : dental-ai est uniquement membre d’audit, sans CREATE base/schéma, sans privilèges élevés. Migrator est NOLOGIN, CONNECT dental_lab et USAGE/CREATE public, sans CREATE base et sans membre LOGIN. Aucun rôle/compte dental-migrate, répertoire /var/lib/dental-lab-migrations ou lanceur installé actuellement. Les binaires utilisés ci-dessous ont été constatés aux chemins indiqués. Connexion actuelle : socket /var/run/postgresql, port 5432.

Contrôle supplémentaire dans dental_lab, en lecture seule : seulement extension plpgsql 1.0, zéro serveur étranger, zéro fonction SECURITY DEFINER exécutable par migrator ; audit et migrator sans SUPERUSER/CREATEDB/CREATEROLE/REPLICATION/BYPASSRLS. Ce résultat ne garantit pas les configurations futures.

## Choix proposé

Approbation humaine à chaque exécution. Aucun sudo, polkit, mot de passe, jeton, membership migrator/owner ou nouveau droit SQL pour dental-ai. L’IA prépare SQL versionné + SHA256 ; l’administrateur relit les octets correspondants, classe le risque, approuve puis invoque le lanceur root protégé avec deux arguments seulement. Le lanceur lit le candidat **sous dental-ai**, vérifie son SHA et fige une copie root non modifiable par l’IA. Les composants du chemin SQL sont ouverts sans suivre de liens ; fichiers ordinaires UTF-8 limités à 1 Mio, propriétaire UID1002, mode privé, un seul lien ; pas de FIFO, symlink, BOM ou NUL. Lecture limitée à 10s, snapshot fsync, umask 077 et verrou sans symlink. Il exécute SQL sous Linux/SQL dental-migrate, puis SET ROLE dental_lab_migrator. Le SQL de projet ne tourne jamais sous root/postgres.

Le nouveau compte Linux est système, sans HOME créé ni shell de connexion ; le rôle PostgreSQL est NOLOGIN au repos, NOINHERIT et sans attribut administratif. Sa seule appartenance est migrator, SET autorisé, INHERIT/ADMIN interdits. Un précontrôle refuse LOGIN déjà actif, sessions existantes, rôle/attributs/appartenances inattendus, élévation de migrator ou appartenance migrator/owner de dental-ai. LOGIN n’est ouvert que pendant l’intervention et refermé dans finally. SIGINT/SIGTERM déclenchent la tentative de fermeture ; une deuxième interruption ordinaire est ignorée pendant cette tentative. En cas de SIGKILL, panne électrique ou coupure brutale, la fermeture doit être contrôlée manuellement : NOLOGIN empêche les nouvelles connexions, ne ferme pas les sessions existantes.

L’exécution est une unité systemd transitoire limitée : AF_UNIX seulement, réseau privé, protections filesystem/processus, capacités nulles, 512 Mio/50 % CPU/64 tâches. Ces limites concernent le client de migration, **pas le processus serveur PostgreSQL partagé**. RuntimeMaxSec=6min limite la durée du client ; lock_timeout=5s, statement_timeout=5min et idle_in_transaction_session_timeout=30s bornent les attentes SQL ; revue indispensable pour éviter verrous/charge affectant le cluster. Aucun confinement complet du VPS n’est revendiqué.

Registre initial minimal root : version + checksum, verrou opérateur, marqueur durable .pending avant exécution, reçu après succès. Le marqueur contient version, SHA, nom d’unité unique et chemin du snapshot root conservé. Les snapshots restent protégés après succès/échec pour permettre la revue exacte ; aucune suppression automatique. Une politique de rétention/archivage et de capacité disque doit être approuvée avant production. Un échec/coupure laisse .pending et bloque TOUTE nouvelle migration, même d’une autre version. Un reçu de succès est créé uniquement après réussite SQL, NOLOGIN confirmé et zéro session restante ; un échec de fermeture conserve .pending. Un marqueur archivé .rollback-verified interdit de rejouer sa version. L’administrateur établit l’état SQL et le rollback avant de résoudre ce marqueur ; ne jamais le supprimer pour « réessayer ». Le registre transactionnel SQL sera ajouté lors des fondations, avec sa propre migration approuvée. Pas de migrations métier ni données réelles aujourd’hui.

## 1. Installation initiale — administrateur root seulement

Relire ce document et le fichier dental-lab-migrate.py avant toute commande. Copier les blocs dans une session administrateur ; **ne pas exécuter comme root un script depuis /srv/dental-lab**. Si un contrôle échoue, arrêter et transmettre le résultat expurgé. Les nouveaux chemins et identités sont des propositions, pas des objets préexistants.

Impact : un compte/groupe Linux, un rôle PostgreSQL limité et une appartenance ; fichiers dédiés root ; ajout de quatre règles HBA pour ce seul rôle et **rechargement** partagé PostgreSQL. Aucune autre règle ni base n’est modifiée ; aucun redémarrage ni changement de service applicatif. Ce rechargement exige une fenêtre administrateur : vérifier qu’aucune autre modification de configuration n’attend un reload.

```bash
set -euo pipefail
test "$(id -u)" = 0
test "$(getent passwd dental-ai | cut -d: -f3)" = 1002
if getent passwd dental-migrate >/dev/null; then echo "Compte déjà existant : arrêt"; exit 1; fi
if getent group dental-migrate >/dev/null; then echo "Groupe déjà existant : arrêt"; exit 1; fi
test ! -e /var/lib/dental-lab-migrations
test ! -e /usr/local/sbin/dental-lab-migrate
test -f /usr/lib/postgresql/17/bin/psql
/usr/sbin/runuser -u postgres -- /usr/lib/postgresql/17/bin/psql -X -w \
  -h /var/run/postgresql -p 5432 -d dental_lab -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
DO $check$
BEGIN
 IF current_database() <> 'dental_lab' OR current_setting('server_version_num')::int / 10000 <> 17
 THEN RAISE EXCEPTION 'Base/version inattendue'; END IF;
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='dental-migrate')
 THEN RAISE EXCEPTION 'Identité déjà existante : réauditer'; END IF;
 IF NOT has_schema_privilege('dental_lab_migrator','public','CREATE')
 THEN RAISE EXCEPTION 'Droits migrator inattendus'; END IF;
END
$check$;
CREATE ROLE "dental-migrate" NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB
 NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 1;
GRANT CONNECT ON DATABASE dental_lab TO "dental-migrate";
GRANT dental_lab_migrator TO "dental-migrate" WITH INHERIT FALSE;
GRANT dental_lab_migrator TO "dental-migrate" WITH SET TRUE;
GRANT dental_lab_migrator TO "dental-migrate" WITH ADMIN FALSE;
COMMIT;
SQL
/usr/sbin/groupadd --system dental-migrate
/usr/sbin/useradd --system --gid dental-migrate --no-create-home \
  --home-dir /nonexistent --shell /usr/sbin/nologin dental-migrate
/usr/bin/install -d -o root -g dental-migrate -m 0750 /var/lib/dental-lab-migrations
/usr/bin/install -d -o root -g root -m 0700 \
  /var/lib/dental-lab-migrations/receipts /var/lib/dental-lab-migrations/admin-backup
```

### HBA : insertion ciblée et sauvegarde

Vérifier d’abord que la configuration réelle indique bien ce chemin et aucune erreur. La vue décrit le fichier, pas les règles en mémoire. Examiner le diff avant reload ; s’il contient un changement étranger, arrêter.

```bash
/usr/sbin/runuser -u postgres -- /usr/lib/postgresql/17/bin/psql -X -w \
 -h /var/run/postgresql -p 5432 -d dental_lab -v ON_ERROR_STOP=1 \
 -c 'SHOW hba_file;' -c 'SELECT line_number,error FROM pg_hba_file_rules WHERE error IS NOT NULL;'
/usr/bin/python3 - <<'PY'
import os, shutil, tempfile
from pathlib import Path
p=Path('/etc/postgresql/17/main/pg_hba.conf')
backup=Path('/var/lib/dental-lab-migrations/admin-backup/pg_hba.conf.before')
assert not p.is_symlink() and not backup.exists()
old=p.read_bytes()
assert b'dental-migrate' not in old, 'Règle existante : réauditer'
prefix=(b'# BEGIN DENTAL MIGRATION ONLY\n'
 b'local dental_lab dental-migrate peer\n'
 b'local all dental-migrate reject\n'
 b'host all dental-migrate 0.0.0.0/0 reject\n'
 b'host all dental-migrate ::/0 reject\n'
 b'# END DENTAL MIGRATION ONLY\n')
shutil.copy2(p, backup)
fd,name=tempfile.mkstemp(dir=p.parent, prefix='.dental-hba-')
os.close(fd)
try:
 shutil.copy2(p,name)
 st=p.stat(); os.chown(name,st.st_uid,st.st_gid)
 with open(name,'wb') as f:
  f.write(prefix+old); f.flush(); os.fsync(f.fileno())
 os.replace(name,p)
finally:
 if os.path.exists(name): os.unlink(name)
PY
diff -u /var/lib/dental-lab-migrations/admin-backup/pg_hba.conf.before \
 /etc/postgresql/17/main/pg_hba.conf || test "$?" = 1
```

Arrêter ici et examiner le diff : exactement six lignes ajoutées, aucun autre changement. Après vérification de la fenêtre de reload, poursuivre :

```bash
/usr/sbin/runuser -u postgres -- /usr/lib/postgresql/17/bin/psql -X -w \
 -h /var/run/postgresql -p 5432 -d dental_lab -v ON_ERROR_STOP=1 <<'SQL'
DO $check$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_hba_file_rules WHERE error IS NOT NULL)
 THEN RAISE EXCEPTION 'HBA invalide : ne pas recharger'; END IF;
END $check$;
SQL
# Exécuter seulement après contrôle du diff et de l'absence d'autre changement en attente.
/usr/bin/systemctl reload postgresql@17-main
/usr/bin/systemctl is-active postgresql@17-main
```

### Installer le lanceur approuvé

Hash attendu de la proposition : `f7b73298eecad22b65e5c56705ceef649c77c812a8ca37a47f6600cc763554a7`.

```bash
umask 077
test ! -e /var/lib/dental-lab-migrations/admin-backup/launcher.reviewed
# Lecture bornée uniquement ; ce code fixe n’exécute PAS le fichier source.
copy_reviewed_proposal() {
 /usr/sbin/runuser -u dental-ai -- /usr/bin/python3 -I -c '
import os,stat,sys
if sys.argv[1] not in ("dental-lab-migrate.py","test_migration_atomicity.py"):
 raise SystemExit("Nom interdit")
d=os.open("/srv/dental-lab",os.O_DIRECTORY|os.O_NOFOLLOW)
for part in ("docs","admin-proposals"):
 d=os.open(part,os.O_DIRECTORY|os.O_NOFOLLOW,dir_fd=d)
f=os.open(sys.argv[1],os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK,dir_fd=d)
s=os.fstat(f)
if not stat.S_ISREG(s.st_mode) or s.st_uid!=1002 or s.st_nlink!=1 or s.st_mode&0o077 or s.st_size>1048576:
 raise SystemExit("Source non conforme")
data=os.read(f,1048577)
if len(data)>1048576: raise SystemExit("Source trop grande")
sys.stdout.buffer.write(data)
' "$1"
}
copy_reviewed_proposal dental-lab-migrate.py \
 > /var/lib/dental-lab-migrations/admin-backup/launcher.reviewed
echo 'f7b73298eecad22b65e5c56705ceef649c77c812a8ca37a47f6600cc763554a7  /var/lib/dental-lab-migrations/admin-backup/launcher.reviewed' | sha256sum -c -
# Relire cette copie root ; si approuvée :
/usr/bin/install -o root -g root -m 0555 \
 /var/lib/dental-lab-migrations/admin-backup/launcher.reviewed \
 /usr/local/sbin/dental-lab-migrate
stat -c '%U:%G %a %n' /usr/local/sbin/dental-lab-migrate \
 /var/lib/dental-lab-migrations /var/lib/dental-lab-migrations/receipts
getent passwd dental-migrate
```

## 2. Commandes autorisées et première preuve

Pour dental-ai : préparer/relire les fichiers versionnés dans migrations, calculer leur SHA256, exécuter les audits existants sur dental_lab. **Aucune invocation privilégiée autorisée pour l’IA.** Aucun sudoers à ajouter.

Pour l’administrateur : `/usr/local/sbin/dental-lab-migrate VERSION.sql SHA256`, après revue, sauvegarde/rollback selon risque. Aucun argument base/hôte/utilisateur/commande arbitraire. Le lanceur vérifie ses fichiers et parents root non modifiables par groupe/autres, et exige sa copie installée. Le shebang Python -I isole les imports. Il refuse nom traversant ou trop long, checksum différent, antislash (donc méta-commandes psql), contrôles de transaction/session et version réussie ou incertaine. Filtre conservateur pouvant refuser du SQL légitime ; pas de contournement, révision explicite du mécanisme si nécessaire.

Probe fourni : `migrations/0000_execution_probe.sql`, uniquement SELECT, sans DDL ni donnée métier. Commande réservée à l’administrateur après revue de ce SQL :

```bash
/usr/local/sbin/dental-lab-migrate 0000_execution_probe.sql \
  25e6cafc724d2b6ddd6c6be23f6fc44b4a5a21ea318cbfedac48a93bee7d1734
```

 Exécuter le probe seulement après installation approuvée. Il doit retourner dental_lab/dental-migrate/dental_lab_migrator et droits attendus.

La revue de chaque migration interdit aussi extensions, dblink/FDW, fonctions privilégiées, COPY PROGRAM, accès externe, appels pouvant sortir du périmètre, SQL non transactionnel et opérations administratives. Une sauvegarde dental_lab et un plan de restauration éprouvé sont indispensables avant risque matériel ; ne jamais restaurer automatiquement sur cette base partagée par l’application. Pas de restauration du cluster global.

## 3. Vérifications administrateur à transmettre

Refus attendus, à tester avant le probe réussi. Ces commandes ne doivent ni ouvrir LOGIN ni exécuter SQL :

```bash
if /usr/sbin/runuser -u dental-ai -- /usr/local/sbin/dental-lab-migrate \
  0000_execution_probe.sql 25e6cafc724d2b6ddd6c6be23f6fc44b4a5a21ea318cbfedac48a93bee7d1734; then
 echo 'ERREUR : accès privilégié inattendu'; exit 1
fi
if /usr/local/sbin/dental-lab-migrate ../../other.sql \
  25e6cafc724d2b6ddd6c6be23f6fc44b4a5a21ea318cbfedac48a93bee7d1734; then
 echo 'ERREUR : chemin interdit accepté'; exit 1
fi
if /usr/local/sbin/dental-lab-migrate 0000_execution_probe.sql \
  0000000000000000000000000000000000000000000000000000000000000000; then
 echo 'ERREUR : checksum incorrect accepté'; exit 1
fi
```

Vérifier les motifs affichés : invocation root réservée, arguments interdits, SHA différent. Un échec causé par fichier manquant ou mauvaise installation ne prouve pas le refus attendu.



```bash
/usr/sbin/runuser -u postgres -- /usr/lib/postgresql/17/bin/psql -X -w \
 -h /var/run/postgresql -p 5432 -d dental_lab -v ON_ERROR_STOP=1 -P pager=off <<'SQL'
BEGIN READ ONLY;
SELECT current_database(),pg_conf_load_time();
SELECT line_number,type,database,user_name,address,auth_method,error
 FROM pg_hba_file_rules WHERE 'dental-migrate'=ANY(user_name) ORDER BY rule_number;
SELECT rolname,rolcanlogin,rolinherit,rolsuper,rolcreatedb,rolcreaterole,
 rolreplication,rolbypassrls,rolconnlimit
 FROM pg_roles WHERE rolname IN ('dental-ai','dental-migrate','dental_lab_migrator','dental_lab_owner');
SELECT r.rolname AS role,m.rolname AS member,a.admin_option,a.inherit_option,a.set_option
 FROM pg_auth_members a JOIN pg_roles r ON r.oid=a.roleid
 JOIN pg_roles m ON m.oid=a.member WHERE m.rolname IN ('dental-ai','dental-migrate');
SELECT has_database_privilege('dental-ai','dental_lab','CREATE') AS audit_create_database,
 has_schema_privilege('dental-ai','public','CREATE') AS audit_create_schema;
SELECT count(*) AS remaining_executor_sessions FROM pg_stat_activity
 WHERE usename='dental-migrate';
COMMIT;
SQL
```

Attendus : aucune erreur HBA ; règles dédiées avant générales ; role dental-migrate NOLOGIN au repos, NOINHERIT, aucun attribut élevé, connexion limite 1 ; uniquement migrator avec ADMIN/INHERIT false et SET true ; dental-ai toujours uniquement audit, CREATE false/false ; zéro session d’exécution au repos. Ne pas tester de connexion aux bases voisines. Refus de destinations démontré par arguments fixes du lanceur et règles HBA ciblées ; vérifier identité/base lors du probe.

Pour clôturer 2.6 : installation/modes protégés et permissions réelles, probe réussi, refus d’invocation par dental-ai et de mauvais arguments/checksum, reçu/hash cohérents, NOLOGIN/zéro session après exécution, procédure de risques/backup acceptée. Les tests hors ligne ne remplacent pas ces preuves. Test technique de rollback DDL/DML réel et contrôle positif requis pour cette révision ; aucun schéma métier ni donnée réelle.

## 4. Arrêt d’urgence et retour arrière

Fermer les nouvelles connexions (ne termine pas les sessions existantes) :

```bash
/usr/sbin/runuser -u postgres -- /usr/lib/postgresql/17/bin/psql -X -w \
 -h /var/run/postgresql -p 5432 -d dental_lab -v ON_ERROR_STOP=1 \
 -c 'ALTER ROLE "dental-migrate" NOLOGIN;'
```

Si une unité transitoire est encore active, identifier exclusivement l’unité nommée par le lanceur (préfixe dental-lab-migration- et UUID enregistré dans le marqueur JSON) depuis son journal administrateur ; ne pas arrêter de processus/service global. Si une session reste active, fournir son PID et son état pour décision ciblée. Ne pas supprimer les comptes, reçus ou objets SQL avant résolution d’un .pending et audit des dépendances.

Pour retirer le HBA proposé, l’administrateur doit contrôler que le préfixe exact de six lignes est intact, retirer **seulement ce préfixe**, contrôler le diff et recharger après validation HBA comme ci-dessus. Conserver la sauvegarde ; ne pas restaurer aveuglément tout le fichier, ce qui pourrait effacer une intervention concurrente. Désactiver d’abord le rôle suffit à interrompre les nouvelles exécutions pendant cet audit. Aucune suppression de données ni rollback SQL automatique.

Commande de retrait ciblé du préfixe HBA, après désactivation et audit des sessions :

```bash
/usr/bin/python3 - <<'PYHBA'
import os, shutil, tempfile
from pathlib import Path
p=Path('/etc/postgresql/17/main/pg_hba.conf')
assert not p.is_symlink()
prefix=(b'# BEGIN DENTAL MIGRATION ONLY\n'
 b'local dental_lab dental-migrate peer\n'
 b'local all dental-migrate reject\n'
 b'host all dental-migrate 0.0.0.0/0 reject\n'
 b'host all dental-migrate ::/0 reject\n'
 b'# END DENTAL MIGRATION ONLY\n')
current=p.read_bytes()
assert current.startswith(prefix), 'Préfixe différent : arrêt et audit'
backup=Path('/var/lib/dental-lab-migrations/admin-backup/pg_hba.conf.before-removal')
assert not backup.exists()
shutil.copy2(p, backup)
fd,name=tempfile.mkstemp(dir=p.parent,prefix='.dental-hba-')
os.close(fd)
try:
 shutil.copy2(p,name)
 st=p.stat(); os.chown(name,st.st_uid,st.st_gid)
 with open(name,'wb') as f:
  f.write(current[len(prefix):]); f.flush(); os.fsync(f.fileno())
 os.replace(name,p)
finally:
 if os.path.exists(name): os.unlink(name)
PYHBA
# Contrôler le diff, la vue HBA et l'absence d'autre changement en attente
# avant le rechargement, comme dans la section Installation.
```



Sources techniques : PostgreSQL 17 GRANT, psql, pg_hba.conf et peer ; contrôles systemd à confirmer sur l’unité transitoire réelle. Cette procédure reste une proposition jusqu’à exécution administrateur et réception des preuves.


## 5. Correction transactionnelle et limites exactes

Le lanceur initial avait --single-transaction sans -c/-f, avec stdin et \i : contrat psql non respecté, proposition initiale retirée. La révision 2 emploie -X -w, ON_ERROR_STOP=1, --single-transaction, -c PREAMBLE, -f SNAPSHOT, -c IDENTITY ; stdin est DEVNULL. psql ouvre la transaction avant le préambule et commit seulement après le dernier contrôle. Une erreur SQL provoque ROLLBACK et un code non nul. Aucun script métier n’est exécuté via un client postgres/root.

Atomicité garantie par ce contrat pour le DDL/DML **transactionnel**, sans commande interne de transaction, sans effet non transactionnel ou externe. BEGIN/COMMIT/END/ROLLBACK et SET (y compris SET/**/ROLE), ainsi que CALL/DO/COPY et appels directs nextval/setval/set_config, sont rejetés de manière conservatrice. Ce filtre n’analyse pas tout SQL et ne remplace pas la revue des fonctions, triggers, defaults et permissions. Consommer une séquence existante via un default/trigger, une fonction externe, un effet réseau ou un verrou de session n’est pas intégralement annulé par ROLLBACK : interdire ces effets dans une migration exigeant rollback complet ou obtenir un plan spécifique approuvé. Journaux/statistiques serveur ne sont pas des données métier annulables.

Une déconnexion avant commit annule la transaction serveur ; une coupure au voisinage du commit peut laisser le client sans connaissance du résultat. .pending conserve précisément cette incertitude. Il n’y a pas de transaction distribuée entre PostgreSQL et le registre filesystem. Le marqueur est durable avant ouverture LOGIN ; le reçu vient après fermeture vérifiée. SIGKILL/panne ne peuvent pas garantir l’exécution de finally. NOLOGIN bloque les nouvelles connexions, pas la session en cours : une unité transitoire pourrait continuer jusqu’à sa limite. Ne pas reprendre sans contrôle ciblé unité/session/base et restauration/rollback selon risque. Ne jamais arrêter un service global.

Le compte peut créer des objets sous migrator, donc les futures fonctions/defaults/triggers et leurs grants doivent être revus. Les commandes non transactionnelles (par exemple CREATE INDEX CONCURRENTLY) échouent dans ce mécanisme ; ne pas supprimer --single-transaction pour les accepter. Le sandbox systemd limite le client, pas le serveur PostgreSQL partagé. Aucun accès voisin ni aucune isolation complète revendiquée.

## 6. Test d’intégration réel à faire approuver avant toute exécution

**Non exécuté à cette révision :** dental-ai n’a ni CREATE public ni TEMP ; dental-migrate et le lanceur installé sont absents. Aucun cluster PostgreSQL supplémentaire, rôle administrateur pour l’IA, installation ou écriture SQL n’a été créé pour contourner ce manque. Le fichier test_migration_atomicity.py quitte code 77 sous dental-ai avant tout appel privilégié. Ce résultat est un blocage, pas un test passé.

Deux fixtures présentes dans /srv/dental-lab/migrations :
- 9901_atomicity_success_probe.sql : CREATE + INSERT + assertion + DROP dans la même transaction, contrôle positif sans table conservée.
- 9900_atomicity_failure_probe.sql : CREATE + INSERT réussis, puis SELECT 1/0. Le test exige les traces CREATE TABLE/INSERT 0 1, SQLSTATE 22012, retour non nul, aucune table persistante, aucun reçu succès, .pending présent et SHA cohérent, NOLOGIN et zéro session. Une panne de connexion/installation ne passe pas ce test.

Le contrôle positif précède le cas d’échec car le .pending final doit empêcher toute nouvelle migration. Le test utilise le **lanceur réellement installé**, donc exactement son chemin psql -c/-f/-1, identité et sandbox ; il n’emploie aucun SQL projet sous postgres. Avant chaque cas, la table précise doit être absente. Si une table persiste, le test s’arrête et ne la supprime pas automatiquement.

Après installation du mécanisme et approbation séparée du test technique, dans la même session root que copy_reviewed_proposal :

```bash
set -euo pipefail
umask 077
test ! -e /var/lib/dental-lab-migrations/admin-backup/atomicity.reviewed
copy_reviewed_proposal test_migration_atomicity.py \
 > /var/lib/dental-lab-migrations/admin-backup/atomicity.reviewed
echo '331dc2bc284c0562ffd0230c73e17aedc8a191e1c3fed3d2aa1b438c27e1c862  /var/lib/dental-lab-migrations/admin-backup/atomicity.reviewed' | sha256sum -c -
# Relire et approuver la copie avant installation du test.
/usr/bin/install -d -o root -g root -m 0700 /var/lib/dental-lab-migrations/admin-tests
/usr/bin/install -o root -g root -m 0555 \
 /var/lib/dental-lab-migrations/admin-backup/atomicity.reviewed \
 /var/lib/dental-lab-migrations/admin-tests/test_migration_atomicity.py
/var/lib/dental-lab-migrations/admin-tests/test_migration_atomicity.py
```

Attendu : deux lignes VALIDÉ, retour 0, aucune des deux tables techniques, NOLOGIN/zéro session. Si le test échoue : conserver marqueurs/logs expurgés, ne pas passer 2.7 ni répéter. Le fichier échoué reste .pending. **Après revue humaine du rollback démontré**, l’administrateur peut conserver son historique en le renommant, sans le supprimer :

```bash
test ! -e /var/lib/dental-lab-migrations/receipts/9900_atomicity_failure_probe.sql.rollback-verified
mv -- /var/lib/dental-lab-migrations/receipts/9900_atomicity_failure_probe.sql.pending \
 /var/lib/dental-lab-migrations/receipts/9900_atomicity_failure_probe.sql.rollback-verified
```

Cette résolution est réservée à cette fixture connue après test réussi, pas une procédure universelle pour migration interrompue. La version archivée demeure interdite à la réapplication.

## 7. Correspondance fichiers et vérification de cette révision

Présents (propositions privées UID1002, dans le projet) : docs/admin-proposals/POINT_2_6_ADMIN.md, dental-lab-migrate.py, test_migration_gate.py, test_migration_atomicity.py ; migrations/0000_execution_probe.sql et les deux fixtures ci-dessus. Chemins root de /usr/local et /var/lib ci-dessus : destinations **à créer**, actuellement absentes, pas une installation annoncée. HBA/service : références du rapport administrateur précédent ; l’IA ne peut pas les lire/modifier avec ses droits et n’a pas affirmé une nouvelle vérification administrateur.

Références : https://www.postgresql.org/docs/17/app-psql.html (options --single-transaction, -c, -f, ON_ERROR_STOP) ; https://www.postgresql.org/docs/17/functions-sequence.html (effets des séquences non annulés). Rapport de validation détaillé : VALIDATION_2_6.md. Consigne §§4/8 et instruction utilisateur : aucune installation privilégiée autorisée aujourd’hui.
