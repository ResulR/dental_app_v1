# Réception PostgreSQL isolée v17 — 27 octobre 2026

Exécution unique autorisée à partir du commit `83f1bfb0ed78b8c7cc5df682f3a93c04f8ae0f6d`.
Commande : `DENTAL_NOTIFICATIONS_V17_APPROVED=private-unix-socket-one-shot bash tests/postgres/run-notifications-v17.sh`.
**Résultat : réussite, 77 assertions, exit 0, marqueur `V17_SQL_OK_STOPPED`.**
Aucune ancienne recette n'a été relancée.

Préflight : Git propre et synchronisé ; manifeste SHA-256
`c92ff71ea9b8db4664f14bc1b1a026270b36edfb1de4d858690c746ff97c5bab`,
248/248 fichiers conformes ; Bash, Node et deux tests statiques réussis.
UID 1002, hostname `vps-28bf7789`, cgroup
`/system.slice/dental-ai-remote.service`, CPU 50000/100000,
mémoire 1 Gio et limite 100 processus conformes ; 48 tâches au constat,
environ 296 Mio anon+kernel et plus de 55 Go de disque libre. Répertoire
`.local/notifications-v17` absent ; port 55447/socket absents ; PostgreSQL
de production sur 5432 disponible. Runner inchangé depuis l'audit statique.

Preuves privées : `.local/notifications-v17/attempt`, `commit`, `sha256`,
`sha256-check.log`, `fixture.log`, `server.log`, `result.json`,
`test-error.log`, `stop.log`, `status-after-stop.log`, `ok` et captures
avant/après. `result.json` annonce
`{"result":"real-postgres-dormant-delivery-v17-passed","assertions":77}`.
`test-error.log` est vide. Le test exige, avant le commit administrateur,
le PID de la connexion d'autorisation en attente `Lock` sur sa requête de
contrôle, et le PID administrateur dans `pg_blocking_pids()`. Après le
commit, il exige `cancelled` et la livraison annulée. Son succès établit
que ces assertions ont passé dans l'exécution ; les PID numériques et
l'échantillon `pg_stat_activity` ne sont pas journalisés séparément.
Les erreurs de privilège 42501 du journal serveur sont les contrôles négatifs
attendus ; le message `too many background workers` au démarrage découle
de `max_worker_processes=0` du cluster privé et n'a pas empêché les tests.

L'arrêt fast est confirmé dans `stop.log` ; `pg_ctl status` dit
`no server running`, la socket privée est absente et aucun processus du
cluster n'est constaté. Captures services, disponibilité PostgreSQL 5432 et
sockets : `cmp` identiques avant/après. PostgreSQL de production accepte
toujours les connexions. Preuves conservées, aucune relance.

La réception démontre seulement les scénarios synthétiques v17. Elle ne
valide ni fournisseur réel, ni preuve externe HMAC, ni livraison exactement
une fois, ni révocation atomique après la validation finale, ni navigateur,
ni migration de production. Le bundle v17 et son manifeste restent figés.
