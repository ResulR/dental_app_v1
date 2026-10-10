# Fichiers, ACL et cycle de vie — point 3.7

Sources : CDC §§4.2, 8, 9, 11–12 et 14–15 ; [permissions](permissions.md), [versions](orders-versions.md), [architecture](../architecture.md). Aucun stockage/runtime choisi ou installé à cette étape : chemins, fournisseurs, clés, quotas et antimalware opérationnels restent à auditer/configurer aux jalons dédiés.

## Métadonnées et références

| Entité proposée | Données/contraintes | Propriété |
|---|---|---|
| file_objects | id PK, clinic_id, created_by, object_key opaque UNIQUE, filename_original, media_type_verified, size_bytes, content_sha256, state, created_at, verified_at, storage_policy_version | Objet binaire original immuable ; contenu privé, nom non utilisé comme chemin disque |
| upload_sessions | id PK, account_id/clinic_id, intended_parent/type, declared_size, received_bytes, state, expires_at, revision, capacity_reservation_id | Une session appartient au compte, la reprise exige l'autorité actuelle ; parent final recontrôlé |
| upload_chunks | upload_id FK, segment_index, offset, size_bytes, sha256, état vérifié ; PK(upload_id, segment_index) | Segments cohérents sans trou/chevauchement ; répétition identique idempotente, différente refusée |
| file_bindings | id PK, file_id FK, clinic_id, parent_type/id, category, created_by/at, visibility, revoked_at, revision | Référence métier autorisée ; FK de clinique commune et parent typé concret |
| file_derivatives | id PK, file_id FK, type, object_key, hash, state | Aperçu/miniature isolé de l'original ; mêmes droits et conservation |
| file_events | id PK, file/binding/upload_id, acteur, at, action, différence utile | Partage/révocation/attachement/retrait tracés sans path/secret/contenu médical dans logs |

Le parent polymorphe est un concept de contrat, pas une FK SQL fictive. À la migration, utiliser des associations typées vers version de travail, suivi, message ou brouillon, avec FK composées et contrainte d'un seul type de parent. Les références de fabrication sont celles de order_version_files, pas une liste mutable globale.

Un même objet n'est réutilisable que via une nouvelle association explicitement autorisée ; aucune déduplication interclinique révélant hash, présence, nom ou taille. Les hashes servent l'intégrité, pas une autorisation. Réutilisation dans un nouveau travail liée à disponibilité réelle/droits, jamais au seul fait de connaître file_id.

## Catégories et visibilité

| Catégorie | Parent et visibilité | Mutation |
|---|---|---|
| Fabrication officielle | Version de travail de la clinique ; accès parent/données détaillées + view ou download pour labo, propriétaire clinique dans son périmètre | Nouvelle version avant fabrication selon workflow ; verrouillée après démarrage |
| Suivi | Travail, interne labo par défaut | Ajout indépendant des instructions ; partage individuel confirmé par habilité et révocation des accès futurs |
| Messagerie de travail | Message/conversation du travail autorisés + accès fichiers/données correspondantes | Versions/masquage traçables, pas remplacement d'instructions officielles |
| Messagerie générale | Message/conversation générale de sa clinique autorisés + droits fichiers pertinents | Aucune dépendance à une commande inexistante |
| Brouillon serveur | Compte/clinique propriétaire du brouillon | Révisions et conflits explicites ; pas de partage implicite avec tout le labo |
| Brouillon local | Coffre chiffré du même compte dans le navigateur | Déverrouillage supplémentaire ; hors cache des commandes officielles |
| Transfert temporaire | Compte initiateur et destination prévue, jamais public | Borné en durée/capacité ; reprise tant que segments existent, nettoyage distinct |
| Archive UI | Références du travail conservées selon rétention | Même statut/droits ; J+30 ne supprime pas les pièces |

Policy d'accès : identité/session/compte courant, clinique commune, parent et données accessibles, catégorie/partage actifs, capacité demandée et état technique sain. Le port d'autorisation parent de files est raccordé en composition ; jamais clinic_id ou effective_grants acceptés du client.

View et download distincts ; ZIP exige download pour chaque association incluse. Aperçus, noms, vignettes, recherche, événements et erreurs reçoivent le même filtre de ressource : aucune fuite de métadonnées en amont. Une visualisation qui livre des octets n'offre pas de garantie anti-copie.

La clinique ne voit pas le suivi interne. Une révocation change le binding, est historisée et invalide les accès/aperçus futurs ; elle ne rappelle pas les copies déjà téléchargées. Un remplacement exceptionnel après livraison n'ouvre pas la conversation/source ni ne modifie ses associations historiques.

## Transferts et finalisation

Machine proposée : initialized → receiving → verifying → ready ; interruption reste receiving reprenable. États d'échec : rejected (taille/type/intégrité/scan), expired, aborted. ready désigne un objet vérifié mais pas forcément attaché à une donnée métier. Le binding est publié par transaction métier après confirmation, pas par le premier fragment reçu.

1. Initialisation : contrôler intention/compte/parent, taille déclarée et réserve de capacité ; ID/clé serveur opaque, aucune destination filesystem libre fournie par navigateur.
2. Réception : vérifier index/offset/taille/hash et bornes effectives ; persister les segments vérifiés et leur acquittement. Même segment/même contenu rejoué = résultat identique.
3. Finalisation : streaming/assemblage borné, taille et hash complets, extension/type/contenu réellement validés, scan/quarantaine selon politique ; pas de blob d'un Go intégral en mémoire.
4. Publication : destination privée immuable, puis état durable ready ; association finale dans transaction de l'ordre/message/brouillon, avec droits recontrôlés. Confirmation explicite pour commande.
5. Réparation : un journal durable distingue objet validé non attaché, fragments partiels et association officielle. PostgreSQL ne transactionne pas le filesystem ; retry/reconciliation sans effacer les fichiers attachés.

Destination privée dédiée au nouveau runtime, hors répertoire web public et hors Git. Résolution bornée dans la racine autorisée, noms opaques, refus traversal/symlinks/remplacements et droits minimaux. Le mécanisme réel sera implémenté et testé ; pas de chemin système ou service inventé ici.

Validation fermée STL/PLY/OBJ/JPG/PNG/HEIC/PDF : extension et type déclaré ne suffisent pas. Parsing/validation limités en CPU/mémoire/temps, fichiers malveillants non servis, dérivés jamais substitués à l'original. Analyse/convertisseurs devront être choisis sans installer globalement ni toucher les voisins.

## Limites et capacité

Hypothèse réversible H37-01 : unités décimales Mo/Go pour le contrat (200 000 000 octets par fichier ; 1 000 000 000 octets initial/message), affichage explicite et même calcul client/serveur. Aucune limite cumulative nouvelle pour modification, suivi ou retouche. Pas de nombre maximum arbitraire ni quota cumulatif de conversation.

La capacité est une politique opérationnelle distincte : réserve minimale disque, budget fichiers/fragments/quarantaine/dérivés, expiration bornée, concurrence et seuils d'alerte. Valeurs exactes/topologie sont bloquantes avant les transferts réels (R07, chapitre 12 et production), pas des chiffres supposés dans ce modèle. Sans politique valide, nouveaux transferts refusés ; ne pas fonctionner avec un seuil par défaut égal à zéro.

Réservations de capacité atomiques avant réception/conversion/ZIP, contrôlées avec consommation réelle et marge d'assemblage. Protection partagée VPS : audit administrateur nécessaire pour capacité réellement dédiée ; espace libre observé ne constitue pas un quota attribué. Ne pas tester saturation en écrivant à l'aveugle.

Une interruption pour manque d'espace conserve les segments vérifiés jusqu'à expiration ; après expiration, informer que la reprise exige retransfert sans détruire le brouillon local. Nettoyage temporaire verrouille session et vérifie absence de binding officiel ; aucun fichier historique supprimé pour libérer de l'espace. Réserve/TTL/rétention légale sont trois politiques différentes.

## ZIP et téléchargement

ZIP à la demande avec manifeste des seuls fichiers actuellement autorisés au téléchargement pour le travail ; inclure toutes les catégories éligibles sans exposer les noms exclus. Si un droit devient invalide, ne pas continuer à produire un contenu nouvellement interdit. Pas de ZIP public/permanent ; streaming ou artefact temporaire borné selon capacité réellement approuvée.

Noms d'entrées assainis contre traversal et collisions, sans modifier les octets originaux. Extraction : hash/tailles identiques aux originaux, y compris HEIC/3D. Les miniatures/previews sont des dérivés nommés et ne remplacent jamais les originaux dans un ZIP prétendument fidèle. Refus/erreurs n'exposent pas les autres associations.

## Conservation et preuves attendues

File/binding/archive/retention sont distincts. Retrait d'un fichier actif crée une nouvelle version avant verrouillage ; conservation historique selon politique légale. Effacement approuvé, litige, dérivés, backups et restauration cohérente traités en 3.10 et chapitres de confidentialité/exploitation.

Tests futurs : IDOR interclinique, metadata/preview/ZIP, partage révoqué, grant retiré, traversal/symlink, payload malveillant, hash erroné, segments manquants/dupliqués, interruption/expiration/capacité, seuil exact et +1 octet, ZIP extrait identique, référence de version verrouillée, panne entre stockage et transaction SQL, nettoyage concurrent à attachement.

3.7 valide ce modèle de référence et la politique de visibilité documentaire. Aucun upload, test de charge, donnée médicale réelle ou contrôle antimalware opérationnel prétendu exécuté.
