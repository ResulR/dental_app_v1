# Premier propriétaire — dossier d'exécution privée v1

**Proposition, NON exécutée.** Aucun compte réel créé. L'accord sur le développement n'autorise ni cette installation, ni le bootstrap. Recevoir d'abord la recette isolée ci-dessous, les migrations/ACL et les contrôles système. L'approbation humaine précise l'identité/autorité, l'email et un UUID de dossier privé ; cet UUID est la corrélation d'audit, jamais une preuve d'identité inventée par le logiciel.

## Artefact et périmètre

Archive privée : `.local/owner-bootstrap-review-v1.tar.gz`. SHA et inventaire dans OWNER_BOOTSTRAP_ARTIFACTS.json ; commande de copie figée dans OWNER_BOOTSTRAP_COPY.md. Bundle séparé du bundle auth89e53eed, qui reste inchangé. Contient les outils, les dépendances figées et les migrations existantes pour la recette isolée ; rien n'est automatiquement migré.

- Supervisor Python : uniquement root, terminal humain, chemin protégé exact, manifeste intégral/root/nonmodifiable, autorisation root privée, verrou opérateur existant, refus de tout reçu de migration.pending.
- Hachage : enfant dental-lab-runtime UID994, même hashPassword/scrypt, entrée/sortie par pipes privés capturés en mémoire. Aucun mot de passe/hash en argv, environnement, fichier temporaire, SQL littéral ou sortie humaine. Pas de core dump ; buffers Node effacés quand possible. Python/JS ne garantissent pas l'effacement intégral des chaînes en RAM : console privée sans enregistrement, pas de débogueur/tracing.
- Écriture : enfant postgres, connexion peer fixe dental_lab uniquement, paramètres liés. Nouveau protocole de données ponctuel à approuver, PAS une délégation sudo à l'IA, PAS une migration ni une modification du lanceur. SQL métier sous SET LOCAL ROLE dental_lab_migrator, existant et NOLOGIN conservé. Aucun GRANT/DDL/UPDATE/DELETE ; rien d'installé dans l'API.
- Vérifications avant secret SQL : PostgreSQL17, identités, absence de runtime connecté, migrateurs NOLOGIN, absence d'extensions préchargées non revues. SET LOCAL conserve les traces de commandes mais supprime les valeurs de paramètres et DETAIL contenant potentiellement des données ; aucun réglage global. Si extension préchargée détectée : arrêter, examiner sa journalisation, ne pas la désactiver pour forcer le passage.
- ACL applicatives réelles vérifiées sous dental_lab_app ; owner_slot/profile/audit restent non modifiables par runtime. READ COMMITTED explicite, verrou SHARE ROW EXCLUSIVE sur accounts/owner_slot/credentials/audit ; la seconde tentative attend puis voit le premier commit.
- Base sans comptes/slot/credentials et sans ancien événement owner_bootstrap obligatoire. Création compte owner actif + slot + credential + audit OWNER_BOOTSTRAPPED, vérification des contraintes différées et des postconditions, COMMIT durable. Expiration de l'autorisation recontrôlée après verrou et avant commit.
- owner.pending créé/fsync AVANT écriture et jamais effacé automatiquement ; owner.receipt.json/fsync uniquement après accusé COMMIT. Même répertoire non réutilisable. Perte d'accusé = résultat incertain, jamais « rollback réussi ». Un superutilisateur reste une autorité de confiance ; le logiciel ne prétend pas empêcher un administrateur système malveillant de modifier sa propre base.

## 1. Recette PostgreSQL réelle sur machine isolée

À faire AVANT tout premier compte réel. PostgreSQL17 et Node22 déjà disponibles sur une machine de recette approuvée, **pas le VPS partagé**, aucun autre service de cette machine dans ce cluster. Copie du bundle vérifiée et figée au même chemin protégé. Les commandes suivantes sont à approuver et exécuter par l'opérateur ; rien n'a été exécuté par l'agent.

```bash
set -euo pipefail
test "$(id -u)" = 0
test "$(hostname)" != vps-28bf7789
test ! -e /var/lib/dental-lab-bootstrap-reception
/usr/bin/install -d -o postgres -g postgres -m 700 /var/lib/dental-lab-bootstrap-reception
/usr/bin/install -d -o postgres -g postgres -m 700 /var/lib/dental-lab-bootstrap-reception/socket
/usr/sbin/runuser -u postgres -- /usr/lib/postgresql/17/bin/initdb \
 -D /var/lib/dental-lab-bootstrap-reception/pgdata -U postgres --auth-local=peer --auth-host=reject --no-instructions
/usr/sbin/runuser -u postgres -- /usr/lib/postgresql/17/bin/pg_ctl \
 -D /var/lib/dental-lab-bootstrap-reception/pgdata \
 -l /var/lib/dental-lab-bootstrap-reception/server.log \
 -o "-c listen_addresses='' -c port=55432 -c unix_socket_directories=/var/lib/dental-lab-bootstrap-reception/socket -c max_connections=10 -c shared_buffers=32MB" -w start
/usr/sbin/runuser -u postgres -- /usr/lib/postgresql/17/bin/createdb \
 -h /var/lib/dental-lab-bootstrap-reception/socket -p 55432 -U postgres dental_lab
/usr/sbin/runuser -u postgres -- /usr/lib/postgresql/17/bin/psql \
 -X -w -h /var/lib/dental-lab-bootstrap-reception/socket -p 55432 -U postgres -d dental_lab \
 -v ON_ERROR_STOP=1 -f /var/lib/dental-lab-owner-bootstrap-v1/release/tests/postgres/bootstrap-fixture.sql
/usr/sbin/runuser -u postgres -- /usr/bin/env -i PATH=/usr/bin:/bin UV_THREADPOOL_SIZE=1 \
 DENTAL_LAB_BOOTSTRAP_TEST_APPROVED=isolated-empty-cluster-v1 \
 /usr/bin/timeout 90 /usr/bin/node --v8-pool-size=1 --max-old-space-size=192 \
 /var/lib/dental-lab-owner-bootstrap-v1/release/scripts/owner-bootstrap-postgres-test.mjs
```

Fixture SQL refuse un data_directory/port/base/version divergent ou un schéma non vierge. Rôles et schémas créés UNIQUEMENT dans ce nouveau cluster, pas sur le VPS. Cette fixture batch de test ne remplace jamais le protocole de migrations de production. Gardes du harness refusent UID0/1002/994 et tout autre socket ; ce harness n'est pas inclus dans npm test automatique.

Attendu : rollback vérifié après chacune des quatre écritures, véritable FK différée refusée, perte de connexion avant commit sans résidu ; deux connexions simultanées, attente de verrou effectivement observée, UN commit et un refus ; lecture après fermeture des écrivains depuis une nouvelle connexion, un compte/slot/credential/audit ; troisième tentative refusée sans changement. Une fixture synthétique reste dans le cluster isolé comme preuve ; aucune purge ni rejeu automatique.

En cas d'échec : conserver cluster/journal, diagnostic privé. Après succès, archiver preuve/sources/SHA et arrêter **seulement ce cluster** :

```bash
/usr/sbin/runuser -u postgres -- /usr/lib/postgresql/17/bin/pg_ctl \
 -D /var/lib/dental-lab-bootstrap-reception/pgdata -m fast -w stop
```

## 2. Précontrôles VPS et approbation du compte

Migrations et recettes reçues selon FIRST_LOGIN_RECEPTION.md (0003 jamais rejouée), backup et restauration vérifiés, copie protégée vérifiée, aucun.pending, aucune opération incertaine, runtime arrêté. Confirmer identité/autorité et adresse avec le propriétaire par canal indépendant, opérateur + vérificateur. Les paramètres de journalisation/préchargement sont à lire par l'administrateur ; dental-ai n'a pas accès à shared_preload_libraries (refus d'audit constaté, aucun privilège ajouté).

Après accord particulier pour **cette personne et cette adresse**, créer l'autorisation privée, valable15minutes. L'UUID désigne le dossier d'autorisation déjà validé. La personne saisit ensuite son mot de passe dans la console privée ; ne rien transmettre à l'agent.

```bash
set -euo pipefail
test "$(id -u)" = 0
/usr/bin/python3 -I - <<'PYAPPROVAL'
import getpass,json,os,time,uuid,warnings
from pathlib import Path
warnings.simplefilter('error',getpass.GetPassWarning)
os.umask(0o077)
path=Path('/var/lib/dental-lab-owner-bootstrap-v1/admin/approval.json')
with open('/dev/tty','r+') as tty:
 tty.write('UUID du dossier approuvé : ');tty.flush()
 reference=tty.readline().strip()
 assert str(uuid.UUID(reference,version=4))==reference
email=getpass.getpass('Email approuvé (entrée privée) : ')
assert email==email.strip() and 0<len(email)<=320
data={'purpose':'first-owner-v1','approvalId':reference,'email':email,'expiresAt':int(time.time()*1000)+900000}
with path.open('x') as output:
 json.dump(data,output);output.flush();os.fsync(output.fileno())
path.chmod(0o400)
print('Autorisation privée créée, aucun compte créé.')
PYAPPROVAL
/usr/bin/env -i PATH=/usr/bin:/bin LANG=C.UTF-8 \
 /usr/bin/python3 -I /var/lib/dental-lab-owner-bootstrap-v1/release/scripts/owner-bootstrap-admin.py
```

Refus/timeout/interruption : garder autorisation/pending/reçu, examiner l'état avant toute action. Ne pas renouveler/supprimer le marqueur pour « réessayer ». Une reprise exige un nouveau diagnostic et un accord particulier ; aucune commande de réinitialisation fournie.

## 3. Contrôles après écriture, sans secret projeté

Sous opérateur, vérifier le reçu privé et sa corrélation UUID avec l'audit, sans lire ni copier le password_hash. Exemple de contrôle agrégé :

```bash
/usr/sbin/runuser -u postgres -- /usr/bin/env -i PATH=/usr/bin:/bin \
 PGOPTIONS='-c default_transaction_read_only=on -c statement_timeout=5000' \
 /usr/lib/postgresql/17/bin/psql -X -w -h /var/run/postgresql -p 5432 -U postgres -d dental_lab -v ON_ERROR_STOP=1 -c "
SELECT
 (SELECT count(*) FROM public.accounts)=1 AS one_account,
 (SELECT count(*) FROM public.owner_slot)=1 AS one_slot,
 (SELECT count(*) FROM public.credentials)=1 AS one_credential,
 (SELECT count(*) FROM public.audit_events WHERE process_code='owner_bootstrap' AND action='OWNER_BOOTSTRAPPED')=1 AS one_audit,
 (SELECT count(*) FROM public.accounts a JOIN public.owner_slot o ON o.account_id=a.id
 WHERE a.profile='owner' AND a.lifecycle='active' AND NOT a.security_locked
 AND NOT a.credential_reset_required AND a.auth_epoch=0 AND a.revision=1)=1 AS owner_consistent;
SELECT rolname,rolcanlogin FROM pg_roles WHERE rolname IN ('dental_lab_migrator','dental-migrate');
SELECT count(*) AS bootstrap_connections FROM pg_stat_activity WHERE datname='dental_lab' AND application_name='dental-lab-first-owner';
"
```

Attendu avant login : cinq true, migrateursfalse, connexions0. Le refus de relance est assuré par marqueur + vide SQL ; ne pas ressaisir un vrai secret pour le démontrer. Aucune invitation/admin secondaire ou transfert créé.

Ensuite : probe SQL rollback AUTH_RUNTIME_ADMIN.md avant usage du limiteur, configuration validée FIRST_LOGIN_RUNTIME.md, HTTP/HTTPS AUTH_HTTPS_RECIPE.md, contrôle de l'alerte pending corrélée. Alertes email réellement livrées restent une réception distincte : worker/fournisseur non implémentés ; aucune mention « livré » sur une ligne pending.

## Sources techniques vérifiées

PostgreSQL17 : https://www.postgresql.org/docs/17/explicit-locking.html et https://www.postgresql.org/docs/17/runtime-config-logging.html. Leurs garanties ne remplacent pas la recette SQL préparée ici.
