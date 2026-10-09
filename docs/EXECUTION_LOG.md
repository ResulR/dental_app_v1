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
