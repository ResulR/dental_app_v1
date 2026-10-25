# Notifications et intentions e-mail — réception v11 proposée

**Non exécuté. Autorisation explicite séparée obligatoire.** V10 a chargé entièrement la fixture et franchi dix refus SQLSTATE 42501 sous `dental_lab_app`, puis a échoué SQLSTATE 42601 au premier `list` : une parenthèse excédentaire dans `visible`, après `NOT c.suspended`. `.local/notifications-v10` et tous les bundles v6–v10 restent inchangés. Les journaux v10 indiquent l'arrêt et les captures de services/sockets avant/après sont identiques ; cela ne valide pas les assertions métier restantes.

La correction source retire exclusivement cette parenthèse. Le prédicat garde le destinataire `n.target_account_id=$1`, l'association message/clinique/conversation/commande par `clinic_id`, `m.sender_id<>$1`, les droits `messaging.general.read`/`messaging.order.read` pour le personnel et le rattachement du compte de la clinique approuvée non suspendue pour les messages du laboratoire. Les avis de commande et d'inscription demeurent réservés au propriétaire. Le test unitaire équilibre les parenthèses des trois requêtes assemblées (compteur/liste/lecture), injecte l'ancienne faute et vérifie ces clauses. C'est un contrôle structurel, pas un parseur SQL PostgreSQL ; la syntaxe et l'autorisation en base attendent v11.

Bundle distinct : `tests/postgres/notifications-v11-fixture.sql`, `notifications-v11.mjs`, `run-notifications-v11.sh`, `notifications-v11.sha256`. Les scénarios v10 (fixture synthétique, dix refus de privilèges, 51 avis et pagination, lecture individuelle, cloisonnement, révocation, suspensions, concurrence, intentions e-mail, idempotence et rollback) restent présents. La fixture n'affaiblit aucune contrainte et garde l'ordre d'insertion des versions. Le cluster neuf est limité à `.local/notifications-v11`, socket privée 0700, port 55441, sans TCP ; UID/cgroup et marges CPU/RAM/tâches/disque identiques à v10 ; initdb/fixture/JS 90 secondes, démarrage 40, arrêt 30. Le trap EXIT/INT/TERM arrête PostgreSQL, vérifie l'absence de socket, compare production/services/PID/sockets, et ne crée `ok` qu'après succès. Une panne machine/SIGKILL exige un contrôle indépendant ; ne jamais rejouer sur un répertoire déjà créé.

Le manifeste comporte 241 fichiers. SHA-256 du manifeste : `2237e6a90b6ff029b14acff908ba359f0c9efc3fc9a2c233ff9c4383a3dc2ade`.

Préflight en lecture seule :

```bash
cd /srv/dental-lab
git status --short --branch
sha256sum tests/postgres/notifications-v11.sha256
sha256sum -c tests/postgres/notifications-v11.sha256
bash -n tests/postgres/run-notifications-v11.sh
node --check tests/postgres/notifications-v11.mjs
test ! -e .local/notifications-v11
/usr/lib/postgresql/17/bin/pg_isready -h /var/run/postgresql -p 5432
```

**Commande proposée, uniquement après autorisation séparée et préflight réussi :**

```bash
cd /srv/dental-lab
DENTAL_NOTIFICATIONS_V11_APPROVED=private-unix-socket-one-shot bash tests/postgres/run-notifications-v11.sh
```

Attendu, non observé : `real-postgres-notification-outbox-v11-passed`, `V11_SQL_OK_STOPPED`, socket et processus absents, production et services inchangés. En cas d'échec : arrêt, conservation de `.local/notifications-v11`, aucun rejeu ; recueillir erreur/état des services en lecture seule et proposer une version ultérieure. La recette n'autorise ni migration de production, ni fournisseur/worker/e-mail, ni navigateur. Le contrôle global historique `test:migrations` sur 0022/0023 reste distinct et non résolu par ce bundle.
