# État de la roadmap au 27 octobre 2026

Lecture des 21 chapitres et confrontation ciblée aux sources, tests et critères.
Les nombres ci-dessous sont les **statuts documentés** des points atomiques ;
« validé » peut désigner une conception, non une fonction opérationnelle.
Les chapitres 07–21 ont surtout des implémentations partielles ou des portes
de recette ouvertes. Ce relevé ne requalifie pas rétroactivement chaque case
historique en preuve d'intégration. Le code et les tests consultés confirment
des fondations réelles (authentification, catalogue, commande, transitions,
audit, notifications dormantes), tandis que l'application entière n'a pas
été reçue en navigateur ni contre une base de production.

| Chapitre | Statuts documentés | État vérifié et reste décisif | Priorité |
| --- | --- | --- | --- |
| 01 Cadrage | 6 validés | Sources et périmètre tracés ; critères produits encore à recevoir | Support |
| 02 VPS | 9 validés | Garde d'identité et qualité actives ; aucune mise en production | Sécurité |
| 03 Architecture | 11 validés | Modèles et contrats présents ; intégration totale ouverte | Support |
| 04 UX | 12 validés, 2 partiels | Maquettes documentées ; recette navigateur/accessibilité ouverte | Haute |
| 05 Code/qualité | 8 validés, 1 partiel | Toolchain et tests présents ; PWA navigateur ouverte | Haute |
| 06 PostgreSQL | 3 validés, 8 partiels | Schémas et recettes isolées ; migrations de production interdites | Haute |
| 07 Identité | 15 partiels | Routes et permissions présentes ; réception intégrée et gouvernance ouvertes | Critique |
| 08 Catalogue | 6 partiels | API, états, snapshots présents ; réception SQL/UI ouverte | Critique |
| 09 Commande clinique | 7 partiels, 3 à faire avant cette session | Précontrôle, dépôt et suivi câblés sous drapeaux ; 9.6 en cours | Critique |
| 10 Workflow | 14 partiels, 1 à faire | Transitions, décisions, historique partiels ; concurrence métier à recevoir | Critique |
| 11 Retouches | 6 partiels | Logique liée présente ; parcours complet à recevoir | Haute |
| 12 Fichiers | 4 partiels, 9 à faire | Contrats et bornes partiels ; stockage/transfert privés bloquants | Critique |
| 13 Messagerie | 8 partiels, 1 bloqué | Modèle et routes partiels ; temps réel et pièces jointes ouverts | Haute |
| 14 Notifications | 14.1–14.2 partiels, 14.3 recette v17 reçue, 14.4–14.9 à faire | HMAC et preuves préparés ; fournisseur et livraison restent dormants | Haute |
| 15 PWA | 10 à faire | Conception de coffre ; implémentation et navigateur absents | Haute |
| 16 Planning | 1 à faire, 8 partiels | Endpoints partiels ; calendrier et réception ouverts | Haute |
| 17 Administration | 3 partiels, 10 à faire | Audit et rétention partiels ; conformité et procédures ouvertes | Haute |
| 18 Sécurité | 8 à faire | Gates transverses de sécurité et performance ouverts | Critique avant production |
| 19 Infrastructure | 12 à faire | Préproduction, sauvegardes et restauration non reçues | Critique avant production |
| 20 Recette | 12 à faire | Parcours complets non démontrés | Critique avant production |
| 21 Mise en production | 10 à faire | Aucun déploiement autorisé ni effectué | Bloqué |

Priorités suivantes, sous dépendances : (1) terminer le parcours 9.6 par
recette SQL isolée spécifiquement examinée et navigateur, sans exploiter
l'autorisation v17 pour une nouvelle recette ; (2) poursuivre commande et
workflow clinique/laboratoire avec permissions et concurrence ; (3) débloquer
fichiers privés et transfert, condition des commandes avec pièces et de la
messagerie. Le contrat HMAC et sa persistance restent préparés ; la livraison
e-mail ne doit pas être activée.
