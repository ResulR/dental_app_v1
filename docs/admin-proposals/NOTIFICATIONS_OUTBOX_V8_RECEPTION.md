# Notifications et intentions e-mail — bundle PostgreSQL v8 proposé

**Préparation statique uniquement. Aucun cluster v8 démarré.** Nouveau bundle `tests/postgres/notifications-v8-fixture.sql`, `notifications-v8.mjs`, `run-notifications-v8.sh`, `notifications-v8.sha256`. Le manifeste compte 241 chemins ; SHA-256 du manifeste : `85c8697eb03b91bd5f4abea0131282b53969d974409b86a98c83d9c442605bb8`. Les sources v1–v7, leurs images, journaux et marqueurs restent intacts. Le v7 n'est plus recevable dans le dépôt courant : `sha256sum -c` signale deux dépendances compilées changées (`clinical-mail-intent.repository.js`, `laboratory-mail-intent.repository.js`), les 239 autres entrées demeurant conformes lors de cette revue ; ne pas recalculer son manifeste ni le lancer contre ce code.

Le v8 reprend les scénarios v7 de 51 avis (pagination 50+1, compteur et lecture individuels), révocation de messagerie, intentions concurrentes, rollback, révision obsolète, clinique suspendue et droits administrateur retirés **avant** préparation. Il ajoute deux courses synthétiques sous PostgreSQL : une mise à jour de révision qui doit attendre `FOR SHARE OF o` et une suspension de compte administrateur qui doit attendre `FOR SHARE OF a`. Après ces commits, les nouvelles préparations doivent constater respectivement l'événement obsolète et le destinataire suspendu. Les suppressions concurrentes de grants/configuration ne sont pas verrouillées par le rôle applicatif ; elles ne sont pas revendiquées comme couvertes. Aucun transport e-mail ou fichier, aucune interprétation de lecture de conversation par un avis.

Runner réservé au VPS `vps-28bf7789`, UID 1002 et au cgroup `dental-ai-remote.service` existant (CPU 50 %, RAM 1 Gio, 100 tâches). Admission : 24 tâches et 448 Mio non-cache disponibles, 1 Gio disque libre. Racine neuve `.local/notifications-v8`, socket privée 0700, port 55438 sans TCP, PostgreSQL 17, HBA de rejet et peer local. Délais 90 s pour initdb/fixture/test, 40 s démarrage, 30 s arrêt ; Node 192 Mio, buffers 32 Mio. Contrôles SHA avant création, `attempt`, instantanés services/PID/sockets avant/après, arrêt dans le trap et `ok` uniquement si tests et comparaison réussissent. L'échec conserve preuves et image ; jamais de relance automatique.

Contrôles statiques proposés avant autorisation séparée :

```bash
cd /srv/dental-lab
git status --short --branch
sha256sum tests/postgres/notifications-v8.sha256
sha256sum -c tests/postgres/notifications-v8.sha256
bash -n tests/postgres/run-notifications-v8.sh
node --check tests/postgres/notifications-v8.mjs
test ! -e .local/notifications-v8
```

**Commande uniquement après autorisation explicite ultérieure**, nouveau préflight des ressources/services et validation du manifeste :

```bash
cd /srv/dental-lab
DENTAL_NOTIFICATIONS_V8_APPROVED=private-unix-socket-one-shot bash tests/postgres/run-notifications-v8.sh
```

Attendu, non constaté : `real-postgres-notification-outbox-v8-passed` et `V8_SQL_OK_STOPPED`, unité de test absente après arrêt, socket retirée et services identiques. Une erreur impose arrêt, diagnostic des journaux conservés et nouveau bundle ; ne jamais relancer à l'identique. Les permissions réelles, le SQL concurrent, la livraison future, les migrations de production et le navigateur ne sont pas validés par cette préparation.
