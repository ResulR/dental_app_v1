# Administration du catalogue — 8.2 et restrictions 8.4–8.5

Préparation applicative depuis ec7d00f ; aucune activation, migration ou donnée réelle modifiée. Trois catégories indépendantes, sans prix ni relation matériau/teinte ajoutée. API réelle sous DENTAL_LAB_CATALOG_MANAGEMENT_ENABLED, false par défaut et dépendante de l'authentification. L'interface albanaise appelle cette API ; pas de fallback simulé.

## Parcours et autorité

GET /api/v1/catalog-management (after UUID), GET /:id, GET /:id/history (before révision), POST collection et PUT /:id. Session, epoch, échéances, état du compte et catalog.manage effectifs relus dans chaque transaction ; compte, grants et session verrouillés. Clinique refusée ; le droit de créer des commandes seul n'autorise aucune administration. Contrats stricts, origin mutation obligatoire, identité issue de la session, révision attendue et verrou référence. Une réponse incertaine ne déclenche aucun rejeu automatique ; relire l'historique.

Ajout, renommage, activation/désactivation, état disponible/indisponible et retrait du catalogue courant. La catégorie reste immuable. Le retrait supprime catalog_entries uniquement : catalog_references, snapshots, versions, brouillons et archives ne sont jamais réécrits. Pas d'unicité de libellé inventée. No-op sans nouvelle révision/événement ; conflit explicite sur révision obsolète.

H82-01 : bornes techniques 500 caractères pour un nouveau libellé, 2000 pour un motif, pages 50+1 ; elles ne constituent pas des règles cliniques. Les libellés historiques restent lisibles sans troncature.

## Interdiction et impacts

Commande distincte restrict, motif non vide obligatoire. Une référence déjà interdite ne peut être renommée, retirée, réactivée ou voir son motif remplacé par cette API, même par le propriétaire. Une référence retirée peut encore être interdite. Aucune procédure de levée n'est inventée (CDC19.1).

Une transaction verrouille la référence puis les commandes utilisant ses snapshots, y compris dans les anciennes versions ; écrit l'interdiction, les blocages actifs des travaux non livrés, l'historique, l'audit, catalog_changed et security_alert avec dispatch, notification interne et intention e-mail propriétaire pending. Les travaux livrés restent consultables pour examen, sans blocage ni changement de statut. Aucune annulation automatique ; aucun message envoyé. L'absence de propriétaire ou une erreur d'écriture fait échouer la transaction entière.

H82-02 : borne de capacité 1000 travaux concernés par transaction sur ce VPS partagé. La requête lit au plus 1001 travaux et refuse avant toute écriture au-delà ; aucune interdiction partielle, traitement tronqué ou relâchement automatique. Avant exploitation à volume supérieur, revoir l'implémentation sous une recette de capacité et d'atomicité distincte.

GET /:id/impacts est réservé au propriétaire courant côté serveur ; liste paginée numéro/statut/identité de clinique, sans patient ni détail médical. L'UI réserve ce bouton au propriétaire et distingue les travaux livrés.

## Garanties restant à recevoir

0019_catalog_history.sql ajoute uniquement un historique append-only (SELECT/INSERT pour le rôle applicatif), unique par référence/révision. SHA-256 : b3780f0e41d52e00ca6a12a81bd72b473479d49ecd9391fed0787fbc100daea9. Migration proposée, NON APPLIQUÉE ; scripts/receipts historiques inchangés. Readiness refuse historique absent ou modifiable et privilèges incomplets, sans GRANT automatique.

Les tests unitaires utilisent un double SQL et les tests HTTP un serveur éphémère local. Ils contrôlent autorité, transactions demandées, refus, ordre/absence d'écritures historiques et propagation des échecs ; ils ne prouvent pas le ROLLBACK, les privilèges ou la concurrence PostgreSQL réelle.

Avant activation : recevoir SQL0019 et les dépendances différées (6.4, commandes, notifications/privilèges), tester préservation historique, permissions minimales, concurrence modification/restriction et rollback complet incluant alertes. Ne rejouer aucune ancienne recette. Les futurs writers de versions/progression doivent verrouiller les références dans un ordre stable AVANT la commande et relire l'état effectif/blocages dans la transaction : le verrou de la commande seule ne prévient pas l'ajout concurrent d'une nouvelle utilisation. Ces writers n'existent pas encore ; 8.3 et la protection de progression 8.4–8.5 ne sont donc pas clôturées. UI/navigateur et revue métier albanaise restent différés.

L'exception commerciale d'indisponibilité doit conserver avertissement, motif et confirmation explicite sans réactivation globale. La présente administration prépare cet état, mais ne prétend pas livrer la soumission/acceptation des chapitres9–10. Aucune levée réglementaire ou mesure sur un travail livré n'est disponible sans décision métier validée.
