# Chapitre 7 — Bilan de préparation et réceptions différées

**Jalon documentaire du 12/10/2026, pas une réception du chapitre.** Les noyaux sont partiellement implémentés et testés hors ligne. Il reste du code de persistance, de composition API et d'interface à écrire ; appliquer les seules migrations préparées ne rendra pas l'authentification opérationnelle.

Sources : ROADMAP.md, EXECUTION_LOG.md, documentation par module, migrations/catalogue, code actuellement poussé. Vérification directe : startServer appelle createApp sans routes métier ; seule route applicative enregistrée /health. App.tsx indique que la connexion n'est pas disponible. Aucun endpoint login/session/signup opérationnel ne doit être annoncé.

## État des points

« HL » = contrôles hors ligne réellement exécutés ; les adaptateurs doublés ne prouvent pas l'atomicité SQL. « Préparé » n'est ni « appliqué » ni « réceptionné ».

| Point | Implémenté / préparé | Testé HL | Application pertinente | Développement / réception encore nécessaires |
|---|---|---|---|---|
| 7.1 | scrypt, limiteur mémoire, service auth, lookup paramétré | Oui | Pas de nouvelle migration ; 0010 attendu | Limitation durable/configuration, transport et login HTTP/PG |
| 7.2 | Cookies, rotation, révocations, port SessionStore | Oui | 0011 préparée, absente en base | SessionStore PG transactionnel, composition auth/API, courses, TLS/navigateur/SSE |
| 7.3 | Inscription et contrôle clinique pending | Oui | 0002 reçue ; schémas complémentaires absents | Bootstrap owner contrôlé, versions/acceptations légales, registerAtomic, conversation/audit/outbox/API/UI |
| 7.4 | Décision approbation/refus | Oui | 0012 préparée, absente en base | decideAtomic, audit/notifications, routes/UI et recette4refus |
| 7.5 | Contrats, service profil, formulaire AL | Oui | Schéma contacts existant, audit complémentaire absent | Adaptateur CAS/historique et raccordement formulaire/API |
| 7.6 | Workflow demande/accord/confirmation e-mail | Oui | Demandes/challenges non migrés | Schéma, adapters, outbox privée chiffrée, fournisseur/API/UI et courses |
| 7.7 | Tokens et noyau récupération ordinaire | Oui | Challenges non migrés | resetAtomic, révocations/audit/outbox, HTTP/UI et tests d'énumération |
| 7.8 | Noyau invitation employé | Oui | Invitations0002 reçues | issue/activateAtomic, délivrance privée, routes et recette réelle |
| 7.9 | Invitation admin et gouvernance owner-only | Oui | 0002 reçue, 0010 attendu | Autorisation session actuelle, mutations atomiques/audit, routes/UI |
| 7.10 | Registre29/calculeffectif/refus de dépendances | Oui | Registre0002 reçu | Chargement contexte/grants, gardes HTTP/projections/fichiers/jobs/SSE |
| 7.11 | Délégation et confirmation des retraits dépendants | Oui | Enveloppes/grants0002 reçus | Configuration owner de l'enveloppe, transaction, routes/UI et courses |
| 7.12 | Suspension/réactivation/sécurisation clinique | Oui | 0002 reçue ; auditflags manquant | applyAtomic, révocations effectives, vérification demandeur, HTTP/SSE/UI |
| 7.13 | Droits owner-only, service actuel, repository de lecture | Oui | 0002 reçue ; 0010/0011 attendus | Composition/authentification, recontrôle transactionnel, audit global17.1, alertes et réception |
| 7.14 | Procédure récupération exceptionnelle | Revue, pas simulation réelle | Documentation seulement | Artefact ponctuel, preuves humaines, dépendances7.7/audit et simulation |
| 7.15 | Procédure transfert exceptionnel | Revue/metadatareadonly, pas transfert | Documentation seulement | Correction invitations/profil, disposition ancien compte approuvée, outil ponctuel, audit et simulation |

Les 111 unitaires, 6 intégrations hors PostgreSQL, builds contrats/API/web, trois typechecks, lint/format/frontières/résolution ont réussi sur le code36d5099. Journaux contrôlés à la reprise ; ce sont les preuves de ce code, non de scénarios encore absents. Le présent lot documentaire ne justifie pas de les relancer. Catalogue et36tests de migrations/garde hors SQL relancés au jalon : succès, pic49/100. Aucun test navigateur ou SQL de réception exécuté par l'IA.

## Migration préparée, approbation et application

Ne pas déduire l'application d'un fichier ou d'un SHA. L'audit READ ONLY du 12/10 ne trouve ni session_limits, ni clinic_review_events, ni audit_events. Les reçus privés du lanceur restent la source d'exécution à vérifier par l'administrateur. Aucun état actuel de .pending affirmé par l'IA.

D'abord terminer le [dossier chapitre6](CHAPTER_6_RECEPTION.md) dans son ordre : 6.4 déjà appliqué, **recette finale seulement**, jamais rejeu0003 ; puis migrations0004–0010 avec approbation et réception individuelles. Conserver les refus/reçus/snapshots et les vérifications runtime prévues.

| Point | Source à approuver | SHA-256 contrôlé le 12/10 | Recette à approuver |
|---|---|---|---|
| 7.2 | migrations/0011_session_absolute_limits.sql | 5485995b2f9ad6b2cc42603ffee29d3f97fb2dd826b1384a4aa56cf1d141d7e3 | tests/migrations/sessions_constraints.sql |
| 7.4 | migrations/0012_clinic_review_history.sql | b1816885cce02cf518823ff59746308976c60e102051b889b2c8582b6e791ed5 | tests/migrations/clinic_review_constraints.sql |

Empreintes des recettes, contrôlées sans exécution :

- sessions_constraints.sql : e400676cc60a1340ded1c607ab704bd09f8b421c7907f0f9dcc80b0a917ff793.
- clinic_review_constraints.sql : ae0716f9502f7fe0a3d4cadcf6ee927aedcddeb67f03bf81389fc45c2c4dbf51.

Les commandes littérales, droits, risques et recettes ROLLBACK se trouvent dans [POINT_7_2_ADMIN](POINT_7_2_ADMIN.md) et [POINT_7_4_ADMIN](POINT_7_4_ADMIN.md). Aucun nouveau lanceur/batch et aucune exécution par dental-ai. L'approbation du développement n'autorise pas leur exécution ni les GRANT qu'elles contiennent.

## Séquence opérateur, une version à la fois

1. Vérifier identité opérateur, lanceur protégé/SHA, absence d'opération active/incertaine, registre/.pending, sources/SHA/propriété/mode/liens et reçus/snapshots précédents. Si une version est déjà enregistrée, ne pas l'appliquer de nouveau ; rapprocher son état et sa réception.
2. Confirmer les objets et ACL du chapitre6 reçus, les données de recette admissibles et l'absence de données réelles à manipuler. Les scripts de recette actuels exigent une base de comptes vide : si elle n'est plus vide, arrêter et adapter une recette sûre, jamais purger.
3. Pour0011 : prérequis0010, absence de session_limits et sessions vides. La migration impose cet état ; prévoir une autre évolution approuvée si des sessions existent. Appliquer uniquement après son approbation particulière, via la commande existante.
4. Réception0011 :5refus et cas positifs, ROLLBACK, limite absolue/héritage, intégrité FK et droits SELECT/INSERTapp, reçu inchangé et aucun résidu. L'audit confirme NOLOGIN,0sessions/verrous migration et absence.pending.
5. Pour0012 :0011 reçue dans l'ordre retenu, 0002/0010 conformes, absence clinic_review_events. Après approbation distincte, appliquer sa commande, puis4refus/caspositifs/ROLLBACK et audit identique, propriété/ACL append-only.
6. Tout échec ou résultat incertain interrompt les versions suivantes. Pas de DROP, modification de migration passée, suppression de reçu ou réexécution pour tester. Correction éventuelle par nouvelle version approuvée après diagnostic.

Ces vérifications ne valident pas les adapters/API absents. Les contraintes de compte propriétaire et de clinique déjà reçues ne doivent pas être recréées.

## Travaux de schéma et de code encore à préparer

- Transactions applicatives : createApplicationDatabase expose actuellement query/close ; un callback transactionnel sur une seule connexion vérifiée est nécessaire pour réaliser les ports atomiques. Ne pas simuler une transaction par plusieurs appels query susceptibles d'emprunter des connexions différentes.
- Sessions7.2 : préparer le repository durable sur0002/0011, issue/rotate/revoke atomiques, revalidation du compte/epoch, audit et contrats de composition avec7.1. Les tests de code indépendants sont possibles avant réception PG.
- Acceptations/versions légales et bootstrap propriétaire : préparation technique possible, identité et textes réellement approuvés requis pour leur usage ; aucun bootstrap public.
- Schémas changement d'e-mail et récupération, outbox privée chiffrée et champs d'audit complémentaires : migrations/tests/propositions à écrire, pas seulement à appliquer.
- Transfert7.15 : invitations_profile_fk constatée non différable et liée au profil courant pour toutes les invitations. Une promotion de compte invité nécessite une correction versionnée conservant l'historique et la concordance des invitations utilisables. Pas de suppression d'invitation ou désactivation de contrainte.
- Contextes d'autorisation et gardes/routes/UI à raccorder ; alertes de sécurité propriétaire et réceptions PostgreSQL/API/SSE/navigateur à prouver.

## Reprise recommandée à ce jalon

Reprendre **l'intégration 7.1–7.2**, en commençant par l'audit/préparation du support transactionnel utilisé par SessionStore, puis persistance des sessions et composition auth/API testable. Ces travaux ne nécessitent pas d'exécuter soi-même une migration ni d'élargir les droits de dental-ai. Documenter les tests PostgreSQL bloqués tout en écrivant les adapters indépendants.

Les modules ultérieurs indépendants peuvent avancer selon CONSIGNE§10, mais ne pas laisser croire que le chapitre7 n'attend que l'administrateur. Aucun point entièrement réceptionné ici et aucune mise en production autorisée par ce bilan. Deux points maximum par session et arrêt volontaire en fin de lot.
