# Revue indépendante v16 — 26 octobre 2026

Verdict : **v16 bloquée** pour la preuve de révocation concurrente revendiquée.
Aucune instance PostgreSQL v16 exécutée. À 9576d70, Git était propre et
synchronisé. Le manifeste réellement présent a 248 chemins uniques et son
SHA-256 est `83cba08558fc5d9c20b25f8c21374539bbf511eee72cfc4248786968fd08c9ee`.
Les 248 octets référencés concordaient. Le document de réception indiquait par
erreur le SHA du manifeste v15 ; seul ce document non inclus au bundle a été
corrigé. Bundle v16 et manifeste inchangés.

Le runner vérifie hôte/UID 1002/cgroup, CPU 50 %, mémoire 1 Gio, 100 tâches,
marges disponibles, Git propre et absence du répertoire cible. Port 55446,
socket Unix privée 0700, TCP désactivé, authentification locale restrictive.
Fixture synthétique sous `.local/notifications-v16`, migrations et dist
inclus dans le manifeste, aucune lecture des recettes v12–v15. Timeouts
initdb/pg_ctl/psql/Node, transactions avec statement_timeout 8 s et
lock_timeout 3 s. Trap EXIT/INT/TERM : arrêt fast, vérification de l'absence
de socket et comparaison services/production/sockets ; preuves conservées
sur échec. SIGKILL, panne hôte ou arrêt impossible demandent un constat
administrateur ; le trap ne peut pas garantir ces cas.

Le client `a` détermine son PID par `pg_backend_pid()` puis lance
`queueA.authorize`. Le client `b` observe `pg_stat_activity` jusqu'à
`wait_event_type='Lock'` avant que `admin` ne commit sa suspension.
Le délai 2,5 s évite une attente infinie ; la suite attend le refus et la
clôture annulée. Mais le test ne vérifie ni `pg_blocking_pids` ni le PID de
`admin`, et ne lie pas cette attente à la requête de contrôle de destinataire.
Une autre attente pourrait donner un faux positif. Une promesse qui rejette
avant son `await` différé peut aussi devenir une rejection non gérée. Le
bundle v17 distinct lie le bloqueur exact et capture immédiatement les deux
issues de la promesse. Ce correctif est statique, non réceptionné sur PG.

Autres assertions proposées : révocations commitées de catégorie, grant,
clinique et révision entre deux contrôles ; expiration du bail, récupération
ambigüe sans renvoi, privilèges négatifs, absence d'appel fictif lors de
révocation ; configuration non commitée explicitement hors garantie.
L'observation SQL réelle de ces scénarios reste à faire dans la version
distincte. Le noyau HMAC ne prouve aucune authentification fournisseur ;
la version du secret historique, sa conservation et une preuve d'origine
vérifiable sont indispensables avant activation. Aucune livraison exactement
une fois ni révocation instantanée n'est revendiquée.
