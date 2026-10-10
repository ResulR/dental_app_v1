# Travaux liés et retouches — point 3.6

Sources : CAHIER_DES_CHARGES §§5.3–6, décision R14 intégrée au §5.5 ; [automate](order-state-machine.md), [versions](orders-versions.md) et [permissions](permissions.md). Conception seulement : aucun objet SQL créé.

## Identités et liens

Table proposée work_links : id PK, source_order_id, child_order_id UNIQUE, clinic_id, kind (resubmission/replacement/supplement/retouch), intervention_kind nullable (retouch/remanufacture pour retouch), source_revision/source_status_at_creation, created_by, created_at, reason et idempotency_receipt_id. Parent et enfant ont chacun number, versions et conversation de orders.

FK composées vers orders(clinic_id, id) pour source et enfant : interdit un lien interclinique. CHECK source != child. Le lien est append et non réassignable ; les API créent toujours un enfant neuf à partir d'un parent existant autorisé. Cela interdit de relier deux anciens travaux arbitrairement ou de reparentifier une chaîne. Un contrôle de cohérence SQL/service à éprouver interdira cycles et enfant sans lien annoncé ; aucun trigger prétendument déployé.

Le lien porte sur le travail réellement concerné, pas automatiquement sur la racine. Si B remplace A et B est livré, la demande clinique pour B a B comme source ; A reste visible dans la chaîne selon droits. Afficher parent/enfants dans les deux sens, distinguer nature du lien et états actuels, sans écraser le lien précédent.

| Type / origine | Source autorisée | Enfant à création | Effet source |
|---|---|---|---|
| resubmission / clinique | Refusée ou Annulée | En attente | Ancienne identité, statut et historique inchangés ; copie préremplie revalidée |
| replacement / labo habilité | En fabrication | Acceptée | Annulée avec motif et trace ; instructions conservées |
| replacement exceptionnel / labo habilité | Terminée ou Livrée | Acceptée | R14 : statut/version/livraison inchangés ; nouvelle identité et conversation |
| supplement / labo habilité | En fabrication, Terminée, Livrée | Acceptée | Statut et instructions inchangés ; travail distinct |
| retouch / clinique | Livrée, même archivée | En attente | Source inchangée ; approbation manuelle, pas d'exception automatique |

Le supplément après achèvement/livraison reprend H35-02. Aucun lien de remplacement/supplément depuis En attente/Acceptée/Refusée/Annulée n'est ajouté ; les modifications ou duplications prévues restent leurs parcours.

## Retouche : contenu et unicité

Une retouche/refabrication a le même socle de workflow, versions, demandes, verrouillage, numéro et conversation qu'un travail normal. Formulaire simplifié : matériau/teinte préremplis et modifiables, description du problème et dents concernées obligatoire sous forme textuelle, pas de schéma FDI ; pièces facultatives. Valeurs historiques préremplies ne dispensent pas de revalider le catalogue actuel.

La règle concerne une retouche active par travail source livré. Active = En attente, Correction demandée, Acceptée, En fabrication ou Terminée. Refusée, Annulée ou Livrée libère la possibilité d'une nouvelle demande sur la source, sans effacer le lien historique. Annuler une retouche ne change jamais le statut de son parent.

Proposition de contrainte active : table active_retouch_slots(source_order_id PK, child_order_id UNIQUE, clinic_id), FKs vers work_links et les mêmes travaux/clinique. Création et acquisition du slot dans une transaction ; source verrouillée, statut Livrée contrôlé, absence de slot actif. Une contrainte différée/service vérifie la correspondance kind=retouch et état actif ; le slot ne doit pas survivre à une transition terminale, ni manquer pour une retouche active. Libération lors du passage de l'enfant à Refusée/Annulée/Livrée dans la même transaction.

Une simple unicité sur work_links(source, kind) serait incorrecte : elle empêcherait toute retouche future après clôture. Un index sur l'état d'une autre table n'est pas supposé suffisant. Migration et courses seront testées avant validation réelle.

Aucune limite d'un remplacement ou supplément actif n'est inventée. Après le premier remplacement d'une source En fabrication, celle-ci est Annulée : une autre demande sur cette ancienne source échoue par état courant. Pour Terminée/Livrée, plusieurs intentions métier distinctes ne sont pas confondues avec un double clic. Un remplacement exceptionnel labo n'est pas une demande clinique de retouche ; il ne consomme ni ne libère fictivement le slot retouche.

## Transactions et anti-doublon

1. Authentifier, charger parent dans le périmètre, vérifier grant, intention/idempotency_key et révision.
2. Verrouiller les agrégats concernés dans un ordre déterministe par identifiant, puis recontrôler états et blocages. Retouche : sérialiser création/terminal/correction livraison sur source et slot.
3. Créer le travail et sa version, attacher seulement des fichiers autorisés/vérifiés, créer conversation, lien, éventuel slot ; annuler la source seulement pour remplacement en fabrication. Ajouter historiques/audit/outbox et reçu dans la transaction.
4. Commit puis acquittement. Une clé déjà réussie retourne le même enfant ; payload différent sous même clé = conflit. Échec SQL = aucun enfant/lien/annulation/slot partiellement publié.

L'ordre de verrouillage doit être partagé par orders, delivery et linked-works. La correction de livraison contrôlée par delivery interroge l'existence de retouches liées via son port minimal et reste bloquée si contradiction selon §7, y compris une retouche historique ; ne pas la déclarer automatiquement résolue par simple absence de slot actif.

Les copies préremplies ne réutilisent pas aveuglément les dates ou les fichiers : disponibilité, intégrité, droit actuel et catalogue sont revalidés. Pas de transfert interclinique des pièces ni deduplication globale révélatrice de données.

## Historique, visibilité et notifications

Chaque lien capture le type, la source, l'enfant, l'état/révision source au moment de création, auteur/date et motif utile. Une projection logistique peut montrer la chaîne/numéros/statuts autorisés sans instructions/patient. Détail et fichiers gardent leurs droits ; un lien ne constitue pas un grant.

La source Livrée conserve conversation close et échéance d'archive, le nouvel enfant a sa propre conversation ouverte. Une retouche livrée peut à son tour être la source réellement concernée par une nouvelle retouche : aucun raccourci silencieux vers la racine.

Création labo : email + notification interne clinique selon §5.4, pas une demande à approuver par la clinique. Nouvelle retouche clinique : email labo et priorité inbox selon §6. Pas de prix, garantie ou prise en charge ajouté.

## Vérifications d'implémentation attendues

- Deux clics/même intention : un enfant et un seul lien, résultat récupérable après réponse perdue.
- Deux demandes de retouche concurrentes : un seul slot/enfant actif ; échec complet de l'autre.
- Retouche refusée/annulée/livrée : slot libéré, liens historiques conservés, nouvelle demande possible.
- Remplacement en fabrication : annulation source atomique ; refus si sa révision/état a changé.
- Remplacement de Terminée/Livrée : source/version/livraison/conversation inchangées.
- Lien interclinique, auto-lien, cycle, rattachement d'ancien enfant : refus.
- Travail livré B remplaçant A : retouche attachée à B si B réellement concerné.
- Correction de livraison et retouche concurrentes : décisions cohérentes, aucune réouverture incompatible.
- Référence interdite ou fichier inaccessible : aucun enfant partiellement créé.
- Panne email : travaux/liens restent valides, relance indépendante.

Validation 3.6 : revue de conception des identités, liens, états et anti-doublon. Ces scénarios ne sont pas des tests SQL/API exécutés.
