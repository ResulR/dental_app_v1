# Notifications et intentions e-mail — proposition de réception PostgreSQL v10

**Proposition uniquement : aucun lancement v10 autorisé à ce stade.** La fixture v9 a été entièrement chargée. Le premier appel JavaScript a échoué avec SQLSTATE 42501 sur `SELECT ... FROM owner_slot FOR SHARE`, avant les assertions de pagination/concurrence. `.local/notifications-v9` et tous les bundles v6–v9 restent intacts ; arrêt du cluster v9 et état des services après test ont été rapportés, à recontrôler indépendamment avant toute autorisation.

## Diagnostic et privilèges

PostgreSQL 17 exige un droit UPDATE sur au moins une colonne de chaque table verrouillée par `FOR SHARE` ou `FOR UPDATE`. La migration 0010 donne seulement SELECT sur `owner_slot`. Aucun écrivain runtime ne modifie cette table ; le propriétaire est lié par les contraintes 0002. Le `viewer` des notifications retirait un verrou inutile, d'où 42501. Il conserve dans la même transaction le verrou de ligne de l'acteur (`accounts`), le verrou de table SHARE sur `account_grants`, les verrous de session et de clinique, puis réévalue `current()` et les prédicats de visibilité. Cela sérialise suspension, révocation de session et suppression de grants par le rôle applicatif. La modification privilégiée du slot ou un changement de schéma reste hors de cette garantie et doit être coordonné séparément.

| Parcours et table | Verrou | Privilège de 0010 / autre migration | Conclusion |
| --- | --- | --- | --- |
| Notifications, messagerie : `accounts` | FOR SHARE ou UPDATE | UPDATE limité aux colonnes identité/état | Autorisé, suspension attend le lecteur |
| Notifications, messagerie : `account_grants` | LOCK TABLE SHARE | DELETE table entière, INSERT ; aucun UPDATE | Autorisé pour LOCK, révoquer attend le lecteur ; FOR SHARE de lignes interdit |
| Notifications, messagerie : `sessions` | FOR SHARE | UPDATE(revoked_at) | Autorisé ; `session_limits` est lue sans verrou de ligne |
| Notifications, messagerie : `clinics` | FOR SHARE | UPDATE(suspended,review_state,...) | Autorisé |
| Messagerie : `conversations`, `messages`, `conversation_reads` | FOR SHARE / UPDATE | UPDATE de colonnes ciblées | Autorisé, sans élargissement de droits |
| Intentions : `outbox_dispatches`, `orders` | FOR UPDATE OF d, FOR SHARE OF o | UPDATE de colonnes ciblées | Autorisé ; révision verrouillée avant destinataire |
| Intentions : `accounts`, `clinics`, `invitations` | FOR SHARE OF a,c / FOR UPDATE OF i | UPDATE de colonnes ciblées | Autorisé |
| Intentions : `owner_slot`, `email_category_recipients`, `account_grants` | SELECT sans verrou de ligne | SELECT seul sur slot ; INSERT/DELETE sur configuration et grants | Aucun FOR SHARE sur ces trois tables ; relire droits/configuration juste avant tout futur envoi |
| Livraisons : `notification_deliveries` | INSERT avec conflit unique | INSERT et UPDATE de colonnes d'état | Idempotence SQL, aucun worker activé |

Les autres 42501 plausibles après le slot seraient un FOR SHARE ajouté à `account_grants`, `email_category_recipients` ou `session_limits`, un verrou de table SHARE sur une table seulement SELECT, ou une écriture hors colonnes accordées sur `sessions`/`internal_notifications`. Le v10 vérifie explicitement les refus SQLSTATE 42501 sur le slot, les grants, le compte de session, la configuration des destinataires, la cible d'un avis et l'événement outbox. Le droit DELETE sur les grants/configurations est **intentionnel** pour les opérations administratives existantes ; ce test n'affirme pas leur immutabilité. Les doubles unitaires vérifient l'ordonnancement du code mais ne prouvent pas les privilèges PostgreSQL. Le contrôle global `test:migrations` reste en échec sur l'inventaire du validateur installé pour 0022/0023 (`Contrôle de transaction/session ou effet interdit`) ; aucun lanceur ni migration historique n'est changé, et cette recette ne réceptionne pas cette politique.

## Bundle et couverture

Fichiers distincts : `tests/postgres/notifications-v10-fixture.sql`, `notifications-v10.mjs`, `run-notifications-v10.sh`, `notifications-v10.sha256`. Le manifeste contient 241 empreintes ; SHA-256 du manifeste : `a37b10a08feac292d01474ebc0f202b1ee15742447f9a68ee013e3bd6aaf9756`. Fixture v9 fonctionnellement conservée, schéma 0002–0013 puis 0023, rôle app par SET LOCAL ROLE ; aucun affaiblissement de contrainte. Le test reprend les 51 avis, pagination 50+1, lecture indépendante, permission interclinique, révocation concurrente, suspension, commande obsolète, rollback, deux courses de verrous et dédoublonnage des intentions clinique/laboratoire, plus les refus de privilèges. Si un nouveau défaut apparaît, arrêter et conserver le résultat : v9 n'a pas atteint ces assertions.

Racine neuve `.local/notifications-v10`, socket Unix 0700, port 55440, aucun TCP. Hôte, UID 1002, cgroup CPU 50 %, RAM 1 Gio, 100 tâches, marge disque 1 Gio/tâches 24/mémoire non-cache 448 Mio vérifiés ; Node 192 Mio, buffers 32 Mio, timeouts bornés (90 s initdb/fixture/JS, 40 s démarrage, 30 s arrêt). Le trap EXIT/INT/TERM demande arrêt fast, vérifie l'absence de serveur/socket, compare services/PID, disponibilité PostgreSQL de production et sockets, écrit `ok` uniquement sur succès. SIGKILL ou panne machine exigent un contrôle indépendant. Ne jamais rejouer v10 si le répertoire existe, ni effacer une preuve.

## Préflight en lecture seule, avant autorisation

```bash
cd /srv/dental-lab
git status --short --branch
sha256sum tests/postgres/notifications-v10.sha256
sha256sum -c tests/postgres/notifications-v10.sha256
bash -n tests/postgres/run-notifications-v10.sh
node --check tests/postgres/notifications-v10.mjs
test ! -e .local/notifications-v10
/usr/lib/postgresql/17/bin/pg_isready -h /var/run/postgresql -p 5432
```

**Commande envisagée, à exécuter une seule fois seulement après autorisation explicite séparée :**

```bash
cd /srv/dental-lab
DENTAL_NOTIFICATIONS_V10_APPROVED=private-unix-socket-one-shot bash tests/postgres/run-notifications-v10.sh
```

Résultat attendu, encore non constaté : `real-postgres-notification-outbox-v10-passed`, `V10_SQL_OK_STOPPED`, `.local/notifications-v10/ok`, serveur/socket absents, services inchangés. En cas d'échec : ne pas relancer, conserver `.local/notifications-v10` et ses journaux, vérifier lecture seule l'arrêt du cluster, les PID, les sockets et la production, puis diagnostiquer avant une version ultérieure. Cette recette ne prouve ni le lanceur de migration administratif, ni le navigateur, ni une livraison e-mail, ni les conditions de course avec un changement privilégié de schéma.
