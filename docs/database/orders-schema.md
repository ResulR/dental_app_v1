# Schéma commandes, dents et versions — 6.5

Préparé, non appliqué : 0004_orders_versions.sql. CDC§§4–8/14, orders-versions et contrats partagés existants inspectés. 8 tables : orders, order_versions, order_version_teeth, order_logistics, order_status_events, order_logistics_events, order_security_blocks, submission_receipts.

Numéro bigint IDENTITY serveur, sans format ni séquence sans trous imposés ; identité créée à la soumission, jamais brouillon. Chaque version comporte un seul matériau/teinte snapshot typé ; type facultatif. FK composée empêche versions d'une autre commande/clinique. Current obligatoire différé pour insertion atomique ordre/version ; manufacturing référence une version du même travail. Aucun champ financier ni affectation employé.

Patient : référence interne OU prénom/nom ; les deux permis. Normal clinique impose date souhaitée ; parcours labo/retouche n'ajoute pas cette obligation non décidée. Retouche impose description ; dent FDI seulement normal, domaine permanent32, unique parversion ; absence de dent/description normale permise. Date planifiée indépendante, modes fermés, sortie avec auteur/date/échéance ; services calculent J+30 en fuseau Europe/Pristina, sans assimiler archivage à purge.

Versions/événements/snapshots sont append-only logiquement ; pas de trigger prétendu installé. 6.11 doit retirer UPDATE/DELETE historiques. Services futurs : revalidation catalogue, acteur/clinique/grants, automate, dernière révision, motif selon action, gel manufacturing, corrections livraison, sérialisation et transaction versions/historiques/outbox. Les CHECK/FK ne prouvent pas ces opérations intertables. JSON logistique ne doit contenir que projection logistique expurgée ; pas patient/instructions.

Sécurité : bloc catalogue orthogonal au statut, clearance tracée sans contournement d'interdiction ; idempotence unique compte/intention/clé et SHA32, résultat mêmecommande, empreinte à comparer côté service. Pas de service ni endpoint ajouté en6.5. Médias et demandes/liens arrivent6.6/6.7 ; aucune référence à table inexistante.

Recette orders_constraints.sql : 15 refus SQLSTATE et cas positifs, transaction ROLLBACK, NON exécutée IA. SQLSTATE, relations typées/intercliniques, FDI, version, raisons, livraison, intention à réceptionner. Catalogue/filtre horsligne seulement ne prouve pas syntaxe serveur. POINT_6_5_ADMIN.md décrit application et recette après approbation spécifique ; consolidation en finchapitre.
