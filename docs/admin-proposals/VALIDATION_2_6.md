# Validation actuelle — Point 2.6, révision 3

10/10/2026 Europe/Brussels. Statut : VALIDÉ pour le mécanisme de développement. La preuve d'intégration administrateur reçue et les corroborations directes sont consignées dans ROADMAP.md et docs/EXECUTION_LOG.md. Source projet conforme au lanceur root installé (SHA 698472ebcc0ca0f8a1d74151cb7331ecfa9e113d8231f9262b3ba6f535de9ea1).

Les 18 tests unitaires rev3 comprennent les 13 tests antérieurs et cinq régressions lexicales : CASE/END légitime, END transactionnel refusé, transactions et session refusées, constructions incomplètes rejetées, trois fixtures réelles acceptées. Les effets privilégiés/SQL sont simulés dans ces tests ; ils ne relancent pas les migrations.

Tests PostgreSQL réels effectués par l'administrateur : 0000 identité/permissions ; 9901 création/insertion/vérification/suppression ; 9900 création/insertion puis SQLSTATE22012 et rollback complet constaté, table absente. Fermeture NOLOGIN/zéro session et registre sans pending prouvés par rapport. Contrôles directs actuels : source root SHA/mode exacts ; NOLOGIN/zéro session/tables absentes/séparation audit et services actifs. Registre root et HBA : preuves administrateur, pas de lecture privilégiée directe de l'IA.

Risques conservés : revue SQL humaine et approbation exacte SHA à chaque migration, sauvegardes selon risque, pas de sandbox SQL complète ni garantie sur effets non transactionnels ; pending/commit incertain/SIGKILL à résoudre humainement, NOLOGIN ne termine pas les sessions ; quotas client distincts du serveur partagé, réseau/IPC/IO/processus partagés, politique snapshots et production à valider. Aucun privilège IA élargi, aucune donnée patient réelle, aucune réexécution de fixture.

## Rapport historique révision 2 — état antérieur remplacé par la validation ci-dessus

# Rapport de validation — Point 2.6, révision 2

Date : 09/10/2026 13:06 UTC. **Statut global : BLOQUÉ. Corrections et tests unitaires vérifiés ; intégration PostgreSQL DDL/DML non exécutée. Aucune installation privilégiée autorisée/effectuée.**

## Correction du défaut transactionnel

Le défaut signalé est confirmé par la documentation PostgreSQL 17 : --single-transaction exige -c et/ou -f. La première proposition utilisait stdin sans ces options et ne satisfaisait pas le contrat ; elle ne doit pas être installée.

Commande construite par migration_psql_args : psql 17, -X -w, socket /var/run/postgresql, port 5432, utilisateur dental-migrate, base dental_lab, ON_ERROR_STOP=1, VERBOSITY=sqlstate, --single-transaction, -c préambule fixe, -f copie approuvée, -c contrôle final d’identité. Stdin = DEVNULL. Le BEGIN/COMMIT/ROLLBACK est géré par psql. Le SQL de projet tourne sous l’utilisateur dédié et SET LOCAL ROLE dental_lab_migrator, jamais root/postgres.

Le contrat annule complètement le DDL/DML transactionnel en cas d’erreur ; pas de garantie pour effets hors transaction, séquences existantes consommées indirectement, fonctions externes ou résultat inconnu autour du commit. Ces effets sont exclus par revue des migrations transactionnelles ; le filtre conservateur n’est pas un analyseur SQL complet. Aucun succès d’intégration n’est revendiqué à partir de la seule documentation.

## Vérifications effectivement exécutées

| Vérification | Résultat réel | Limite |
|---|---|---|
| RDC/identité/répertoire/Git | En ligne, UID1002 dental-ai, /srv/dental-lab réel, modifications 2.6 connues | Aucun voisin sondé |
| Audit SQL READ ONLY | dental_lab, PostgreSQL 17.11 ; CREATE public et TEMP false ; identité migrateur LOGIN absente ; deux tables de fixture absentes | Aucun droit supplémentaire demandé/exécuté |
| Tests unitaires locaux | 13 tests, code 0 | Appels administrateur/exécution SQL simulés dans les tests de cycle de vie |
| Tests unitaires VPS | 13 tests, code 0 | Même limite ; UID réel reste 1002 |
| Syntaxe | 11 blocs Bash et 3 fichiers Python vérifiés | Les blocs administrateur ne sont pas exécutés |
| Checksums | Lanceur/test intégration documentés cohérents, fixtures épinglées dans le test | Copie installée inexistante |
| Refus non-root | Lanceur quitte avant toute opération administrative | Test de la proposition, pas délégation installée |
| Intégration réelle | BLOQUÉ, code 77 sous UID1002, aucune DDL exécutée | CREATE/TEMP absents, compte/exécuteur et lanceur installés inexistants |

Tests unitaires : noms/longueurs et scoping fixe ; SHA modifié ; octets UTF-8 invalides/BOM/NUL/taille ; méta-commandes connexion/shell ; sortie de transaction et SET/**/ROLE ; appels directs nextval/setval/set_config, CALL/COPY ; contrat -c/-f/-1 ; refus non-root sans appel admin ; SQL administratif arbitraire refusé ; contrôle symlink/permissions ; échec SQL simulé garde .pending et ferme le rôle ; échec fermeture simulé ne crée aucun reçu succès ; reçu seulement après succès SQL et fermeture vérifiée ; pending d’une version bloque aussi une autre version.

## Test d’intégration ajouté, pas encore validé

Le test test_migration_atomicity.py utilise le lanceur installé et exige :
1. Contrôle positif CREATE TABLE + INSERT + assertion + DROP, succès et reçu checksum.
2. CREATE TABLE + INSERT observés, puis division par zéro SQLSTATE 22012 et retour non nul.
3. Vérification indépendante sous audit que la table créée avant l’erreur n’existe pas après ; aucune suppression automatique ne masque une persistance.
4. .pending présent, pas de reçu succès, checksum exact, NOLOGIN et zéro session.

Fixtures : 9901_atomicity_success_probe.sql puis 9900_atomicity_failure_probe.sql. Données synthétiques : entier 1, pas de séquence ni donnée médicale. Les permissions actuelles ne permettent pas de démontrer ce DDL/DML réel. Aucun cluster parallèle ou compte administrateur pour l’IA n’a été créé en substitution. Le code 77 est explicitement un blocage, pas un test réussi.

## Revue de sécurité et risques résiduels

- Comptes : dental-ai reste uniquement audit. Nouvel exécutant proposé NOLOGIN au repos, NOINHERIT, SET migrator seulement, aucun attribut administratif/ADMIN OPTION ; précontrôle refuse une élévation/transitivité de migrator ou membership migrator/owner de dental-ai. Pas de sudo/polkit à l’IA.
- Contrôle root : shebang Python -I, copie installée obligatoire, fichiers/parents root sans écriture groupe/autres ; SQL administratif limité à quatre littéraux fixes et timeout 15s.
- Source SQL : lecture sous UID1002 seulement, composants sans symlinks, fichier ordinaire privé UID1002/un lien, limite 1 Mio/10s, SHA approuvé. Snapshot root fsync, lecture seule pour le worker et conservé pour revue exacte après succès/échec ; chemin enregistré dans le marqueur. Rétention/capacité disque à définir avant production. Noms bornés ; aucun choix libre de base/hôte/user/commande.
- Registre : lock sans symlink, root privé, marqueur JSON durable avant LOGIN ; toute présence pending bloque toutes les versions. Reçu après SQL réussi ET NOLOGIN/zéro session. Archive rollback-verified refuse le rejeu de sa version.
- Interruptions : SIGINT/SIGTERM tentent la fermeture et protègent cette tentative d’une deuxième interruption ordinaire ; SIGKILL/panne/erreur SQL administrative peuvent laisser LOGIN ou session active. NOLOGIN ne termine pas une session. Unité unique enregistrée dans pending ; intervention humaine ciblée, jamais reprise automatique ni arrêt de service global.
- Incertitude commit : SQL et registre filesystem ne sont pas atomiques ensemble. Un commit réussi suivi d’une panne doit rester pending tant que l’état SQL n’a pas été établi. Ne pas annoncer un rollback d’une migration interrompue sur la seule base du retour client.
- Sandbox : unité limitée AF_UNIX/réseau privé/readonly/protections/quotas/runtime 6min ; ces limites concernent le client, pas le serveur PostgreSQL partagé. Verrous, IO et CPU serveur restent un risque à revoir avec chaque migration.
- SQL : le filtre bloque plusieurs échappements mais revue obligatoire des fonctions/triggers/defaults/grants et effets non transactionnels. N’autoriser aucune fonction réseau/FDW/dblink/extension ou opération sortant de dental_lab. Aucun traitement réel de patients avant les gates sécurité/confidentialité/production.

## Correspondance aux chemins réels

Sur VPS : propositions docs/admin-proposals et trois fichiers SQL migrations, appartenant UID1002, privés. Binaires constatés : /usr/bin/env, python3, systemd-run, install, getent, cut, diff, sha256sum, stat, mv ; /usr/sbin/runuser et /usr/lib/postgresql/17/bin/psql connus. /usr/local et /usr/local/sbin root:root 755, sans symlinks. /usr/local/sbin/dental-lab-migrate, /var/lib/dental-lab-migrations et admin-tests absents : destinations proposées, pas état existant. HBA/service partagé : preuve administrateur antérieure, aucune nouvelle inspection privilégiée affirmée.

## État et action attendue

Principe général approuvé par l’utilisateur, installation NON approuvée. Faire relire cette révision et ses checksums avant toute commande administrateur. POINT_2_6_ADMIN.md contient installation future, test technique et fermeture/retour arrière ciblé. Il faudra ensuite recevoir les preuves d’intégration, permissions/HBA/scoping/fermeture et résolution humaine de la fixture pending pour clôturer 2.6. Aucun passage à 2.7. Aucun commit/push de validation, rôle, permission SQL, HBA, service ou paquet modifié.

Sources primaires : https://www.postgresql.org/docs/17/app-psql.html ; https://www.postgresql.org/docs/17/functions-sequence.html. Contraintes : CONSIGNE.md §§4/8 et instruction explicite utilisateur interdisant l’installation privilégiée.
