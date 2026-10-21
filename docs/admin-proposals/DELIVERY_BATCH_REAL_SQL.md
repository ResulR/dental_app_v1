# 16.6 — Validation PostgreSQL réelle, distincte des preuves historiques

État au 21 octobre 2026 : **proposition non exécutée**. Le binaire PostgreSQL 17 est installé, `dental-ai` n'a pas de droits administrateur, et l'espace disponible sur /dev/sda1 est suffisant selon la lecture du jour. Ces faits ne valident ni l'installation d'un nouvel environnement ni la concurrence. Ne pas utiliser la base de production, la socket /var/run/postgresql, les images v1/v2/v3 ou la recette v4.

## Enveloppe à réceptionner

- Nouvelle racine privée `/srv/dental-lab/.local/delivery-batch-v5` (absente avant création), propriétaire `dental-ai`, mode 0700 ; PostgreSQL 17 en écoute Unix **uniquement** dans une socket 0700 sous cette racine, port 55435, `listen_addresses=''`.
- État initial et final documentés : Git/empreintes, PID et sockets des services existants, `pg_isready` production, cgroup mémoire/pids, espace libre, absence de processus/socket v5. Vérifier chaque précondition avant toute création. Pas de réutilisation d'une racine portant un marqueur d'essai.
- Paramètres proposés : `max_connections=10`, `shared_buffers=32MB`, `work_mem=2MB`, `maintenance_work_mem=16MB`, `max_worker_processes=0`, `max_parallel_workers=0`, `autovacuum=off`, `fsync=on`, `synchronous_commit=on`, `full_page_writes=on`. Le runner de qualité 90 s et ses seuils mémoire/CPU ne doivent pas être relevés.
- Sur base **neuve et vérifiée vide**, appliquer les migrations nécessaires en tant que rôle migrateur isolé, puis `0022_delivery_batch_receipts.sql`. Installer uniquement des comptes, cliniques, références, versions et commandes synthétiques ; vérifier les droits de `dental_lab_app` sur reçus et l'absence de privilèges de modification d'audit. Conserver les journaux et l'image en cas d'échec.

## Scénarios obligatoires (deux connexions PostgreSQL distinctes au minimum)

1. Lot de deux commandes terminées : confirmer les deux révisions, le même horodatage de sortie, les modes, l'auteur, les événements d'état/logistique, les audits et un reçu lisible par son auteur. Vérifier qu'aucune intention de courrier clinique n'est créée.
2. Lot mixte (statut changé), version périmée, blocage catalogue/fichier/sécurité/demande pendante : zéro commande livrée, zéro événement et zéro reçu conservé ; les anciennes valeurs restent identiques.
3. Même clé et même charge simultanément : un seul commit, les deux appels renvoient le reçu identique. Même clé avec charge différente : refus et aucun nouveau changement.
4. Deux clés avec commandes communes en ordre inverse : absence de double livraison et de deadlock ; le perdant reçoit un conflit. Suspendre volontairement une transaction après verrouillage et constater `pg_stat_activity.wait_event_type='Lock'` avant de la libérer.
5. Erreur SQL injectée après la première écriture : rollback intégral de la livraison, de la logistique, des événements, de l'audit et du reçu. Simuler une réponse client perdue **après commit** : consultation du reçu sans rejouer la livraison.
6. Rôle clinique ou admin dépourvu de `delivery.mark_delivered` : refus avant toute lecture du reçu d'un autre auteur et avant toute écriture. Vérifier également la correction 16.7 avec/sans retouche liée et l'archive J+30 sous deux cliniques.

## Critères d'arrêt et sortie

Tout écart de privilège, de garde d'identité, de mémoire, de couverture d'un élément du lot, de version, de statut, de rollback, de verrouillage ou de services de production arrête l'essai. Arrêter **uniquement** le processus v5 par son PID/pg_ctl propre à la nouvelle racine ; ne supprimer aucun fichier de preuve. Comparer services, sockets et PostgreSQL de production avant/après. La fixture synthétique et le lanceur `tests/postgres/run-delivery-batch-v5.sh` sont versionnés pour examen statique. Ils ne sont pas une preuve PostgreSQL : la réception doit vérifier leurs empreintes, leurs gardes et leurs ressources, puis autoriser séparément l'exécution. Les tests Vitest actuels restent des doubles transactionnels.

## Commandes proposées après réception du diff et des empreintes (ne pas exécuter maintenant)

Depuis la session `dental-ai` du VPS, sans sudo :

```bash
cd /srv/dental-lab
sha256sum tests/postgres/run-delivery-batch-v5.sh tests/postgres/delivery-batch-v5-fixture.sql tests/postgres/delivery-batch-v5.mjs migrations/0022_delivery_batch_receipts.sql
test ! -e /srv/dental-lab/.local/delivery-batch-v5
DENTAL_BATCH_V5_APPROVED=private-unix-socket-one-shot /bin/bash tests/postgres/run-delivery-batch-v5.sh
```

Risques : consommation temporaire de mémoire/CPU/disque sur le VPS partagé, verrou d'essai ne couvrant que l'instance v5, échec possible des migrations/fixtures et comparaison avant/après des sockets sensible à une activité externe. Le lanceur refuse les ressources insuffisantes et conserve la racine, les marqueurs et les journaux même en cas d'échec ; il ne doit jamais être relancé sur une racine déjà créée. Résultat attendu : `real-postgres-batch-passed`, puis `V5_SQL_OK_STOPPED` dans `.local/delivery-batch-v5/ok`, production accessible et services/sockets identiques. Aucun de ces résultats n'est actuellement revendiqué.
