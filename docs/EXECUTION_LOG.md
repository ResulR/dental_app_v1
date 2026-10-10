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


## Point2.9 — Consolidation des garde-fous, preuve services manquante

2026-10-10T01:47:53+02:00 Europe/Brussels. Statut : ⚠ Bloqué. Commit2.8 confirmé0c116d094e9c5e77b82dd058cd67a82c88e0b746 poussé, distant identique, arbre propre. Critères2.9 relus : refus projets/bases/services/secrets et limites réseau dans rapport reproductible. Preuves2.1–2.8 disponibles consolidées dans docs/INFRASTRUCTURE_GUARDS.md ; sources administrateur/directes et limites distinctes. Aucun test vers un voisin effectué.

Manque : preuve de refus de gestion des services via autorisations systemd/Polkit/délégations effectives applicables à dental-ai ; absence de sudo seule insuffisante. Contrôle minimal demandé : rapport administrateur lecture seule des politiques/délégations couvrant ce compte, actions et unités hors périmètre, commandes/resultats expurgés ; aucune action start/stop/restart/reload réelle pour tester, aucune modification de politique/droits/service. La règle accès Remote activable après validation est confrontée à l’autorisation utilisateur2.3 déjà en vigueur : ne pas arrêter Remote, aucune extension autorisée. Risques réseau/IPC/ressources déjà acceptés en développement ne sont pas effacés ni transformés en isolation complète.

Fichiers : document de rapport, ROADMAP/statut/R03 et journal seulement ; aucun secret/compte/runtime/rôle/service/HBA/lanceur créé ou modifié. Vérifications structure217points/doc/absence secrets/diff--check ; suivi non commité/non poussé puisque2.9 non validé. Pas de3.1. Action : preuve administrateur d’autorisation/refus des services, puis réévaluation2.9 ; aucun élargissement de permissions demandé.


## Clôture2.9 — Garde-fous validés pour développement

2026-10-10T01:51:59+02:00 Europe/Brussels. Statut : ☑ Validé (mode de développement2.3, pas production/isolation complète). Reprise Remote en ligne UID1002/cgroup dédié/projet réel ; changements2.9 identifiés, HEAD0c116d0. Rapport Polkit administrateur intégré : pas sudo/groupes administratifs/règle locale, règles système identifiées sans délégation dans lignes examinées ; manage-units auth_admin/auth_admin/auth_admin_keep, pkcheck sans interaction code2. Résultat attribué, pas absence universelle de permissions inventée.

Complément direct ciblé et lecture seule : pkcheck présent /usr/bin ; manage-unit-files, reload-daemon, set-environment sous sujet bash dental-ai/cgroup Remote : trois code2 et authentification requise. Aucune option interactive ni demande d’opération réelle, aucun accès/service voisin ciblé. Audit4catégories générales plus preuves2.1–2.8 satisfont le rapport reproductible dans le mode explicitement accepté. L’exigence de rapport précédente « toutes les autorisations » est corrigée : limites non effacées, exceptions par unité/contexte/voie différente non entièrement démontrées ; tout changement entraîne réaudit.

Fichiers : docs/INFRASTRUCTURE_GUARDS.md, ROADMAP et journal. Réseau/IPC/processus/ressources hôte/cluster partagés, production et runtime effectifs non validés, gates19.3/19.4 et sécurité inchangés ; Remote2.3 autorisé reste actif sans extension. Pas de service/root-lanceur/rôle/HBA/secret/permission modifié, aucune fixture rejouée. Contrôles : syntaxe du bloc sans re-test Polkit, invariants217points/diff/absence secrets. Git : commit et push ciblés après succès, résultat réel au compte rendu/journal suivant. Suite automatique3.1, audit architecture applicative.

### Point 3.1 — Architecture applicative détaillée

Date : 10/10/2026 à 01:55 Europe/Brussels (UTC+02:00). État initial : 2.9 validé, HEAD 4042311, arbre propre ; UID 1002 et chemin /srv/dental-lab vérifiés. Aucun code applicatif ni modèle SQL métier présent. Cahier des charges relu, principes/complément et décisions 1.3/1.4 confrontés à l'état actuel.

Modifications : docs/architecture.md et docs/decisions/0001-stack.md, 0002-module-boundaries.md. Formalisation de la stack approuvée, des 16 propriétaires, des contrats et ports sans cycle, des transactions/outbox, des projections autorisées, de la PWA/fichiers et des frontières du runtime indépendant. Le graphe est exactement celui validé en 1.4 ; aucune nouvelle fonction ni outil installé. Les choix de 3.2–3.9 restent à leur étape.

Validation : comparaison JSON du graphe à 1.4 réussie ; toutes les cibles définies, parcours sans cycle ; liens relatifs résolus ; UID 1002/modes 600/non-symlinks contrôlés ; scan élémentaire de secrets et git diff --check réussis. Revue documentaire contre §§2–17 et exclusions §18, distinction de conception et implémentation maintenue. Typage/lint/build/tests applicatifs sans objet, code absent. Aucun service, permission, SQL, launcher ou fixture modifié/exécuté.

Risques restants : faisabilité appareils/offline, capacité/stockage, transport, fournisseurs, sécurité/conformité et production aux jalons existants. Statut final : ☑ Validé pour 3.1. Git : commit ciblé après contrôle du diff ; identifiant porté par l'historique Git et compte rendu, push à vérifier. Suite : 3.2, modèle comptes et cliniques.

### Point 3.2 — Modèle comptes et cliniques

Date : 2026-10-10T01:58:10.180718+02:00 (Europe/Brussels). État initial : 3.1 validé, commit 4acb5a41d11a861e2a4bb11c62622b7d4716a56c poussé et arbre propre ; identité UID 1002 et chemin projet contrôlés. Audit SQL en lecture seule : current_database/current_user = dental_lab/dental-ai ; aucune table public. Critères 3.2 et §§2, 9, 11, 15, 17 confrontés.

Modifications : docs/models/accounts-clinics.md et lien dans docs/architecture.md. Modèle proposé : compte propriétaire unique, profils individuels labo et compte partagé clinique, clés/FK/unicités, invitations et sessions, états d'approbation/suspension/blocage séparés, changement d'e-mail confirmé, historique et récupération exceptionnelle. Aucun workflow financier ou rôle ajouté ; paramètres de tokens et sécurité à préciser aux étapes d'implémentation.

Validation : revue des associations et des invariants/exceptions contre le cahier des charges, liens résolus, UID/modes privés/non-symlinks, scan élémentaire secrets et diff Git contrôlés. La matrice de concurrence/refus est une conception de tests futurs ; aucun test applicatif ou migration prétendu exécuté. Aucun SQL écrit/exécuté en modification, aucune fixture ni service touché.

Statut final : ☑ Validé pour la conception 3.2 ; migration et contraintes réelles non installées. Git : commit ciblé après contrôles, push à vérifier et identifiant dans l'historique/compte rendu. Risques : choix sécurité et procédures exceptionnelles avant implémentation, confidentialité et données réelles avant production. Suite automatique : 3.3, droits granulaires.

### Point 3.3 — Droits granulaires

Date : 2026-10-10T02:00:39.771078+02:00 (Europe/Brussels). État initial : 3.2 validé et poussé (d48dc12107a1fb1a8b7663c451dcf5198deb390b), arbre propre ; audit des modèles et critères 3.3, §2.3 et frontières §§8–10/15. Le registre R14 reste ouvert pour 3.5–3.6.

Modifications : docs/models/permissions.md et lien architecture. Grants individuels, prérequis, accès parent serveur, enveloppe explicite de délégation employés et refus d'auto-élévation ; capacités logistique/détail, view/download, général/travail, lecture/réponse et actions séparées. La lecture de chat est une autorisation distincte de contenu libre, sans prétendu filtrage automatique patient ; les projections officielles logistiques restent expurgées.

Validation : revue matrice/prérequis et retrait des dépendances contre CDC, liens et fichiers privés contrôlés ; diff et scan élémentaire secrets OK. Tests API/IDOR/révocation/ZIP/temps réel listés pour implémentation, non prétendus exécutés ; pas de code, grant système/SQL ni service modifié. Statut final : ☑ Validé pour conception 3.3. Git : commit ciblé après revue, push à vérifier ; hash via historique et compte rendu. Suite : 3.4, modèle de commandes et versions.

### Point 3.4 — Commandes et versions

Date : 2026-10-10T02:02:22.164297+02:00 (Europe/Brussels). État initial : 3.3 validé et poussé (87597f80e102c150d47bdabc18f0d10a7fec28bb), arbre propre et UID 1002 ; critères 3.4 et clauses §§3–8/11/14/15/19 relus. Pas de table métier ni code à adapter.

Modifications : docs/models/orders-versions.md et lien architecture. Identité officielle/numéro serveur, versions append, FDI, snapshots, identifications patient alternatives, dates souhaitée/planifiée distinctes, fichiers versionnés/verrouillés, demandes exclusives, reçu idempotent, historique/logistique séparés. R14 (état source du remplacement) conservé explicitement ouvert pour l'automate 3.5 ; aucune transition non validée ajoutée.

Validation : revue des clés/FK de même commande, unicités et scénarios de concurrence contre CDC ; dates, avertissements non bloquants et exclusions préservés ; liens/propriété/modes et scan élémentaire secrets OK ; diff Git contrôlé. Tests SQL/API et transfert réels non exécutés à cette étape de conception. Aucun fichier de migration, objet SQL, service ou privilège modifié.

Statut final : ☑ Validé pour 3.4, statuts et stockage de versions sans écrasement décrits. Git : commit ciblé après contrôle du diff, push à vérifier. Suite : 3.5 ; consulter R14 et arrêter pour décision si la table de transitions ne peut pas être complète sans trancher le remplacement après fabrication.

### Point 3.5 — Automate partiel et décision R14 indispensable

Date : 2026-10-10T02:04:13.462575+02:00 (Europe/Brussels). État initial : 3.4 validé, commit 9326b5823372009dda5ba9a869ffdb97df27d805 poussé, arbre propre ; UID 1002 et chemin projet contrôlés. Audit critères 3.5, CDC §§5.3/5.5/6/7/19 et registre R14 existant.

Préparation : docs/models/order-state-machine.md, table des transitions établies, automate des demandes et scénarios de concurrence. Aucun choix adopté pour les états source Terminée/Livrée des travaux liés. Le §5.5 parle d'après démarrage et exige annulation du remplacé ; le §5.3 exclut l'annulation ordinaire Terminée/Livrée ; le §6 définit retouche après livraison. Sans préciser la portée de l'exception, table exhaustive non validable.

Décision minimale attendue du propriétaire : états autorisés pour remplacement et travail supplémentaire ; proposition à confirmer = En fabrication seulement, parcours normal à Terminée et retouche/refabrication §6 à Livrée. Si d'autres états autorisés, préciser par type et autorisation exceptionnelle d'annuler le remplacé. Aucune nouvelle règle implémentée ou présumée.

Vérifications : revue partielle contre clauses, liens/propriétés/modes privés et scan élémentaire secrets, diff de suivi contrôlé. Aucun test applicatif/migration/service/privilège modifié. Statut final : ⚠ Bloqué (R14) ; document partiel et suivi laissés non committés, aucun commit/push du point non validé. 3.6 et suivants non commencés. Reprise : lire décision et arbre Git, compléter/valider l'automate puis commit ciblé et push seulement après critères satisfaits.

### Clôture 3.5 — R14 et progression approuvées

Date : 2026-10-10T02:08:10.070339+02:00. Reprise : Remote en ligne, UID/GID 1002, cgroup dental-ai-remote.service et /srv/dental-lab vérifiés ; modifications précédentes exactement attribuables à la préparation bloquée 3.5, HEAD 9326b58. R14 reçue explicitement le 10/10/2026 : remplacement En fabrication annule la source ; remplacement exceptionnel Terminée/Livrée la laisse inchangée. §5.5 complété/version 1.1, §§5.3/6 inchangés. CONSIGNE 1.1 consigne la progression sur ambiguïtés mineures ; aucune protection diminuée.

Modifications : automate finalisé, modèle de demandes ajusté pour clôture technique closed, CDC et protocole ; H35-01/02/03 explicitement réversibles et non présentées comme accord supplémentaire. Validation documentaire : revue des huit statuts, transitions autorisées/refus par défaut, demandes exclusives, concurrence, R14 et séparation retouche/remplacement ; liens, fichiers UID1002/modes600, scan secrets élémentaire et diff OK. Espaces de fin de ligne du titre de version corrigés après diff-check ; aucun échec critique. Aucune migration, fixture, permission ni service modifié. Statut final : ☑ Validé pour conception 3.5. Risques d'implémentation et production conservés. Commit ciblé/push après contrôle du diff ; identifiant dans historique et compte rendu. Suite automatique 3.6.

### Point 3.6 — Travaux liés et retouches

Date : 2026-10-10T02:09:56.371312+02:00. État initial : 3.5 finalisé/poussé a6b1b6991f5bdaf5800a3b71a0b32fb42847831a, arbre propre avant création ; audit CDC §§5.3–6/R14 et modèles présents. Modifications : docs/models/linked-works.md, liens architecture et suivi. Clés/FK de même clinique, enfant distinct, filiation append sans cycle, transitions R14, slot d'unicité retouche active et libération atomique, reçu idempotent et ordre des verrous documentés.

Validation documentaire : revue contre critères 3.6, distinction replacement/supplement/resubmission/retouch, contrôles de concurrence et historiques ; liens, UID1002/modes600/non-symlinks, scan secrets et diff OK. Tests d'intégration futurs spécifiés, pas exécutés ; aucun schéma/migration/fixture/service/privilège modifié. Statut final : ☑ Validé pour conception 3.6 ; risques réels de concurrence/stockage à valider à l'implémentation. Git : commit/push ciblés après diff, hash dans historique/compte rendu. Suite automatique : 3.7.

### Point 3.7 — Fichiers et cycle de vie

Date : 2026-10-10T02:11:47.453147+02:00. État initial : 3.6 validé/poussé 67468d0a8faaca57b356fa198e9c18f77d345ec2, arbre propre ; audit des clauses fichiers §§4.2/8/9/11/12 et droits/modelés existants. Modifications : docs/models/files-lifecycle.md, lien architecture et suivi. Catégories/associations typées, ACL par parent/clinique, états de fragments/finalisation/réparation, objets immuables, partage individuel/révocation, ZIP fidèle et capacité séparée documentés.

H37-01 réversible : Mo/Go décimaux pour contrats ; aucune limite cumulative non demandée. Réserve, budgets, TTL, topologie et antimalware restent aux audits opérationnels R07/chapitre12 avant tout transfert réel. Validation documentaire : revue matrices visibilité/cycle selon CDC, liens/propriété/modes/non-symlinks, scan secrets élémentaire et diff OK. Tests upload/ZIP/charge refus/scan sont futurs, non exécutés. Aucun stockage/service/SQL/migration/permission modifié, pas de fixture rejouée. Statut final ☑ Validé pour conception 3.7. Commit/push après revue ; hash dans historique/compte rendu. Suite automatique 3.8.

### Point 3.8 — Synchronisation préparée, récupération à décider

Date : 2026-10-10T02:16:15.568470+02:00. État initial : 3.7 validé/poussé 1c479068074a99f10435a82f23e953059f9703de, arbre propre ; audit CDC §11, modèles et critères 3.8, Node22.22.2 confirmé. Conception préparée dans docs/models/drafts-sync.md : CAS, conflits fichiers compris, tombstones, incertitude/ack/idempotence, soumission explicite, coffre par compte, quota/pannes/maintenance/suspension, proposition d'enveloppe et formats cryptographiques.

Vérification réelle préparatoire : probe Node en mémoire sous UID1002, données synthétiques, PBKDF2 600000 + AES-KW/AES-GCM round-trip4096 octets ; ciphertext altéré, AAD différent, phrase incorrecte et export nonextractable refusés, succès. Sources primaires MDN/OWASP lues ; ce contrôle ne valide ni navigateur ni app absente. Liens/propriétés/modes600/non-symlinks, scan secrets élémentaire et diff contrôlés. Aucun stockage sensible, clé réelle, SQL, fixture, service ou privilège changé.

Blocage unique R05 : récupération du coffre. Option recommandée A = phrase locale indépendante et code de secours privé détenu par clinique, sans clé serveur ; option B = phrase seule, oubli rend brouillons non synchronisés irrécupérables. Choix important sécurité/perte irréversible, non assimilable à une ambiguïté mineure : aucun choix adopté. Action attendue : valider option de récupération ; l'email de récupération du compte ne doit pas promettre la récupération de clé locale.

Statut final ⚠ Bloqué pour3.8 ; document et suivi laissés non committés, pas de commit/push du point non validé. 3.9 non commencé. Reprise après décision : finaliser ADR et coffre, contrôler critères/diff, commit/push puis poursuite automatique. Les tests sur appareils réels demeurent aux jalons PWA, pas une prétention de réussite de conception.

### Point 3.8 — Clôture de conception avec R15

Date : 2026-10-10T07:56:16.363822+02:00. Remote en ligne, UID1002/cgroup dental-ai-remote et /srv/dental-lab confirmés ; HEAD1c47906, changements préparatoires uniquement attribuables à3.8. R15 reçue : deux enveloppes indépendantes, code aléatoire privé, nouvelle phrase sans perte et aucune clé serveur. Fichiers : CDC1.2, modèle drafts-sync, ADR0003, lien architecture et suivi. Limites stockage/appareil, procédure clinique, absence de logs/URL/télémétrie et secours administrateur documentées. Historique du blocage conservé.

Validation : revue de conception contre CDC§11/R15 et critères3.8, machine de synchronisation et pannes/conflicts/fichiers/soumission explicite documentées. Probe Node préparatoire antérieur seulement ; aucun test navigateur prétendu. Contrôle liens, permissions et diff avant commit ; pas de migration, fixture, service, privilège ou donnée réelle modifié. Statut final ☑ Validé pour conception3.8 ; R05 conserve les gates navigateur/revue crypto/production. Commit ciblé et push après contrôle, hash dans historique/compte rendu. Suite automatique3.9.

Complément de validation3.8 : probe R15 Node en mémoire réussi (secours indépendant → nouvelle phrase → même ciphertext lisible, ancienne phrase refusée sur nouvelle enveloppe, nonextractable et ancienne enveloppe conservée). HTTPS/support/quota et absence de fallback clair documentés après lecture MDN. Le contrôle trop large des espaces a rencontré les doubles espaces Markdown historiques du CDC ; permissions réinspectées conformes et diff-check ciblé OK, aucun changement de sécurité nécessaire.

### Point3.9 — Événements, notifications et audit

Date : 2026-10-10T07:59:40.293234+02:00. État initial : HEAD c04672ae4ddd10b43ea2a9bc15378ef371ef5082 poussé, arbre propre ; CDC§§2/5–7/9–10/15–16 et modèles droits/automate audités, aucun fichier de ce modèle présent. Modifications : modèle events-notifications-audit, lien architecture et suivi. Matrice des six catégories labo et mails clinique, exclusions, destinataires, outbox/claims/retries, Lu partagé/cycles30min/24h, audit append-only applicatif et tests futurs. H39-01 SSE/HTTP et H39-02 backoff sont techniques réversibles, pas de fournisseur installé.

Validation : revue de matrice contre CDC, cloisonnement/droits et distinction Lu/action ; sources primaires MDN consultées pour SSE/reconnexion/limites. Contrôles liens/modes/diff avant commit ; aucun test applicatif/fournisseur/navigateur prétendu. Aucun SQL, fixture, service, compte ou secret touché. Statut final ☑ Validé pour conception3.9 ; gates d'implémentation et production conservés. Commit/push ciblés après diff ; hash dans historique et compte rendu. Suite automatique3.10.

### Point3.10 — Rétention, sauvegardes et reprise

Date : 2026-10-10T08:01:50.980270+02:00. État initial : HEAD589619979dc234c83f0498a43513b49803d5495f poussé, arbre propre ; audit CDC§§8/11–12/14–17, fichiers et risques R08/R09. Aucun plan dédié présent. Modifications : modèle retention-backup-recovery, lien architecture et suivi. Catégories/durées connues vs décisions légales futures, archive UI30jours, backups30jours, effacement contrôlé et registre minimisé de réapplication ; proposition H310-01 snapshot unique dental_lab/manifeste/pins objets immuables, mesure RPO1h/RTO4h et reprise sans e-mails/sessions historiques.

Validation documentaire contre critères3.10 : couverture rétention/cohérence DB-fichiers et courses/échecs ; documentation PostgreSQL17 pg_dump/snapshot consultée, aucun outil exécuté ni dump. Contrôles liens/propriétés/modes et diff avant commit. R08/R09 restent ouverts avant patients réels/production : durées légales, destination/clés/capacité et exercices non décidés ou non démontrés. Statut final ☑ Validé pour conception3.10 uniquement. Aucune migration/fixture/service/privilège/donnée réelle modifié. Commit/push ciblés après revue, hash historique/compte rendu. Suite automatique4.1 ; son approbation visuelle exacte sera contrôlée avant clôture.

### Point3.11 — Contrat API et erreurs métier

Date : 2026-10-10T08:06:06.771701+02:00. État initial : HEAD96e6a73d4fe72b52241907c5d9f94f1d96eab2e7 poussé, arbre propre ; audit ADRstack, versions/permissions, chapitre3 complet et absence de contrats. Correction de suite : annonce4.1 prématurée après3.10 ; aucun fichier UX créé, 3.11 traité avant chapitre4. Modifications : api-contract, common.schema.json, consumers.json, check_contracts.py, lien architecture et suivi. H311-01 préfixe APIv1 et H311-02 pagination technique sont réversibles ; aucune limite métier additionnelle.

Portée de réception : point Audit/décision = mêmes schémas réutilisés dans spécifications web/API via références identiques ; imports React/Express effectifs aux fondations après création des applications. Pas de preuve de code client/serveur absent. Validation réelle : python3 docs/contracts/check_contracts.py avec jsonschema préexistant, méta-schéma2020-12, références communes résolues, exemples synthétiques et refus identification vide, autorité injectée, date/FDI/fichiers invalides, fuite projection logistique et erreurs sensibles : OK. Sources primaires RFC9457/JSONSchema consultées. Liens/propriétés/modes/diff contrôlés avant commit. Statut final ☑ Validé pour conception3.11, imports/types/middleware/CSRF/concurrence futurs non validés. Aucun SQL/fixture/service/secret/privilège modifié. Commit/push ciblés après revue ; hash historique/compte rendu. Suite4.1.

### Point4.1 — Direction visuelle proposée, approbation attendue

Date : 2026-10-10T08:08:24.690824+02:00. État initial : HEAD1fab333 poussé, arbre propre ; architecture3.1–3.11 conception validée, aucun frontend/asset/charte/logo présent. Audit CDC§§1/7/11/13/18 et critères chapitre4. Modifications : docs/design/visual-direction.md, tokens.json, direction-preview.html et validation.md ; suivi canonique et journal. Proposition H41-01 sobre blanc/gris, accent vert pétrole, police système16px, cibles44px et parcours priorisés labo/draft/livraison/message/coffre. Libellés albanais candidats, données fictives seulement, maquette statique locale sans réseau/JS/secret. Skill Superdesign consulté mais CLI/service externe non exécuté pour conserver périmètre Remote/VPS autorisé.

Validation réelle : JSON/HTMLParser, langue sq, ancres et absence de ressources externes/scripts/formulaires ; calculs de contrastes texte≥4.5 et bordure/focus≥3 : OK, détails validation.md. Pas de rendu navigateur/tactile/lecteur ou revue linguistique prétendu. Diff/propriétés/modes et liens contrôlés. Blocage limité : ROADMAP4.1 exige « Tokens, typographie et parcours prioritaires approuvés » ; proposition concrète prête mais aucune approbation de direction visuelle reçue. Statut final ⚠ Bloqué, aucun commit/push de4.1 avant validation ; 4.2 non commencé. Action attendue : approbation ou modification ciblée de cette direction, pas autorisation système. Aucun runtime/permission/SQL/fixture/service modifié. Reprise : intégrer revue, clôturer4.1 avec commit/push puis4.2 automatiquement.

### Point4.1 — Clôture avec R16

Date : 2026-10-10T09:36:31.768987+02:00. Remote en ligne, UID1002 dental-ai, /srv/dental-lab et cgroup dental-ai-remote vérifiés ; HEAD1fab333, seuls changements préparatoires4.1 présents. R16 approuve la maquette existante, couleurs/police16px/cibles44px/responsive mobile-first clinique/albanais/parcours et critères complémentaires. Mise à jour visual-direction, tokens et validation ; HTML approuvé conservé. Historique du blocage conservé.

Validation : reprise des fichiers réellement présents et critères4.1, JSON/HTML/liens/modes/propriétés et diff contrôlés avant commit ; contrastes calculés préalables inchangés. Statuts textuels, erreurs/confirmations claires, confidentialité selon droits et tests clavier/mobile/contrastes à l'implémentation documentés. Pas de test navigateur réel ni certification accessibilité prétendu. Statut final ☑ Validé conception4.1, R16 consignée, détail esthétique réversible autonome. Aucun runtime/permission/SQL/fixture/service modifié. Commit/push ciblés après revue ; hash historique/compte rendu. Suite automatique4.2.

### Point4.2 — Navigation et accès par rôle

Date : 2026-10-10T09:39:47.881893+02:00. État initial : HEADd873e5a poussé, arbre propre ; audit CDC§§2/11/13 et modèle droits3.3/R16, aucun modèle navigation existant. Créations : navigation.md, navigation-plan.json et navigation-preview.html. Deux portails, profils/session inconnue/pending/suspendu, menus par grants effectifs, owner-only et projection logistique sans patient ; règle responsive mobile-first clinique/cibles44px, focus et refus direct/caches/revocation décrits. Aucun sélecteur de rôle produit ajouté.

Validation conception : planJSON et capacités retrouvées dans modèle3.3, scopes clinic/owner-only et deny-by-default. Premier parseur de contrôle limité à deux segments a mal lu messaging.order.read ; cause identifiée, correction des segments puis contrôle réussi, aucune permission produit changée. Prototype statique sq sans donnée sensible, liens/modes/diff contrôlés. Ce contrôle ne prouve pas un routeur/serveur absent : tests responsive/clavier/IDOR réels à implémentation et4.14. Statut final ☑ Validé conception4.2. Aucun runtime/SQL/fixture/service/secret/privilège touché. Commit/push ciblés après revue ; hash historique/compte rendu. Suite automatique4.3.

### Point4.3 — Inscription, approbation et récupération

Date : 2026-10-10T09:42:13.297699+02:00. État initial : HEADb7378aa poussé, arbre propre ; audit CDC§§2/11/15/17 et comptes3.2/navigation/R15/R16. Créations account-access.md, account-flows.json et account-preview.html. Champs inscription exacts, approbation manuelle, compte partagé, invitation bornée/usage unique, récupération générique, suspension/blocage distincts et e-mail en étapes ; aucun compte/secret créé. H43-01 adresse complète multiligne réversible sans champ obligatoire ajouté.

Validation réelle de conception : planJSON/champsCDC, HTMLsq/labels/IDs et contrôles inertes, reset sans déblocage suspension/coffre, liens/propriétés/modes/diff. Formulaires en une colonne validables téléphone/tablette ; aucun rendu/test navigateur/anti-énumération opérationnel prétendu. Token TTL/politique hash et conformité aux jalons dédiés. Statut final ☑ Validé conception4.3. Aucun mail réel/SQL/fixture/runtime/service/permission modifié. Commit/push ciblés après revue ; hash historique/compte rendu. Suite automatique4.4.

### Point4.4 — FDI préparé, test navigateur BLOQUÉ

Date : 2026-10-10T09:48:58.558248+02:00. État initial : HEADe9189d9 poussé, arbre propre ; CDC§4.1/versions/R16 audités. Chromium154 présent /usr/bin/chromium ; Playwright/Puppeteer absents depuis projet. Créations fdi.md, fdi-model.js, fdi-preview.html, check-fdi-browser.mjs, fdi-validation.md ; .gitignore exclut uniquement profil/rapport QA privé docs/design/.browser-qa. H44-01 quadrants et grille responsive réversibles,32dents/cycle/textes/clavier/cibles44px sans dents obligatoires ni bridge automatique.

Vérifications réellement exécutées : Node logique32dents/cycles/entrée intacte/état vide/refus horsFDI OK, HTMLsq/32boutons/noms accessibles/ressource locale OK. Test navigateur CDP avec sandbox intact échoue avant page : SIGTRAP/exit1, pthread_create EAGAIN et NETLINK refusé. Aucun test tactile/clavier/375–1024 validé. Contrôle systemd ciblé en lecture seule confirme TasksMax100, MemoryMax1GiB, NoNewPrivilegesyes et AF_INET/AF_INET6/AF_UNIX ; TasksCurrent48 après échec. NETLINK exclu, création threads sous pression compatible avec confinement, pas de causalité exclusive inventée. PID de test identifiés absents après fin.

Statut final ⚠ Bloqué : critère exact4.4 « Test tactile + clavier/lecteur si applicable » non satisfait. Pas de commit/push de4.4 après échec, changements attribuables laissés dans projet ; 4.5 non commencé. Aucune migration/fixture/service/permission/sandbox/limite changée ni données sensibles créées. Action minimale : recette des fichiers HTML+JS sur navigateur/tablette de test isolé, fournir résultats/proof du cycle tactile/clavier/états/résumé/cibles et largeurs. Ne pas élargir Remote ou passer au suivant sans résolution explicite. Empreintes et détails fdi-validation.md, rapport privé .browser-qa/fdi-result.json.

### Point4.4 — Recette externe organisée, exception de progression

Date : 2026-10-10T09:57:29.278296+02:00. Remote/UID1002/cgroup/chemin confirmés ; changements préparatoires attribuables à4.4, HEAD e9189d9. Le propriétaire a examiné prototype et rapport : conservation du blocage navigateur, interdiction de contourner Chromium, poursuite des seules conceptions indépendantes. Protocole fdi-acceptance.md et archive fdi-review.zip contenant HTML+JS+fiche+SHA256SUMS ; empreintes fdi-review.sha256. Archive contrôlée par lecture ZIP/empreintes, sans profil QA ni données réelles. CONSIGNE reçoit cette exception ciblée, aucun changement de sécurité. Statut4.4 reste ⚠ Bloqué, aucune recette navigateur réussie ni clôture prétendue. Versionnement de la préparation examinée et du suivi de dépendance, pas validation du point. Prochain point4.5 : structure du formulaire indépendante du rendu FDI ; intégration et recette interactive restent dépendantes de4.4.

### Point4.5 — Formulaire de commande complet

Date : 2026-10-10T09:59:27.698026+02:00. État initial : arbre propre, HEAD ffad617. Audit : CDC§§3–4/5.4/11/12, contrat ClinicSubmission3.11, navigation4.2 et tokensR16 ; aucun formulaire de commande existant. Conception indépendante de la recette FDI selon exception du propriétaire ; aucune clôture4.4 implicite. Fichiers : docs/design/order-form.md, docs/design/order-form-preview.html. Identification alternative, matériau/teinte uniques, date souhaitée obligatoire, FDI facultatif et avertissements non bloquants ; catalogue interdit bloque. H45-01 formulaire une colonne + récapitulatif avant envoi réversible.

Validation réellement exécutée : revue règles/sources, HTMLParser (sq, IDs uniques, labels, liens, contrôles inertes, aucune ressource externe), JSON si présent, tokens R16 (16px/44px/règle mobile), droits1002/mode600, diff avant commit. Cohérence de conception évaluée sur structure et scénarios ; aucun rendu navigateur ni test fonctionnel/accessibilité réel prétendu. Recette mobile/clavier/lecteur et intégration aux gates4.14/implémentation ;4.4 reste bloqué. Statut final ☑ Validé pour conception4.5 uniquement. Aucun SQL/migration/secret/runtime/service/privilège modifié. Commit/push ciblés après revue ; identifiant dans historique Git et chat. Suite 4.6.

### Point4.6 — Listes et détail des travaux

Date : 2026-10-10T10:00:35.553320+02:00. État initial : arbre propre, HEAD c55caa9. Audit : CDC§§2.3/5/7/13, automate3.5 et projections3.11 ; aucun écran travaux existant. Conception indépendante de la recette FDI selon exception du propriétaire ; aucune clôture4.4 implicite. Fichiers : docs/design/works.md, docs/design/works-preview.html. Réception orientée action, recherche selon droits, fiches logistique/détaillée distinctes, versions et actions contextuelles. H46-01 cartes compactes mobile et sections de détail, sans tableau financier.

Validation réellement exécutée : revue règles/sources, HTMLParser (sq, IDs uniques, labels, liens, contrôles inertes, aucune ressource externe), JSON si présent, tokens R16 (16px/44px/règle mobile), droits1002/mode600, diff avant commit. Cohérence de conception évaluée sur structure et scénarios ; aucun rendu navigateur ni test fonctionnel/accessibilité réel prétendu. Recette mobile/clavier/lecteur et intégration aux gates4.14/implémentation ;4.4 reste bloqué. Statut final ☑ Validé pour conception4.6 uniquement. Aucun SQL/migration/secret/runtime/service/privilège modifié. Commit/push ciblés après revue ; identifiant dans historique Git et chat. Suite 4.7.
