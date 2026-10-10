# Privilèges du runtime indépendant — conception2.8

Statut : conception vérifiée, NON INSTALLÉE. La décision administrateur exige un runtime indépendant. Aucun compte, rôle, unité, secret, wrapper, port ou permission créé/modifié. dental-site et tous ses composants restent hors périmètre ; aucune copie ni réutilisation.

## Identités et chemins candidats, pas des ressources existantes

| Élément | Conception | Validation avant création |
|---|---|---|
| Développement/audit | dental-ai, /srv/dental-lab, rôle audit actuel | UID1002, pas de sudo général ni membership migrator/owner |
| Exécution API | Compte système dédié candidat dental-lab-runtime, sans connexion interactive, sans sudo/capacités/accès projets voisins | Absence constatée en2.8 ; nouvel audit de collision et approbation administrateur en19.4 |
| Unité API | Nom candidat dental-lab-api.service ; unité root-owned non éditable par agent | /etc/systemd/system/dental-lab-api.service absent à l'audit ; emplacement/commande réels après build et approbation19.4 |
| SQL runtime | Identité authentifiable dédiée candidate dental-lab-runtime utilisant seulement les permissions nécessaires de dental_lab_app, sans ownership/DDL/migrator | Rôle candidat absent, dental_lab_app NOLOGIN sans attribut administratif ; auth/HBA/grants à définir et approuver séparément19.3, jamais utiliser audit/migrateur |
| Artifacts/configuration | Artifacts approuvés hors source éditable, sous contrôle administrateur ; configuration/secrets indépendants | Chemins finaux et injection à valider19.3/19.4 ; aucun emplacement repris de dental-site |

Les noms candidats sont proposés pour éviter les collisions avec les services existants ; leur présence absente ne vaut pas autorisation d'installation. Pas d'ExecStart ou de port inventé avant code/build/audit propre. Une seule unité backend à concevoir lorsque ses besoins sont connus ; frontend Vite prévu comme artefact statique, pas de serveur de développement en production. Ne pas créer de workers/unités supplémentaires sans besoin démontré.

## Frontière d'autorité

- IA : préparation code/configuration publique/tests/diff dans /srv/dental-lab seulement ; pas d'accès aux secrets runtime ou administrateur, pas de déploiement privilégié ni contrôle de service attribué implicitement.
- Administrateur : création future des comptes/secrets/unités, copie approuvée des artifacts et opérations ciblées sur la seule unité autorisée, après approbation distincte ; aucune commande systemctl globale.
- Le processus applicatif tourne comme compte dédié non root. Le gestionnaire privilégié ne doit jamais exécuter du code projet éditable sous root/postgres ; scripts de préparation/déploiement ne peuvent être pris arbitrairement depuis /srv/dental-lab.
- Aucun wrapper sudo/polkit indispensable actuellement : ne créer aucune délégation. Si un besoin réel de contrôle par l'agent apparaît plus tard, revenir à une revue séparée d'un wrapper root-owned, arguments/unité imposés, code non éditable, tests de refus et autorisation explicite. Pas de sudo générique ou systemctl *.
- Séparation migrations inchangée : lanceur2.6, opérateur humain et SQL/SHA approuvés explicitement pour chaque exécution. Identité runtime ne reçoit ni ce rôle ni ces opérations.

## Confinement à valider avant mise en service

L'unité devra avoir un compte/groupes minimaux, NoNewPrivileges, aucune capacité accordée, fichiers/parents root protégés, artifacts en lecture seule et seuls répertoires de données/temp nécessaires accessibles en écriture. Accès HOME/projets voisins refusé. L'agent ne devient pas membre du groupe runtime. Fixer CPU/mémoire/tâches et réserves disque selon dimensionnement/tests, sans réutiliser les limites d'un ancien service non lié.

Socket PostgreSQL uniquement dental_lab sous identité dédiée, refus d'autres destinations selon règles administrateur ciblées. Besoins réseau API/e-mail à examiner et filtrer dans le périmètre autorisé ; ne pas promettre une isolation du réseau local ou du serveur PostgreSQL partagé à partir des protections systemd du client. Ne sonder aucun voisin pour dimensionner les ports ; recevoir l'allocation administrateur et vérifier seulement le candidat autorisé.

## Réception future obligatoire

En19.3/19.4 : compte/service/chemins exacts et non-collision, mode/propriétaires/ACL/secrets et accès agent refusé, identité SQL/permissions sans DDL, commande de lancement non root, limites et accès données, lancement/arrêt ciblés sans toucher aux voisins, sauvegarde et retour arrière. Configuration du réseau/proxy/cluster ou délégation implique une nouvelle autorisation. Aucun contrôle de production n'est marqué accompli en2.8.

Critères de conception2.8 : seule unité propre au nouveau labo proposée, aucun wrapper non nécessaire, pas de sudo générique ni wildcard de service, aucune exécution root de code éditable. Ces critères sont satisfaits comme contrat documentaire, avec installation et preuve opérationnelle restant obligatoires dans leurs étapes.

## Reprise6.1 —10/10/2026

Audit direct : compteLinux et rôleSQL candidat dental-lab-runtime absents ; dental_lab_app NOLOGIN sans CONNECTdental_lab, audit dental-ai non membreapp. La conception2.8 reste non installée. Point6.1 bloqué sur une identité/méthode de test applicative ; création19.3/19.4 ou mécanisme provisoire nécessite décision et autorisation administrateur distinctes, sans droits permanents IA. Aucune permission ni HBA/service modifié. État canonique et preuves : ROADMAP.md/EXECUTION_LOG.md.

## Décision R19 — anticipation limitée6.1

R19 remplace l’attente calendaire19.3/19.4 pour les seuls prérequis de développement/testSQL. Proposition peer sans secret, identité Linux/SQL dental-lab-runtime distincte, sans service de production. Client et tests indépendants préparés ; aucun compte, grant, HBA ou runtime installé. Procédure exacte et contrôle HBA administrateur restant : docs/admin-proposals/POINT_6_1_ADMIN.md. Réception réelle obligatoire avant clôture6.1 ; gates de production inchangés.

## Réception R19 —11/10/2026

Le contrat de conception2.8 ci-dessus décrit l’état historique. Prérequis Linux/SQL6.1 désormais installés par l’administrateur : dental-lab-runtime UID994, rôleLOGIN/max2/appuniquement, peer sans secret, copietest root protégée inaccessibleaudit, HBA ciblé reçu et testsréels acceptés. Audit direct confirme les droitsminimaux/sessions0/migrateurNOLOGIN. Aucun serviceAPI/portpublic/Nginx deproduction installé par l’agent ; gatesproduction19.3/19.4 inchangés. Étatcanonique6.1 VALIDÉ et provenancepreuves dans ROADMAP/EXECUTION_LOG.
