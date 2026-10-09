# Journal d’exécution — Laboratoire dentaire

ROADMAP.md reste la source canonique des statuts. Ce journal contient les interventions depuis l’initialisation Git ; les audits antérieurs sont conservés dans l’annexe de ROADMAP.md. Aucun contenu patient ni secret.

## 09/10/2026 — Session 12:49 Europe/Brussels — Point 2.2

- État initial : Remote en ligne, UID/GID 1002 ; Git main propre, HEAD et main distant 6d01a90e06d4aa5f9f8ebb7f972c4534efb9b228 ; cinq documents suivis, aucun code/migration. Références inchangées ; 2.1 validé, 2.2 bloqué.
- Preuves directes : unité dental-ai-remote.service active/enabled sous dental-ai ; cgroup dédié, 1 Gio/50% CPU/100 tâches ; capacités nulles, NoNewPrivs=1, /proc hidepid=invisible, /proc/1/status non accessible au test de métadonnées ; unité root:root 644 non éditable. Réseau local non isolé démontré, sockets non filtrés par ProtectSystem. Détails et preuves administrateur attribuées dans ROADMAP.md.
- Décision : clôturer l’audit 2.2, conserver les limites et l’approbation de solution ouverte à 2.3 ; ne pas sonder les voisins ni modifier le service. Point 5.1 préparé par l’utilisateur mais à auditer lorsqu’éligible.
- Fichiers modifiés : ROADMAP.md et ce journal (création requise après initialisation Git).
- Vérifications : comparaison hashes/documentation, assertions UID/cgroup/quotas, structure des 217 points et 244 cas, diff ciblé, absence de secrets. Résultats : contrôles ci-dessus réussis, diff --check réussi ; aucune autre ressource modifiée.
- Git : commit de traçabilité lié à cette entrée consultable dans Git ; hash/push final consignés lors du prochain compte rendu, jamais inventés avant exécution.
- Risques : réseau/IPC et ressources hôte partagés, pas de garantie tous chemins/tous sockets ; R02 reste ouvert pour approbation de 2.3.
- Statut final : TERMINÉ (audit 2.2). Suite : 2.3.

## 09/10/2026 — Même session — Point 2.3

- Confirmation Git 2.2 : commit 53540f67786ea4ce52ef3fa87755c19f9b69e4fa poussé sur main ; git ls-remote retourne le même hash, arbre propre. Vérifications documentaires et quotas passées, commandes terminées code 0.
- État initial : unité et frontières décrites à 2.2, systemd 257.13 ; podman/docker/pasta/slirp4netns non disponibles dans le PATH vérifié.
- Travail : comparaison utilisateur seul, confinement systemd existant, conteneur rootless et VPS séparé ; proposition B préparée avec périmètre et limites explicites dans ROADMAP.md.
- Critère/raison d’arrêt : ROADMAP 2.3 exige solution explicitement approuvée pour accès IA ; acceptation du mode actuel et de ses limites réseau/IPC à confirmer par propriétaire. Aucun choix utilisateur inventé.
- Modifications : ROADMAP.md et ce journal seulement ; ni changement de service ni nouveau droit. Pas d’installation ni de sonde interprojets.
- Vérifications : quatre options présentes, preuves directes séparées des scénarios, critères/statuts et invariants documentaires ; diff limité et contrôle de secrets.
- Git 2.3 : changements de documentation attribuables, non commités/non poussés en attente de décision. Pas de hash de commit 2.3 inventé.
- Statut : BLOQUÉ (décision). Risque R02 ouvert ; prochaine action : intégrer approbation explicite, réauditer et passer 2.4 seulement après validation.

## 09/10/2026 — 13:31 Europe/Brussels — Clôture du point 2.3

- Décision utilisateur explicite : maintien du confinement systemd actuel pendant développement ; conditions intégrales dans ROADMAP.md. Pas d’autorisation de production, données médicales réelles ou changement global.
- Reprise contrôlée : UID/GID 1002, cgroup dédié, quotas 1 Gio/50% CPU/100 tâches, NoNewPrivs=1 et capacités nulles, protections actuelles inchangées ; Remote en ligne.
- État Git initial : deux changements 2.3 attribuables de la session précédente, hashes concordants ; références sources inchangées. Aucun changement étranger.
- Fichiers modifiés : ROADMAP.md et ce journal ; aucun service/permission/paquet/migration.
- Validation : critère d’approbation explicite satisfait pour développement ; risques réseau/processus/IPC/disque/IO partagés conservés, réévaluation avant production imposée. Invariants/diff/check secrets à réussir avant commit.
- Git : commit ciblé de 2.3 après contrôles ; hash/push réels enregistrés dans le compte rendu suivant.
- Statut final : TERMINÉ. Suite : 2.4, sans nouveau droit ni reconfiguration automatique.

## 09/10/2026 — Session 13:31 Europe/Brussels — Point 2.4

- Commit 2.3 confirmé : 794af590335ab012ae66ab34f05022c65323efa1, poussé sur main ; hash distant identique, arbre propre avant 2.4.
- Audit : UID 1002, service/cgroup dédiés, chemins RDC inchangés, lecture autorisée dans projet et refus explicite de read_file hors chemins sur /proc/self/status. Aucun contenu refusé obtenu ensuite.
- Cwd initial terminal dans répertoire npm du HOME dédié : contrôle supplémentaire exact-cwd a quitté code 1 sans écriture ; cause établie et exigence plus stricte distinguée du critère roadmap. Test du garde-fou habituel id/cd/pwd réel réussi ; toutes opérations projet s’y soumettent.
- Statut : DÉJÀ CONFORME dans le mode de développement 2.3. Aucune reconfiguration ni credential debian. Les restrictions d’API ne constituent pas une isolation générale des commandes.
- Fichiers : ROADMAP.md et ce journal ; diff/invariants/check secrets avant commit ciblé.
- Git : commit de rapport 2.4 après contrôles ; résultat réel enregistré ensuite. Suite : 2.5, seulement dental_lab et lecture seule.

## 09/10/2026 — Session 13:31 Europe/Brussels — Point 2.5

- Commit 2.4 réel confirmé : 619a8cba8284577008d11af7840680b1c03345a2 poussé, hash distant égal, arbre propre avant audit.
- Audit exécuté exclusivement sur dental_lab en transaction READ ONLY sous dental-ai ; PostgreSQL 17.11, rôles NOLOGIN existants, audit sans droits élevés/CREATE/TEMP, appartenance uniquement audit sans ADMIN OPTION. Détails dans ROADMAP.md.
- Précontrôle HBA : SELECT pg_hba_file_rules non autorisé ; pas de rôle pg_read_all_settings/pg_read_server_files. Aucune lecture HBA/fichier serveur, aucun contournement ni demande d’élargissement.
- Preuves administrateur de refus sur huit autres bases déjà reçues ; pas de connexion ni nouveau test agent sur elles.
- Statut final : BLOQUÉ. Manque : rapport administrateur expurgé sur règles HBA réellement applicables au couple dental-ai/dental_lab, configuration en vigueur.
- Modifications : ROADMAP.md et journal seulement ; aucune écriture SQL, aucun service/permission/paquet/migration.
- Vérifications : audit SQL achevé avec code 0, invariants et diff ciblé sans secret ; suivi 2.5 non commité/non poussé en attente de preuve.
- Suite : reprise 2.5 après preuve ciblée, puis 2.6 ; aucun point sauté.

## 09/10/2026 — 13:50 Europe/Brussels — Clôture du point 2.5

- Rapport HBA administrateur reçu : règle local dental_lab/dental-ai peer puis rejets local et loopbacks pour dental-ai avant règles générales ; fichier configuré, aucune erreur, service actif. Rapport attribué à l’utilisateur ; pas de lecture du fichier par l’agent.
- Reprise directe : UID/GID 1002, cgroup dédié, références et changements 2.5 concordants ; connexion lecture seule à dental_lab sous dental-ai réussie, pg_conf_load_time identique à date administrateur 2026-10-09 03:15:24.346768+00.
- Limite : vue HBA = fichier courant, pas mémoire ; date seule insuffisante à prouver absence d’édition après reload. Preuves interprétées conjointement avec succès direct et refus antérieurs reçus, sans tests TCP/voisins inventés.
- Critères inventaire/rôles/privilèges/HBA/refus satisfaits. Fichiers modifiés : ROADMAP.md et journal seulement ; aucune permission/configuration/base/service changé.
- Validation : invariants, diff ciblé/check secrets et whitespace avant commit ; pas de test redondant vers autres bases.
- Git : commit de clôture 2.5 après contrôles, hash/push réels consignés ensuite.
- Statut final : TERMINÉ. Suite : 2.6, contrôle de procédure de migrations distincte du compte d’audit.
