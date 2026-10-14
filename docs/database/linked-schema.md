# Demandes et travaux liés — schéma6.6 préparé

CDC5.2–6/R14 et modèles audités ; aucun mécanisme antérieur. Migration0005 non appliquée : order_requests, work_links, active_retouch_slots (vue).

Demandes : une unicité partielle pending sur order_id, commune modification/annulation. Base/proposition FK mêmecommande ; original reste current jusqu'àdécision service. États pending/accepted/rejected/withdrawn/closed, auteur/dates/motif, closed seulement cause order_cancelled H35-01. Les services sérialisent demande/démarrage/modification sur orders et refusent conflit de version ; SQL ne remplace pas ces décisions.

Raffinement technique H66-01 de la proposition3.6 : pas de table de slot manuel susceptible d'être oubliée. work_links porte une projection child_current_status contrainte à l'état réel orders par FK ON UPDATE CASCADE. Index partiel unique retouch/source pour états actifs ; sortie terminale met automatiquement à jour la projection et libère l'index, liens historiques conservés. active_retouch_slots est une vue sur cet index. Aucun statut source historique modifié par cascade. Modification autorisée de cette seule projection par FK à concilier avec grants6.11 ; les champs de filiation restent append-only.

FK composées mêmeclinique, enfant unique, catégorie enfant retouch/normal générée, source!=enfant, capture source_revision/status. Retouche/requalification retouch/remanufacture et source livrée ; remplacement/supplément depuis manufacturing/completed/delivered ; resoumission depuis rejected/cancelled. R14 conserve ancienne source completed/delivered ; manufacturing à annuler atomiquement côté service. La capture n'autorise pas une source dont l'état réel diffère : serveur verrouille et vérifie.

Les services doivent créer un enfant neuf et lien dans la même transaction, refuser cycles/rattachement d'ancien travail, assurer une filiation à chaque retouche et revalider permissions/catégories ; ces invariants ne sont pas prétendus intégralement assurés par FK seule. Chaque action gardeaudit/outbox/idempotence. Pas de restriction inventée sur nombre de suppléments/remplacementsexceptionnels.

linked_constraints.sql prépare11refus et cas positifs : demandes uniques, lienscrossclinique/self,projectionforgée, deuxième active refusée, statutterminal libère et nouvelle active possible sans perdreliens. NON exécuté. La course réelle à deuxsessions et opérations multiagrégats restent différées et requises avant réception complète6.6. POINT_6_6_ADMIN.md/procédure consolidée ne dispensent pas de ces preuves.

## Correction de réception v2 — 14/10/2026, non appliquée en production

La FK unique combinant type généré et statut avec ON UPDATE CASCADE est incompatible PG17. La source0005 v2 sépare work_links_child_kind_fk (NO ACTION) et work_links_child_status_fk (CASCADE), avec deux UNIQUE cibles. Index actif/vue/ACL et filiation inchangés. Seule la création sur base neuve de recette est visée ; reçus production inaccessibles à dental-ai, aucune décision de rejeu. Voir ../admin-proposals/SHARED_VPS_POSTGRES_RECEPTION_V2.md. Tests statiques réussis ; tests PostgreSQL v2 non exécutés.
