# Proposition de réception PostgreSQL v17 — verrou identifié

**Non exécutée. Autorisation explicite séparée requise.** v16 bloquée et
figée ; v12–v15 historiques intacts. Bundle v17 autonome dans des fichiers
neufs ; 248 entrées SHA-256 uniques. SHA-256 du manifeste :
`c92ff71ea9b8db4664f14bc1b1a026270b36edfb1de4d858690c746ff97c5bab`.

La fixture synthétique charge les migrations nécessaires depuis ce commit
dans un cluster neuf ; aucun dossier de recette historique n'est lu.
Assertions reprises de v16 : sélection/claim concurrent, révocations
commitées de catégorie/grant/clinique/révision entre prévol et autorisation,
bail expiré et récupération ambiguë sans renvoi, privilèges refusés, appel
fictif empêché, frontière d'une révocation non commitée.

Pour la suspension concurrente, le test relève séparément les PID du client
d'autorisation et de l'administrateur, vérifie qu'ils diffèrent, démarre
l'autorisation après UPDATE du compte sous transaction administrateur,
interroge `pg_stat_activity` depuis un troisième client, exige simultanément
état actif, attente `Lock`, début distinctif de la requête d'autorisation et
présence du PID administrateur dans `pg_blocking_pids` **avant** commit.
Délai d'observation maximal 2,5 s ; `lock_timeout=3s` et
`statement_timeout=8s` dans la transaction du rôle applicatif ; les issues
de la promesse sont capturées immédiatement. Après commit, le test exige
`cancelled` et l'état SQL annulé. Absence d'observation, timeout, erreur ou
mauvais résultat échoue et conserve les preuves. Un VPS chargé peut provoquer
un échec conservateur ; ne pas relancer la recette à usage unique.

Runner : UID 1002, hôte et cgroup dental-ai-remote.service exacts, CPU 50 %,
mémoire 1 Gio, 100 tâches, marges avant démarrage, Git propre, SHA vérifiés et
répertoire `.local/notifications-v17` absent. Port **55447** uniquement sur
socket Unix privée 0700, `listen_addresses=''`, HBA reject hors postgres
mappé par peer. `initdb`, démarrage, fixture et Node ont des timeouts.
Trap EXIT/INT/TERM arrête en mode fast puis compare services, PostgreSQL de
production et sockets. SIGKILL/panne de l'hôte ou arrêt impossible demandent
une inspection indépendante ; aucune garantie absolue d'arrêt. Aucun secret,
destinataire réel ni transport externe. Aucun lancement automatique.

Préflight en lecture seule après commit :

```bash
cd /srv/dental-lab
git status --short --branch
sha256sum tests/postgres/notifications-v17.sha256
sha256sum -c tests/postgres/notifications-v17.sha256
bash -n tests/postgres/run-notifications-v17.sh
node --check tests/postgres/notifications-v17.mjs
python3 -m unittest tests/migrations/test_dormant_delivery_v17_static.py
test ! -e .local/notifications-v17
/usr/lib/postgresql/17/bin/pg_isready -h /var/run/postgresql -p 5432
```

Commande préparée, **interdite sans autorisation séparée** :

```bash
cd /srv/dental-lab
DENTAL_NOTIFICATIONS_V17_APPROVED=private-unix-socket-one-shot bash tests/postgres/run-notifications-v17.sh
```

Attendu et non constaté : `real-postgres-dormant-delivery-v17-passed`,
`V17_SQL_OK_STOPPED`, socket disparue, cluster arrêté et états externes
identiques. Ne pas retenter si un échec crée le dossier ; conserver journaux et
marqueurs puis examiner indépendamment. Une réussite ne validerait ni
fournisseur réel, ni provenance d'une preuve d'acceptation, ni borne de
révocation après autorisation, ni livraison exactement une fois.
