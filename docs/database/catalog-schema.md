# Catalogue et snapshots — préparation du point 6.4

Statut : migration0003 APPLIQUÉE selon rapport administrateur ; réception finale EN ATTENTE. Références : CAHIER_DES_CHARGES §3, modèles orders-versions et drafts-sync, architecture modulaire. Aucun référentiel réel initialisé, aucune permission SQL ajoutée. Réception administrateur requise pour clôture6.4.

| Objet préparé | Responsabilité |
|---|---|
| catalog_references | Identité UUID durable, catégorie material/shade/work_type, état disponible/indisponible/interdit, raison obligatoire d’interdiction, révision et auteur |
| catalog_entries | Catalogue courant : libellé et activation, une entrée par identité |
| catalog_reference_snapshots | Libellé figé, catégorie, identité et révision source si disponibles ; historique distinct du catalogue courant |
| catalog_effective_states | Lecture de l’état actuel : interdiction prioritaire, référence absente/inactive indisponible, sinon état courant |

H64-01, choix technique réversible : une identité durable est distincte de l’entrée du catalogue. Supprimer l’entrée courante est un vrai DELETE de catalog_entries ; l’identité et les snapshots demeurent. La FK des snapshots cible l’identité et sa catégorie, sans cascade. Une identité encore référencée par un snapshot ne peut être supprimée. Il ne s’agit pas d’une purge d’historique ni d’une durée légale de rétention.

H64-02 : l’absence d’entrée ou sa désactivation produit un état effectif unavailable, conformément au parcours d’avertissement/acceptation exceptionnelle. Une interdiction reste forbidden même si l’entrée courante est supprimée ou inactive ; sa raison demeure portée par l’identité. Cela ne crée aucune permission de soumission ni d’acceptation : les services devront vérifier compte, workflow, état actuel et justification selon le CDC. Aucun état figé dans un snapshot ne devient une autorisation.

H64-03 : table générique avec catégories fermées, sans liaison matériau/teinte. Les teintes sont communes aux matériaux. Le caractère obligatoire matériau/teinte et facultatif type sera imposé sur les versions de commande au point6.5 ; il ne faut pas imposer une ligne de type à chaque version. Aucune unicité de libellé, quantité, prix ou règle de matériau/teinte non demandée.

## Capture et réutilisation historique

Les services devront verrouiller/lire la référence courante et sa révision dans la transaction de création de version, puis insérer le libellé figé autorisé. Un renommage ou une suppression de l’entrée courante ne réécrit pas ce snapshot. La révision d’agrégat doit évoluer lors de modification du libellé, de l’activation ou de l’état ; aucune incrémentation automatique n’est prétendue installée.

Une valeur historique sans identifiant disponible est représentable par reference_id/source_revision NULL. Si l’identifiant est présent, la révision source est obligatoire et la catégorie doit correspondre. Ce format ne permet pas à un navigateur de fabriquer une référence utilisable : les futurs contrats de soumission sélectionnent des identifiants revalidés, et les données de snapshot sont produites par le serveur. Aucun nouveau parcours d’import public ajouté.

Les futures commandes/brouillons référenceront les snapshots par leurs propres FK, avec leur catégorie contrôlée. Ces associations sont à construire en6.5 et aux étapes brouillons ; aucune table de commande ou brouillon inexistante n’est annoncée créée ici. La suppression du catalogue courant n’affecte pas les champs historiques.

Les snapshots sont destinés à être append-only pour les chemins applicatifs. Cette migration ne crée pas de trigger d’immutabilité, ne transforme pas le filtre du lanceur et ne prétend pas empêcher un administrateur/migrateur de modifier l’historique. Les grants futurs doivent exclure UPDATE/DELETE des snapshots et suppression des identités utilisées, avec les contrôles serveur/version/audit. Actuellement runtime et audit n’ont aucun accès aux nouvelles tables par défaut. Aucune règle de purge n’est introduite.

## Sécurité et contrôles restant aux services

- Interdiction : revalidation à nouvelle soumission/acceptation, blocage préventif des travaux non livrés et examen des travaux livrés ; jamais annulation automatique.
- Indisponibilité : avertissement et justification/confirmation de l’acceptation exceptionnelle, sans réactivation globale implicite.
- Auteur et changement d’état : permissions actuelles et audit durable aux étapes dédiées. changed_by NULL représente une opération de système/initialisation à encadrer ; les routes humaines doivent attribuer l’acteur.
- Identités, FK et timestamps : révision positive, temps finis, catégorie fermée, raison non vide si forbidden, aucune cascade de suppression.
- Catalogue et snapshots ne contiennent aucune donnée patient. Rétention et sauvegarde restent leurs validations propres.

## Validation préparée

Le catalogue de migrations vérifie les octets/modes/SHA et le filtre rev3, sans SQL ni privilège. Les six migrations/sondes déjà enregistrées sont épinglées et non rejouables, selon les réceptions connues ; l’inventaire ne remplace pas le registre root.

tests/migrations/catalog_constraints.sql prépare un test PostgreSQL sous rôle local migrateur, transaction annulée : renommage préserve libellé/révision ; DELETE de l’entrée préserve snapshot ; désactivation devient indisponible ; suppression ne masque pas l’interdiction ;15refus SQLSTATE sur états/catégories/motifs/libellés/FK/révisions/auteur. Aucune exécution ni réussite SQL réelle revendiquée par IA. Le filtre hors ligne ne prouve pas la syntaxe/contraintes du serveur.

docs/admin-proposals/POINT_6_4_ADMIN.md contient les deux fichiers/SHA à approuver, la migration aller via le lanceur existant et les commandes de recette/audit/retour arrière. Risque : DDL durable après succès, correction par nouvelle migration approuvée ; aucun DROP automatique ni permissions élargies. Valider3tables/1vue/ownership/contraintes,15refus+préservation historique, ROLLBACK/zérofixture, reçus/snapshot/pending et fermeture avant réception finale ; préparation indépendante de6.5 autorisée par stratégie du12/10/2026.

Application rapportée le12/10/2026 : CREATE TABLE ×3, CREATE INDEX, CREATE VIEW et succès contrôlé. Audit IA readonly : objets/ownership conformes, 93 contraintes toutes validées, migrateur NOLOGIN et zéro session. Les 15 tests SQL, préservation historique, ROLLBACK, audit final et reçu/snapshot restent différés. Aucun rejeu effectué.
