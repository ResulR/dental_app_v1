# Notifications et intentions e-mail — réception v12 proposée

**Non exécuté : autorisation explicite séparée requise.** V11 a chargé sa fixture et dépassé les précédents échecs 42501/42601. Son journal atteste SQLSTATE 23505 : deux événements synthétiques `order_accepted`, commande 2, révision 1. La contrainte `UNIQUE(aggregate_type,aggregate_id,aggregate_revision,type)` de 0008 fonctionne. Le cluster v11 est arrêté ; services et sockets capturés avant/après identiques. Les preuves `.local/notifications-v8` à `v11` et les bundles v6–v11 sont préservés.

V12 ajoute une commande synthétique 7, `accepted` révision 1, clinique 2 active, version initiale valide et fabrication absente, dans la même fixture isolée. L'événement de course `order_accepted` cible cette commande ; son UPDATE concurrent porte sa révision à 2. L'événement de rollback conserve la commande 2 révision 1. Les neuf créations littérales d'événements ont été auditées : aucune paire `(commande, révision, type)` ne se répète. Le test statique vérifie cette unicité, la clinique de la commande 7, le verrou de révision, le rejet après mise à jour et l'unique livraison. Les événements `order_submitted`/`modification_requested` sur commande 5 et `order_submitted`/`cancellation_requested` sur commande 6 ont des types différents ; ceux de la commande 1 ont des révisions/types distincts. Aucune contrainte de base n'est modifiée.

Le bundle distinct reprend les scénarios v11 : dix refus de privilèges, avis individuels/pagination, révocation, lecture indépendante, cloisonnement, concurrence (attente réelle via `pg_stat_activity`), intentions clinique/laboratoire, idempotence, rollback et obsolescence. Fichiers : `tests/postgres/notifications-v12-fixture.sql`, `notifications-v12.mjs`, `run-notifications-v12.sh`, `notifications-v12.sha256`. 241 empreintes ; SHA-256 du manifeste : `4ae97344c26bdab806a76651a18036faeae699dac4466c3ee23e16fdff71bd33`.

Le runner refuse un répertoire déjà créé, exige hôte/UID/cgroup et Git propres, garde les limites CPU 50 %, mémoire 1 Gio, tâches 100 et les marges disque/mémoire, socket Unix privée 0700 au port 55442 sans TCP. Initdb, fixture et JS ont chacun un timeout de 90 s ; démarrage 40 s, arrêt fast 30 s. Le trap EXIT/INT/TERM vérifie arrêt, socket, production et captures des services/sockets et écrit `ok` seulement après succès. SIGKILL/panne machine exigent un contrôle indépendant. Si un test échoue, préserver `.local/notifications-v12`, ne jamais rejouer ce bundle.

Préflight lecture seule :

```bash
cd /srv/dental-lab
git status --short --branch
sha256sum tests/postgres/notifications-v12.sha256
sha256sum -c tests/postgres/notifications-v12.sha256
bash -n tests/postgres/run-notifications-v12.sh
node --check tests/postgres/notifications-v12.mjs
test ! -e .local/notifications-v12
/usr/lib/postgresql/17/bin/pg_isready -h /var/run/postgresql -p 5432
```

**Commande proposée uniquement après autorisation explicite séparée :**

```bash
cd /srv/dental-lab
DENTAL_NOTIFICATIONS_V12_APPROVED=private-unix-socket-one-shot bash tests/postgres/run-notifications-v12.sh
```

Attendu, non constaté : `real-postgres-notification-outbox-v12-passed` puis `V12_SQL_OK_STOPPED`, serveur/socket absents et services inchangés. En cas d'échec, arrêter, conserver les journaux, contrôler indépendamment la production et proposer une version ultérieure. Ni le navigateur, ni le lanceur de migration historique 0022/0023, ni un fournisseur/worker e-mail ne sont validés par cette recette.
