# Notifications et intentions e-mail — réception PostgreSQL v9 proposée

**Non exécuté. Autorisation explicite séparée requise.** Le v8 a échoué au chargement de la fixture (ligne 67, `orders_manufacturing_version_fk`) avant toute assertion JavaScript ; `.local/notifications-v8`, ses journaux, le manifeste et les bundles v6/v7/v8 restent intacts. Les états avant/après des services et sockets v8 sont identiques, `status-after-stop.log` indique l'arrêt ; ceci ne valide aucun scénario métier PostgreSQL v8.

Le schéma 0004 définit `orders_current_version_fk` **DEFERRABLE INITIALLY DEFERRED**, mais `orders_manufacturing_version_fk` est immédiate. Les fixtures v6/v7 et v8 ont toutes l'insertion de la commande livrée avec une référence à une version pas encore créée. Les mêmes octets fautifs sont présents dans v6/v7, sans conclure ici à une exécution antérieure de ces lignes. V9 insère d'abord les quatre commandes `accepted`, `manufacturing_version_id=NULL`, puis leurs versions ; il fait passer la commande source par `manufacturing` (révision 2), `completed` (3), `delivered` (4), puis crée la retouche avec `source_revision=4`. `SET CONSTRAINTS ALL IMMEDIATE` et `COMMIT` restent dans la fixture ; aucune contrainte n'est désactivée. Une nouvelle assertion vérifie statut, révision, présence des versions courante et de fabrication et lien retouche avant les scénarios conservés de v8.

Bundle distinct : `tests/postgres/notifications-v9-fixture.sql`, `notifications-v9.mjs`, `run-notifications-v9.sh`, `notifications-v9.sha256`. Manifeste : 241 chemins, SHA-256 `8685fa46aff201b90a7421d908968cae60806d0d1a0223ff4b863f5a352c7618`. Racine neuve `.local/notifications-v9`, socket Unix privée 0700, port 55439, pas de TCP, HBA de rejet et peer local. UID 1002, hôte et cgroup vérifiés ; CPU 50 %, 1 Gio RAM et 100 tâches inchangés, admission 24 tâches/448 Mio non-cache et 1 Gio disque, Node 192 Mio, buffers PostgreSQL 32 Mio. Initdb, fixture et test ont chacun 90 s ; démarrage 40 s, arrêt rapide 30 s. Le trap EXIT/INT/TERM tente l'arrêt, compare services/PID, PostgreSQL de production et sockets et n'écrit `ok` qu'après succès. SIGKILL/panne machine ne sont pas couverts par un trap : contrôler indépendamment l'absence de processus/socket après exécution. Toute anomalie conserve l'image et les journaux, sans relance.

La fixture charge 0002–0013 et 0023 dans un cluster neuf sous rôle migrateur synthétique, le test utilise `dental_lab_app`. Elle ne valide pas l'acceptation des migrations 0022/0023 par le lanceur administratif. Les scénarios de 51 notifications, pagination 50+1, droits et révocation, indépendance des lectures de conversation, idempotence, rollback, révision obsolète, deux courses de verrous et intentions clinique/laboratoire sont conservés. Aucun fournisseur, worker, e-mail ou navigateur testé. La suppression concurrente des grants/configurations et la livraison restent hors de cette recette.

Avant toute autorisation, en lecture seule :

```bash
cd /srv/dental-lab
git status --short --branch
sha256sum tests/postgres/notifications-v9.sha256
sha256sum -c tests/postgres/notifications-v9.sha256
bash -n tests/postgres/run-notifications-v9.sh
node --check tests/postgres/notifications-v9.mjs
test ! -e .local/notifications-v9
```

**Commande envisagée, uniquement après autorisation séparée et nouveau préflight des ressources/services :**

```bash
cd /srv/dental-lab
DENTAL_NOTIFICATIONS_V9_APPROVED=private-unix-socket-one-shot bash tests/postgres/run-notifications-v9.sh
```

Résultats attendus, non constatés : `real-postgres-notification-outbox-v9-passed`, `V9_SQL_OK_STOPPED`, socket retirée, processus arrêté, services inchangés. Un échec impose arrêt, conservation des preuves et nouvelle proposition ; ne pas rejouer le bundle v9.
