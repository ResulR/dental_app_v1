# Audit indépendant statique PostgreSQL v17 — 27 octobre 2026

## Portée et verdict

**Conforme sur le plan statique, avec réserves d'exécution.** La recette v17 n'a pas été exécutée : aucune assertion PostgreSQL v17 n'est réceptionnée. Aucun bundle v18 n'est justifié par les défauts observés. Le document de réception figé et les bundles v12–v17 restent inchangés.

Dépôt `/srv/dental-lab`, main initial `76b7648`, arbre propre et `origin/main` à ce commit (contrôle `ls-remote`). Références : `CAHIER_DES_CHARGES.md`, `ROADMAP.md` (§14.2 et matrice CTQ), `ARCHITECTURE_ADAPTEE.md`, `CONSIGNE.md`, `docs/CONTRACTS.md`, `docs/INFRASTRUCTURE_GUARDS.md`, `docs/EMAIL_PROVIDER_CONTRACT_PROPOSAL.md`, `docs/DORMANT_EMAIL_DELIVERY.md`, `docs/admin-proposals/DORMANT_DELIVERY_V16_STATIC_REVIEW.md` et `DORMANT_DELIVERY_V17_RECEPTION.md`.

## Intégrité et périmètre

Manifeste `tests/postgres/notifications-v17.sha256` : 248 lignes, 248 chemins uniques, 248 fichiers ordinaires existants, aucune composante `..`, chemin absolu ou lien symbolique dans leurs composants. Les 248 SHA-256 de contenu concordent. SHA-256 du manifeste : `c92ff71ea9b8db4664f14bc1b1a026270b36edfb1de4d858690c746ff97c5bab`. Il couvre fixture, scénario, runner, 13 migrations, sources et sorties compilées nécessaires ; aucune référence de runtime à un script ou dossier de recette v12–v16. La fixture importe les migrations depuis le dépôt à ce commit. Les dépendances Node transitives viennent de `node_modules` et du `package-lock.json` figé ; leur installation préalable n'est pas une preuve de chaîne d'approvisionnement. Le runner vérifie les octets au départ, mais ne rend pas les fichiers immuables contre une modification concurrente par le même UID : exécuter exclusivement dans une fenêtre contrôlée.

Le code compilé `dist` est couvert par le manifeste ; les sources correspondantes le sont également. Le contrôle de compilation et de divergence après les changements HMAC ne doit pas régénérer ou modifier les octets figés v17. L'ajout HMAC de cette session est hors manifeste.

## Isolation et arrêt

Runner lu sans lancement : garde hostname/UID 1002/cgroup exact, plafonds CPU 50 %, 1 Gio, 100 tâches ; marges avant démarrage ; Git propre ; cible `.local/notifications-v17` absente ; contrôles SHA avant et après création. `.local` est un répertoire privé 0700 du même UID. Cluster distinct `pgdata`, socket privée 0700, port 55447, `listen_addresses=''`, HBA peer postgres via map locale et rejet des autres accès. Production constatée en écoute sur 127.0.0.1:5432 ; aucun service n'a été modifié. Fixture vérifie base, version, data_directory et port avant import. Logs et marqueurs restent sous la cible privée ; aucun `rm -rf` ou nettoyage hors cible. Le trap EXIT/INT/TERM tente l'arrêt fast, constate le statut et compare captures services, production et sockets. Chaque phase initdb, démarrage, psql et Node a un timeout ; `lock_timeout=3s` et `statement_timeout=8s` bornent la transaction applicative.

Réserves : SIGKILL, panne de l'hôte ou échec d'arrêt peuvent laisser un processus ; contrôle administratif indépendant nécessaire avant tout nouveau départ. Le snapshot global `ss -xl` et les PID des services peuvent varier sous activité étrangère et donner un échec conservateur. Le runner ne supprime pas les preuves ; pas de relance automatique, ni de nettoyage dangereux. La garde de cgroup borne la charge sous le service partagé, mais n'isole pas matériellement le VPS des autres applications.

## Concurrence

`app(a)` utilise directement le même `pg.Client` pour `BEGIN`, `SET LOCAL ROLE`, la requête de contrôle et `COMMIT` ; aucun pool ou acquisition implicite. `pg_backend_pid()` est demandé sur `a` avant `queueA.authorize(lockedLease)` ; PID administrateur obtenu sur le client `admin` et distinction vérifiée. L'administrateur commence une transaction, suspend par UPDATE le compte cible et garde la transaction ouverte. Le client `b` observe la ligne `pg_stat_activity` du PID `a` et exige simultanément état actif, attente `Lock`, préfixe de la requête SQL de validation du destinataire et inclusion du PID administrateur dans `pg_blocking_pids(pid)`, avant le COMMIT administrateur. Cette relation dépasse le seul indicateur `wait_event_type`. Après commit, l'issue capturée immédiatement de la promesse est exigée `cancelled`, puis la livraison `cancelled` est relue. Une erreur SQL, un timeout, `lost` ou un résultat admissible à l'envoi échoue.

La fenêtre de 2,5 s avec sondage 25 ms est une borne d'observation, non une preuve fondée sur un sommeil. Une machine chargée peut produire un faux négatif ; le test ne prouve rien lorsqu'il échoue. `pg_blocking_pids` peut contenir plusieurs PID ; `includes` établit l'implication du PID attendu, sans prétendre qu'il est l'unique bloqueur ou prouver tous les verrous indirects. L'UPDATE et `FOR SHARE OF ... a` rendent la causalité plausible ; la preuve SQL finale reste soumise à l'exécution autorisée. La promesse est capturée sur les deux issues ; en cas d'échec d'observation, ROLLBACK libère le verrou, puis la promesse se termine ou le statement timeout intervient. L'arrêt externe borne également un blocage imprévu.

## HMAC et frontières restantes

Le helper dérive des clés différentes par livraison, tentative et version ; la vérification utilise uniquement le secret historique de la version enregistrée. Ces propriétés sont testées avec doubles, sans stockage. L'ancien noyau acceptait un objet JSON auto-déclaré `verified_acceptance` si la clé correspondait. Le noyau exige désormais un vérificateur injecté avant de retourner `accepted` ; en son absence ou si le vérificateur refuse, il garde `manual_review`. Une exception du vérificateur échoue sans acceptation. Ce callback est une frontière de confiance à implémenter et auditer, pas une authentification fournisseur en soi ; un appelant malveillant peut encore injecter `() => true`. Aucun worker/runtime n'importe ce module de réconciliation.

Avant une intégration : enregistrer de façon transactionnelle livraison, numéro de tentative, version, clé exacte, état de remise et références de preuve ; définir un adaptateur fournisseur authentifié avec compte, clé, tentative, identifiant et statut corrélés, preuve brute privée et horodatage ; conserver les anciens secrets tant que des tentatives sont réconciliables ; définir accès, rétention, révocation, procédure humaine et borne temporelle. `not_found`, rejet et indisponibilité ne prouvent pas une absence définitive d'acceptation et n'autorisent aucun renvoi automatique. Un commit de révocation après l'autorisation peut toujours précéder l'acceptation externe ; aucune livraison exactement une fois n'est démontrée.

## Statuts

- v17 : préparée, intégrité vérifiée, audit statique favorable ; exécution isolée et réception **en attente d'autorisation distincte**.
- HMAC : logique pure et tests hors PostgreSQL ; persistance, provenance fournisseur et politique de révocation **bloquées** avant activation.
- Production : aucune migration, déploiement, activation de worker ni émission de courrier.
