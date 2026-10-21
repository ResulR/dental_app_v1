# 16.6 — Validation PostgreSQL réelle, distincte des preuves historiques

État au 21 octobre 2026 : **proposition non exécutée**. Le binaire PostgreSQL 17 est installé, `dental-ai` n'a pas de droits administrateur, et l'espace disponible sur /dev/sda1 est suffisant selon la lecture du jour. Ces faits ne valident ni l'installation d'un nouvel environnement ni la concurrence. Ne pas utiliser la base de production, la socket /var/run/postgresql, les images v1/v2/v3 ou la recette v4.

## Enveloppe à réceptionner

- Nouvelle racine privée `/srv/dental-lab/.local/delivery-batch-v5` (absente avant création), propriétaire `dental-ai`, mode 0700 ; PostgreSQL 17 en écoute Unix **uniquement** dans une socket 0700 sous cette racine, port 55435, `listen_addresses=''`.
- État initial et final documentés : Git/empreintes, PID/états de `nginx`, `postgresql`, `dental-site`, `dental-ai-remote`, et sockets Unix visibles, `pg_isready` production, cgroup mémoire/pids, espace libre, absence de processus/socket v5. Vérifier chaque précondition avant toute création. Pas de réutilisation d'une racine portant un marqueur d'essai.
- Paramètres proposés : `max_connections=10`, `shared_buffers=32MB`, `work_mem=2MB`, `maintenance_work_mem=16MB`, `max_worker_processes=0`, `max_parallel_workers=0`, `autovacuum=off`, `fsync=on`, `synchronous_commit=on`, `full_page_writes=on`. Le runner de qualité 90 s et ses seuils mémoire/CPU ne doivent pas être relevés.
- Sur base **neuve et vérifiée vide**, appliquer les migrations nécessaires en tant que rôle migrateur isolé, puis `0022_delivery_batch_receipts.sql`. Installer uniquement des comptes, cliniques, références, versions et commandes synthétiques. La fixture charge `0002` à `0013` dans l'ordre puis `0022` : les tables commandes/versions/logistique (`0004`), blocages (`0004`), demandes et liens (`0005`), fichiers (`0006`), conversations (`0007`), événements/audit (`0008`), droits applicatifs (`0010`) et sessions bornées (`0011`) couvrent les accès du dépôt de livraison. Les migrations `0014` à `0021` concernent d'autres domaines et ne sont pas utilisées par ce parcours. La migration `0022` limite l'UPDATE applicatif à `result`, refuse la réécriture après finalisation et interdit un reçu `pending` au commit. Vérifier les droits effectifs de `dental_lab_app` et l'absence de modification d'audit. Conserver les journaux et l'image en cas d'échec.

## Scénarios obligatoires (deux connexions PostgreSQL distinctes au minimum)

1. Lot de deux commandes terminées : confirmer les deux révisions, le même horodatage de sortie, les modes, l'auteur, les événements d'état/logistique, les audits et un reçu lisible par son auteur. Vérifier qu'aucune intention de courrier clinique n'est créée.
2. Lot mixte (statut changé), version périmée, blocage catalogue/fichier/sécurité/demande pendante : zéro commande livrée, zéro événement et zéro reçu conservé ; les anciennes valeurs restent identiques.
3. Même clé et même charge simultanément : un seul commit, les deux appels renvoient le reçu identique. Même clé avec charge différente : refus et aucun nouveau changement.
4. Deux clés avec commandes communes en ordre inverse : absence de double livraison et de deadlock ; le perdant reçoit un conflit. Suspendre volontairement une transaction après verrouillage et constater `pg_stat_activity.wait_event_type='Lock'` avant de la libérer.
5. Erreur SQL injectée après la première écriture : rollback intégral de la livraison, de la logistique, des événements, de l'audit et du reçu. Simuler une réponse client perdue **après commit** : consultation du reçu sans rejouer la livraison.
6. Rôle clinique sans `delivery.mark_delivered` : refus de livraison et de lecture du reçu d'un autre auteur avant écriture. Vérifier sous `dental_lab_app` les droits de SELECT/INSERT, l'interdiction de DELETE et l'absence d'UPDATE/DELETE sur l'audit ; tentative d'UPDATE d'un reçu finalisé, INSERT direct finalisé et COMMIT d'un reçu pending doivent échouer.

Couverture effective de ce script : 16.6 uniquement, sous données synthétiques ; catalogue interdit, demande pendante, blocage de sécurité, fichier non prêt, révision et version périmées, statut mixte, rollback injecté, consultation après commit, et deux verrous concurrents sont exécutés. Les tests de correction 16.7 avec/sans retouche, l'archive J+30 entre deux cliniques et le refus d'un admin sans permission ne figurent **pas** dans cette recette et nécessitent des validations distinctes. Le stockage réel des fichiers et PostgreSQL de production ne sont pas testés.

## Critères d'arrêt et sortie

Tout écart de privilège, de garde d'identité, de mémoire, de couverture d'un élément du lot, de version, de statut, de rollback, de verrouillage ou de services de production arrête l'essai. Arrêter **uniquement** le processus v5 par son PID/pg_ctl propre à la nouvelle racine ; ne supprimer aucun fichier de preuve. Comparer services, sockets et PostgreSQL de production avant/après. La fixture synthétique et le lanceur `tests/postgres/run-delivery-batch-v5.sh` sont versionnés pour examen statique. Ils ne sont pas une preuve PostgreSQL : la réception doit vérifier leurs empreintes, leurs gardes et leurs ressources, puis autoriser séparément l'exécution. Les tests Vitest actuels restent des doubles transactionnels. Le contrôle global de formatage exclut explicitement les deux scripts historiques `scripts/linked-works-postgres-v2.mjs` et `scripts/linked-works-postgres-v3.mjs` via `.prettierignore` : leurs empreintes figées sont préservées. Tous les autres fichiers restent contrôlés ; l'écart de formatage découvert dans l'interface de livraison groupée est corrigé séparément.

## Commandes proposées après réception du diff et des empreintes (ne pas exécuter maintenant)

Depuis la session `dental-ai` du VPS, sans sudo :

```bash
cd /srv/dental-lab
git status --short --branch
printf '%s\n' \
 'f1aeb1bc7dc2ee00e93418e891e0dab571cf9202d41e5997b0507671e5f96084  tests/postgres/run-delivery-batch-v5.sh' \
 '29f680d5b6605ccd2bac15f2669a79d9169c26574389466430fcc4a632ecafd8  tests/postgres/delivery-batch-v5-fixture.sql' \
 'ddc4155f6c9b92ed9f4f53acfcf41c497d6636dc17a545609bf10eac72b4c64f  tests/postgres/delivery-batch-v5.mjs' \
 'e259575c72f6c9b84aca172bcbdbcd7a67f5245f18f1902a926d33118e838cd4  migrations/0022_delivery_batch_receipts.sql' | sha256sum -c -
test ! -e /srv/dental-lab/.local/delivery-batch-v5
DENTAL_BATCH_V5_APPROVED=private-unix-socket-one-shot /bin/bash tests/postgres/run-delivery-batch-v5.sh
```

Risques : consommation temporaire de mémoire/CPU/disque sur le VPS partagé, verrou d'essai ne couvrant que l'instance v5, échec possible des migrations/fixtures et comparaison avant/après des sockets sensible à une activité externe. Le `trap` tente l'arrêt sur sortie normale, erreur, SIGINT et SIGTERM, avec délai borné et contrôle de la socket/du PID ; SIGKILL, OOM ou panne de l'hôte ne peuvent garantir l'exécution d'un `trap` : dans ces cas, ne pas relancer et contrôler manuellement la racine v5, son PID et sa socket avant toute autre action. Le lanceur refuse les ressources insuffisantes et conserve la racine, les marqueurs et les journaux même en cas d'échec ; il ne doit jamais être relancé sur une racine déjà créée. Résultat attendu : `real-postgres-batch-passed`, puis `V5_SQL_OK_STOPPED` dans `.local/delivery-batch-v5/ok`, production accessible et services/sockets identiques. Aucun de ces résultats n'est actuellement revendiqué.
