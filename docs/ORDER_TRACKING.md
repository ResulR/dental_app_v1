# Suivi clinique et laboratoire — 9.8

## Implémentation sans activation

Deux lectures POST privées : `/api/v1/orders/search` et `/api/v1/orders/detail`. Recherche en corps JSON, jamais dans une URL : numéro, clinique et patient seulement si l'identité actuelle peut lire les détails. Les valeurs sont paramétrées ; les jokers SQL ne changent pas le sens du texte recherché. Filtres statut, travail normal/retouche, date souhaitée ou planifiée, intervalle inclusif. Pagination de 50 commandes par UUID ; ordre technique stable, sans promesse de tri chronologique ou de snapshot entre pages.

Clinique approuvée/non suspendue : périmètre déduit de son compte actuel, jamais du client. Laboratoire : `orders.read_logistics` requis, détails et recherche patient réservés à `orders.read_details`. Compte, session, clinique et permissions sont relus sous verrous dans chaque transaction. Une fiche étrangère et une fiche absente donnent le même refus. Aucun patient ni instruction dans les lignes logistiques.

Fiche : version officielle courante, libellés des snapshots historiques, patient/référence, dates distinctes, dents, instructions, nombre de fichiers et blocage sécurité. Historique des statuts paginé par révision (100 événements), dates/auteur/motif/version dans le contrat. La commande reste verrouillée pendant la lecture fiche/historique. Il ne s'agit pas encore d'un comparateur de toutes les versions d'instructions.

Interface albanaise branchée sur ces routes : filtres, pages, fiche et historique. Aucun succès simulé, stockage local patient, retry automatique ou accès aux fichiers. Échec : données affichées effacées, relecture explicite nécessaire. Requêtes annulées après huit secondes ou démontage. Les contrôles serveur restent nécessaires malgré les permissions d'affichage.

Depuis le formulaire clinique, une correspondance de similarité 9.6 peut
préremplir le numéro dans la recherche de suivi, sans déclencher une lecture
automatique. Le lien reste accessible au clavier ; chaque clic prépare une
nouvelle recherche. Ce numéro n'est réutilisé que pour le compte authentifié
qui l'a sélectionné. Le test de rendu vérifie le préremplissage ; la réception
navigateur et PostgreSQL reste ouverte.

## Dépendances et réception

`DENTAL_LAB_ORDER_TRACKING_ENABLED` est désactivé par défaut ; toute activation exige explicitement le dépôt de commandes activé, lui-même soumis aux dépendances runtime existantes. Aucun flag n'a été changé, aucun service relancé, aucun SQL appliqué. Schémas existants0003/0004/0007/0008/0010 utilisés ; aucun nouveau DDL pour ce lot.

Tests ciblés : doubles SQL, HTTP local et client réel de validation ; ils ne démontrent pas la validité des requêtes, privilèges ou verrous sur PostgreSQL réel. Réception SQL séparée toujours nécessaire, ainsi que navigation/ergonomie/accessibilité sur navigateur réel. Les verrous partagés garantissent le modèle de lecture prévu mais leur contention et leur compatibilité avec les writers devront être mesurées dans l'environnement isolé autorisé.

Restent indépendamment : transitions fin de fabrication/livraison, corrections et demandes pendantes, versions comparées, création laboratoire, retouches, pièces jointes réelles. Les événements affichés proviennent de la base ; aucune de ces écritures manquantes n'est simulée par ce panneau. Aucune preuve historique v1/v2/v3 rejouée ou modifiée.

Le reçu d'un dépôt confirmé propose maintenant un lien direct vers le suivi.
Le numéro attribué par le serveur préremplit le champ de recherche, qui doit
être déclenchée explicitement ; les permissions et le périmètre de clinique
restent contrôlés par le serveur. Le rendu est testé hors navigateur.
