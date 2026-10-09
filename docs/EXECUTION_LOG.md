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

## 09/10/2026 — Session 13:50 Europe/Brussels — Point 2.6

- Commit 2.5 confirmé : 502ceb08dcad21d2645df0009339c3e06a3568e9 poussé et égal au main distant ; arbre propre initial.
- Inventaire projet : six documents hors .git, aucun runner/migration ; audit SQL READ ONLY dental_lab terminé code 0.
- Rôle migrator : NOLOGIN, CONNECT dental_lab et USAGE/CREATE public oui, CREATE base non ; aucune identité LOGIN membre. dental-ai seulement membre d’audit, ni migrator ni owner, sans sudo selon preuve reçue.
- Blocage : aucune invocation autorisée/authentifiable des migrations établie. Pas de SET ROLE/DDL/GRANT/secret/commande sous identité plus privilégiée tenté.
- Préparation : contrat de mécanisme borné à dental_lab, identité distincte, protection du lanceur, secrets minimaux, revue/versionnement et sauvegarde/rollback selon risque détaillés dans ROADMAP.md ; proposition, pas implémentation validée.
- Action attendue : administrateur fournit ou prépare mécanisme contrôlé et contrat d’invocation réel ; aucun élargissement du compte audit demandé, permissions actuelles conservées.
- Fichiers modifiés : ROADMAP.md et journal. Vérifications invariants/diff/secrets ; aucun code/paquet/permission/service/base modifié.
- Statut final : BLOQUÉ, R03 ouvert ; suivi 2.6 non commité/non poussé. Reprise de 2.6 après mécanisme, 2.7 non commencé.


## 09/10/2026 — 12:33 UTC — Point 2.6, audit terminé/proposition administrateur

- État initial : UID 1002, RDC en ligne, chemin physique autorisé ; deux changements de suivi 2.6 connus et hashes concordants, aucun changement étranger. Compte/role dental-migrate et chemins dédiés absents, outils requis constatés.
- Décision utilisateur : séparation volontaire ; dental-ai reste audit, jamais migrator/owner. Choix proposé : opérateur humain root, copie SQL SHA approuvée, exécutant Linux/SQL distinct peer, rôle LOGIN temporaire puis NOLOGIN, aucune délégation IA.
- Audit SQL supplémentaire dental_lab READ ONLY achevé code 0 : plpgsql seule extension, aucun serveur étranger, aucune fonction SECURITY DEFINER exécutable migrator, aucun attribut administratif audit/migrator.
- Fichiers : ROADMAP.md, ce journal, docs/admin-proposals/POINT_2_6_ADMIN.md, dental-lab-migrate.py, test_migration_gate.py et migrations/0000_execution_probe.sql (SELECT uniquement, pas exécuté en base). Modes projet 600, répertoires nouveaux 700 ; aucune installation système/SQL.
- Vérifications : quatre tests de sécurité passés local/VPS ; syntaxe Python/Bash et cohérence SHA vérifiées ; refus non-root proposé confirmé sous UID 1002 avant tout appel administrateur. Diff/invariants contrôlés avant compte rendu ; aucun résultat d'installation/test PostgreSQL du mécanisme inventé.
- Risques : HBA/reload cluster partagé à faire uniquement administrateur après revue ; restrictions systemd du client ne limitent pas PostgreSQL serveur ; coupure peut laisser LOGIN et état SQL incertain, fermeture contrôlée et .pending interdisent reprise automatique ; revue SQL/backup/rollback selon risque obligatoires.
- Action précise : relire/approuver/exécuter runbook contrôlé, fournir preuves de comptes/modes/HBA/reload/refus/probe/reçu et NOLOGIN/zéro session. Statut final BLOQUÉ, R03 ouvert ; prochaine étape reprendre 2.6, aucun passage 2.7.
- Git : aucun nouveau commit/push ; changements de proposition et suivi restent non commités. Aucune permission PostgreSQL ni délégation IA élargie, aucun service/base voisin consulté/modifié.


## 09/10/2026 13:12 UTC — Point 2.6, révision 2 après revue transactionnelle

- État : RDC en ligne, UID1002/dental-ai, /srv/dental-lab réel, changements 2.6 attribuables/hashes concordants. Script et destinations root non installés. Séparation des rôles conservée ; principe approuvé, installation interdite par instruction utilisateur.
- Défaut confirmé via documentation PostgreSQL17 : -1 sans -c/-f ; première proposition retirée. Correction explicite -c/-f/-c + -1/ON_ERROR_STOP, stdin DEVNULL, SQL exécutant limité.
- Modifications : scripts/docs de proposition dans docs/admin-proposals, deux fixtures DDL synthétiques ajoutées dans migrations ; aucune fixture exécutée en base ; SHA et procédures actualisés ; report VALIDATION_2_6 et manifest SHA256SUMS ; suivi ROADMAP et ce journal.
- Sécurité : parents root protégés et imports isolés ; copie source limitée sans symlinks/FIFO/liens multiples ; snapshots fsync conservés ; précontrôle roles et appartenance ; NOLOGIN/zéro session avant reçu ; pending durable bloque toutes les versions, interruptions/commit incertain nécessitent résolution humaine.
- Vérifications réelles : audit READ ONLY dental_lab terminé code0, CREATE/TEMP false et identité migration absente. 13 tests unitaires passés local/VPS (SQL/admin simulés), 11 blocs Bash/3 Python syntaxiquement valides, checksums/permissions privées vérifiés, refus non-root réel. Intégration réelle ajoutée mais BLOQUÉ code77, aucune DDL ; résultat non assimilé à un succès.
- Risques : atomicité limitée aux effets transactionnels ; defaults/triggers/séquences existantes et appels externes à exclure/revoir ; client systemd distinct de PostgreSQL partagé ; SIGKILL/panne peut laisser LOGIN/session et résultat incertain ; snapshots/rétention à contrôler avant production.
- Git : aucun nouveau commit/push ; point non validé. Statut final BLOQUÉ, R03 ouvert ; prochaine action revue utilisateur des corrections, puis preuve administrateur après autorisation d'installation ; aucun passage à 2.7.


## Clôture du point 2.6 — Révision 3 installée et intégration réelle prouvée

2026-10-10T01:33:55+02:00 [Europe/Brussels, horloge VPS]. Statut : ☑ Validé. Rapport administrateur utilisateur : installation root rev3 SHA256 698472ebcc0ca0f8a1d74151cb7331ecfa9e113d8231f9262b3ba6f535de9ea1, root:root 555, rev2 sauvegardée ; comptes Linux/SQL dédiés et HBA ciblé installés. Probe 0000 identité dental_lab/dental-migrate/dental_lab_migrator et permissions 1 ; contrôle positif 9901 CREATE/INSERT/assertion/DROP ; 9900 CREATE/INSERT puis erreur 22012, rollback sans table persistante. Refus non-root/traversée/SHA erroné réussis. Deux reçus succès, archive rollback-verified et aucun pending ; snapshot/SHA de l'échec contrôlés avant archivage. Preuves administrateur attribuées, pas réexécutées par l'IA.

Vérifications directes de reprise : Remote en ligne sous dental-ai UID1002/cgroup dédié ; /srv/dental-lab propriétaire privé 700 ; lanceur installé SHA exact et root:root 555. Audit dental_lab BEGIN READ ONLY/COMMIT achevé : PostgreSQL17.11, dental-migrate NOLOGIN sans attribut administratif, zéro session ; dental-ai ni migrator ni owner ni CREATE base/public ; deux tables techniques absentes. Services dental-ai-remote, dental-site et postgresql@17-main actifs. Aucun rôle/HBA/lanceur root/service modifié et aucune fixture rejouée.

Concordance source corrigée dans le projet uniquement : source principale et tests alignés sur rev3 validée ; copie temporaire de revue identique retirée pour éviter deux sources concurrentes ; trois SQL et test d'intégration inchangés, versions déjà consommées à ne pas rejouer. Documents de proposition étiquetés historiques, contrat actuel ajouté et SHA actualisés. Tous changements précédents non commités attribuables au seul point2.6.

Autorisation future : chaque SQL ET SHA256 exigent toujours approbation administrateur explicite. Aucun droit permanent de migration/administration pour l'IA. Sauvegarde et retour arrière adaptés obligatoires avant risque matériel ; atomicité démontrée sur ces fixtures transactionnelles uniquement, pas pour séquences/effets externes ni coupure près du commit. Pending reste bloquant et à résoudre humainement ; NOLOGIN n'arrête pas les sessions existantes. Réseau/processus/IPC/CPU/IO serveur partagés, client systemd non assimilé à isolation complète, rétention snapshots et sécurité production à réévaluer ; données médicales réelles toujours interdites avant gates dédiées. R03 : composante migrations résolue, runtime/secrets restent à traiter en2.7–2.8.

Contrôles avant commit : tests unitaires rev3 (appels administrateur simulés uniquement), syntaxe scripts/blocs historiques sans exécution, manifest SHA/diff/check secrets/invariants. Git : commit ciblé puis push main après succès, résultat réel dans compte rendu/journal suivant. Suite :2.7, audit secrets/runtime sans lecture d'un secret ni projet voisin.


## Point 2.7 — Secrets et environnement : préparation puis blocage

2026-10-10T01:35:30+02:00 Europe/Brussels. Commit2.6 confirmé f1d58d4f5de7e22b387ef1e207aff691c452c2cd poussé, HEAD distant identique, arbre propre avant audit2.7. Statut : ⚠ Bloqué.

Audit direct : dental-site.service sous dental-site UID999/GID989, WorkingDirectory=/srv/dental-site/current, EnvironmentFiles=/etc/dental-site/dental-site.env ; protections strict/home/NoNewPrivileges actives, limites ressources runtime non bornées selon propriétés observées, à examiner en2.8. /etc/dental-site root:GID989 0750 sans symlink, agent sans lecture/écriture ; métadonnées enfant protégées non obtenues. Aucun contenu de secret lu. dental_lab_app NOLOGIN sans CONNECT, aucun rôle changé. Projet sans .env réel, gitignore/exemple absents initialement.

Préparation permise effectuée : .gitignore et .env.example sans secret réel ni identité/port HTTP supposé ; docs/ENVIRONMENT.md explique contrat, limites et bloc administrateur de métadonnées seulement. Aucun compte/permission/HBA/service/lanceur root ni chemin runtime modifié. Tests pertinents : syntaxe Bash/Python de procédure sans exécution, exclusions Git effectives, exemple sans secret, diff/whitespace et audit fichiers nouveaux.

Action attendue : administrateur confirmer si le service et /srv/dental-site/current sont le runtime de ce projet, et fournir métadonnées/ACL du fichier environnement plus tests lecture runtime/agent (sans contenu). CONSIGNE §§3/4/8 interdit de contourner les protections ou de supposer le périmètre. Validation secrets privés et cloisonnés non complètement établie ; pas de2.8 avant preuve. Aucun droit supplémentaire demandé ; aucune instruction de migration autorisée. Suivi et préparation2.7 conservés non commités en attente de validation, conformément au protocole ; rapport publié dans chat.


## Point2.7 — Rapport de protection reçu, provenance du runtime non établie

2026-10-10T01:40:06+02:00 Europe/Brussels. Statut conservé : ⚠ Bloqué. Reprise RDC en ligne UID1002/cgroup dédié, /srv/dental-lab réel, HEAD f1d58d4 ; cinq changements2.7 précédents identifiés, aucune modification étrangère. Lecture critères roadmap2.7/2.8, consigne3/4, architecture et mentions runtime du suivi : aucune décision de rattachement dental-site au nouveau projet.

Preuves administrateur utilisateur : service Dental_site backend actif, compte/groupe dental-site, current root:root symlink vers release20260904-e94c64a, runtime/parents root:dental-site0750 ; environnement root:root0600 et droits ACL rw-/---/--- ; agent sans lecture ni traversée ; services concernés actifs. Ces preuves sont attribuées à l’utilisateur, pas réexécutées par l’IA. La protection filesystem est documentée, pas une isolation complète ou une appartenance au nouveau projet.

Correction explicite : ancien critère lecture directe du fichier par dental-site trop strict pour EnvironmentFile d’un gestionnaire système root ; aucune permission à élargir. Documentation primaire systemd consultée. État actif et description ne démontrent ni provenance, ni bonne configuration du futur laboratoire. Release antérieure au cadrage : indice seulement.

Fichier mis à jour : docs/ENVIRONMENT.md, plus ce suivi ROADMAP/journal uniquement. Préparation .gitignore/.env.example conservée sans secret. Procédure précédente de métadonnées remplacée par contrôle conditionnel de provenance Git, lecture seule administrateur sans URL brute, sans réseau ni script projet root ; si métadonnées absentes, preuve de déploiement/attestation projet propriétaire. Tests syntaxe Python/Bash sans exécution, diff/check et critères inchangés à vérifier avant compte rendu.

Action humaine indispensable : déterminer dépôt/commit et projet propriétaire de la release, confirmer rattachement autorisé OU classer dental-site hors périmètre puis décider runtime distinct. Aucun secret à transmettre ; aucun service/rôle/HBA/permission/lanceur root modifié, aucune fixture rejouée. Pas de2.8, aucun commit/push de validation2.7 ; préparations et suivi non commités en attente de preuve/décision.


## Clôture2.7 — Préparation documentaire et runtime indépendant

2026-10-10T01:44:30+02:00 Europe/Brussels. Statut : ☑ Validé (préparation documentaire sans installation). Décision administrateur explicite : nouveau runtime indépendant ; dental-site, son compte, environnement/secrets et /srv/dental-site intégralement exclus. Rapport attribué : packages dental-site/@dental-site/server0.0.0, release préexistante sans provenance Git exploitable ; aucune recherche supplémentaire utile après exclusion. Aucun fait de provenance inventé.

Reprise : RDC en ligne UID1002/cgroup dédié, chemin physique /srv/dental-lab ; HEAD f1d58d4, changements2.7 précédents attribuables. Vérifications directes : exemple/ignore/doc réguliers UID1002 mode0600 sans symlink ; aucun env réel ni log dans projet/ fichiers Git suivis ; exemple sans secret, rôle runtime SQL non activé. Critères préparation/configuration et cloisonnement documentés ; aucune utilisation d’un secret/runtime existant.

Fichiers : .gitignore, .env.example, docs/ENVIRONMENT.md et suivi ROADMAP/journal. Document actualisé retire le contrôle devenu inutile sur runtime exclu ; contrat secrets publics/privés, validation serveur future et séparation audit/runtime explicites. Point2.7 ne déclare pas les secrets futurs installés/protégés : contrôles effectifs19.3/19.4 obligatoires avant mise en service, autorisation administrateur distincte, aucune donnée patient réelle. Critères non réalisés de production ne sont pas marqués validés.

Vérifications : check-ignore de variantes env/log/cache et exemple versionnable, contenu exemple sans credential, syntaxe/documentation/217points/diff--check et secrets avant commit. Aucune modification service/permission/rôle/HBA/lanceur root, aucune lecture de secret, aucune fixture rejouée. Git : commit ciblé2.7 puis push main après succès ; hash réel enregistré au compte rendu et entrée suivante. Suite automatique2.8, conception des privilèges seulement, pas installation.


## Point2.8 — Conception des privilèges du runtime indépendant

2026-10-10T01:45:53+02:00 Europe/Brussels. Statut : ☑ Validé (conception seulement). Commit2.7 confirmé03bee91f3ae8e769725d3cb87e2941a04e68f7e3 poussé, distant égal, arbre propre. Audit : pas de code/package applicatif ; compte candidat dental-lab-runtime et rôle SQL du même nom absents, unité candidate /etc/systemd/system/dental-lab-api.service et wrapper /usr/local/sbin/dental-lab-service-control absents. Noms/emplacements proposés explicitement, pas objets installés. dental_lab_app NOLOGIN sans attributs administrateur, audit ni migrator ni owner ; transaction READ ONLY achevée. Aucune ressource dental-site réinterrogée.

Document docs/RUNTIME_PRIVILEGES.md : compte indépendant non root, unité backend seule proposée, identities/configurations distinctes, artifacts protégés et secrets hors source, droits SQL uniquement runtime sans DDL/ownership, aucun wrapper nécessaire ni sudo/polkit/wildcard. Création/installation/grants/HBA/secrets/ports/limites et validation opérationnelle restent19.3/19.4 avec approbation explicite ; aucun ExecStart/port/paramètre de production inventé. Approbation SQL/SHA à chaque migration inchangée.

Fichiers : nouveau document de conception et suivi ROADMAP/journal. Vérifications doc/invariants/diff/secrets avant commit ciblé ; aucune création runtime/rôle/unité/secret/wrapper/délégation ni modification de service/HBA/global/voisin. Critères de conception2.8 satisfaits, pas déclaration production prête. Risques réseau/processus/IPC/CPU/IO serveur partagés et absence de confinement complet documentés. Git : commit/push ciblés après contrôles ; résultat réel enregistré ensuite. Suite2.9, rapport des garde-fous, aucune sonde hors périmètre.
