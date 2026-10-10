# Commandes et versions — point 3.4

Modèle de conception, fondé sur CAHIER_DES_CHARGES §§3–8, 11, 14–15 et 19. Le schéma public audité est sans table métier ; aucune migration exécutée. [Architecture](../architecture.md), [comptes](accounts-clinics.md) et [permissions](permissions.md) restent les références de composition.

## Identité officielle et références

| Entité proposée | Clés / données | Invariants |
|---|---|---|
| orders | id PK ; number UNIQUE NOT NULL attribué serveur ; clinic_id FK ; kind normal/retouch ; origin clinic/laboratory ; created_by FK ; received_at serveur ; status ; revision ; current_version_id ; manufacturing_version_id nullable | Chaque travail officiel a sa propre identité et conversation ; clinic_id n'est jamais pris comme autorité depuis le body client |
| order_versions | id PK ; order_id FK ; version_number ; created_by FK ; created_at ; reason ; identification patient ; matériau/teinte/type snapshots ; description ; requested_delivery_date | UNIQUE(order_id, version_number) ; version append, jamais écrasée ; FK current/manufacturing vers version du même order |
| order_version_teeth | version_id FK ; fdi ; selection normal/pontic | PK(version_id, fdi) ; FDI permanent seulement ; aucune ligne = non sélectionnée |
| order_version_files | version_id FK ; file_id FK ; catégorie fabrication ; ordre d'affichage si utile | PK(version_id, file_id) ; fichier vérifié, parent/clinique autorisés ; liste officielle fait partie de la version |
| order_logistics | order_id PK/FK ; planned_delivery_date nullable ; priority ; delivery_mode nullable ; revision | Date planifiée distincte de souhaitée ; mode requis lors de sortie ; pas de patient/instructions |
| order_status_events | id PK ; order_id FK ; previous_status ; next_status ; actor/process ; at ; reason ; decided_version_id si pertinent | Append des décisions et transitions, pas écrasement du dernier auteur |
| order_logistics_events | id PK ; order_id FK ; actor ; at ; champs avant/après et motif selon action | Changements de planification/priorité/livraison historisés sans créer une nouvelle instruction |
| order_requests | id PK ; order_id FK ; kind modification/cancellation ; base_version_id ; proposed_version_id nullable ; state pending/accepted/rejected/withdrawn ; actor ; dates/décision | Une seule demande pending au total par order, toutes catégories confondues ; original inchangé avant décision |
| submission_receipts | id PK ; account_id FK ; intent ; idempotency_key ; payload_fingerprint ; order_id FK ; committed_at | UNIQUE(account_id, intent, idempotency_key) ; résultat récupérable après réponse perdue ; même clé avec payload différent = conflit |
| order_security_blocks | id PK ; order_id FK ; cause/reference ; état et décisions | Drapeau indépendant du statut, progression empêchée selon interdiction sans annulation automatique |

La FK composée (order_id, current_version_id) pointe vers (order_versions.order_id, id), et idem pour manufacturing_version_id/base_version_id/proposed_version_id. Elle empêche de greffer une version d'une autre commande même de la même clinique. Les contraintes différées/ordre d'insertion seront éprouvés en migration ; pas d'objet SQL prétendument existant.

Le numéro est attribué dans le parcours de soumission effective, pas lors de création de brouillon local/serveur. Le compteur serveur peut avoir des trous techniques ; aucune exigence de numérotation sans trou ou de format commercial n'est ajoutée. L'horodatage réception est celui du serveur, pas celui de l'appareil hors ligne.

## Contenu et validations

- Patient : prénom ET nom, OU référence interne de la clinique ; les deux modes peuvent coexister. Pas de table patient ni rapprochement global par nom. Données limitées à ce travail et ses versions.
- Un matériau et une teinte obligatoires dans chaque version soumise, communs à toutes les dents. Type et description facultatifs ; aucune obligation de sélection dentaire.
- FDI autorisé : 11–18, 21–28, 31–38, 41–48. Chaque dent possède au plus une sélection normal/pontic ; pas d'identifiant de bridge ou regroupement automatique. UI : non sélectionnée → normal → pontic (« antar ») → non sélectionnée.
- Sans dent ni description : avertissement non bloquant, jamais refus serveur inventé pour cette absence.
- La date souhaitée est obligatoire pour la soumission clinique et appartient à la version ; la date planifiée labo est indépendante et historisée. La conception ne rend pas un champ clinique automatiquement obligatoire pour un parcours labo/retouche non explicitement défini.
- Une version contient le libellé figé matériau/teinte/type et un identifiant de référence stable si disponible. La suppression du catalogue courant ne cascade pas vers versions/brouillons/archives. État courant et snapshot historique sont distincts.
- Nouvelle soumission et acceptation revalident l'état actuel du catalogue : indisponibilité = avertissement/acceptation exceptionnelle justifiée et confirmée ; interdiction = refus/blocage, jamais contournement par owner.
- Pièces initiales facultatives et vérifiées : 200 Mo chacune, 1 Go total initial ; pas de nombre maximum arbitraire. Unités exactes et capacité restent R07/3.7, sans conversion en octets inventée ici.
- Recherche de similitude dans la même clinique : avertissement non bloquant, pas déduplication par nom patient, aucune comparaison interclinique. L'idempotence protège une même intention technique, pas deux travaux métier légitimes similaires.

La retouche reprend ce socle d'identité, versions et workflow avec contenu simplifié propre au §6, à préciser en 3.6 : description du problème/dents concernées obligatoire, pas de schéma dentaire, matériau/teinte préremplis modifiables. Ne pas appliquer aveuglément tous les champs du formulaire clinique normal.

## Statuts et demandes

Domaine fermé : En attente, Correction demandée, Refusée, Acceptée, En fabrication, Terminée, Livrée, Annulée. Les brouillons ne sont pas des commandes officielles dans un statut additionnel. L'archive UI est une projection de Livrée, pas un nouveau statut.

| Situation | Effet sur versions |
|---|---|
| Clinique modifie En attente | Nouvelle version officielle et current_version actualisée ; reste En attente ; décision labo sur version obsolète refusée |
| Clinique corrige Correction demandée | Nouvelle version, statut inchangé jusqu'au renvoi explicite |
| Demande de modification en Acceptée | Proposition distincte liée à base_version ; pas d'écrasement de current_version avant décision |
| Demande acceptée | Publication atomique de la proposition comme version courante, demande décidée, historique et notifications |
| Demande rejetée/retirée | Version officielle inchangée ; proposition et décision conservées selon rétention |
| Modification directe labo en Acceptée | Grant détaillé + action, motif ; aucune demande pendante ; nouvelle version + email/notification interne |
| Début fabrication | manufacturing_version pointe sur current_version et verrouille instructions/fichiers ; demandes pendantes interdites |
| Changement logistique après démarrage | Ne modifie pas manufacturing_version ni ses fichiers |
| Suivi documentaire | Références séparées des fichiers de fabrication ; partage interne par défaut, révocable |
| Refus/annulation puis duplication clinique | Nouveau travail/numéro En attente et filiation, ancien travail inchangé ; revalidation de données/fichiers |
| Création par labo | Nouveau travail Acceptée immédiatement, origine/auteur tracés ; aucune approbation clinique obligatoire |

Chaque décision reçoit une révision d'agrégat et, pour instructions/acceptation, la version attendue. Verrouiller l'agrégat dans la transaction, vérifier l'état courant et les prérequis, publier version/événements/audit/outbox puis commit. Ne pas réutiliser une validation de catalogue ou de permissions effectuée avant une modification concurrente.

L'unicité de demande pending se traduit par un index partiel sur order_id ; elle ne peut pas être séparée par kind. Fabrication et création/retrait/décision de demande se sérialisent sur le même agrégat pour éviter le passage en fabrication simultané à une nouvelle demande.

L'automate exhaustif relève de 3.5. La limite d'état source du remplacement signalée R14 reste ouverte : ce modèle stocke le lien sans autoriser une transition supplémentaire ni trancher une annulation exceptionnelle de Terminée/Livrée.

## Attachement, réception et acquittement

1. Vérifier les transferts terminés, intégrité/contenu, droits et taille avant confirmation finale.
2. Dans une transaction : vérifier l'intention idempotente, l'état du compte/clinique, les références actuelles et fichiers ; créer identité/numéro/version et associations, conversation, audit et événement/outbox.
3. Persister le reçu et renvoyer l'identité créée après commit. Si la réponse est perdue, même clé/payload retrouve ce résultat sans créer un autre numéro/travail.
4. Ne supprimer le brouillon local qu'après confirmation certaine. Une erreur laisse le brouillon récupérable ; la disponibilité future des fragments reste limitée par la politique temporaire distincte.

Le stockage binaire n'est pas rendu transactionnel par PostgreSQL. Les fichiers validés ont un état durable et un cycle réparable, conçu en 3.7 ; pas de suppression des originaux attachés sur simple timeout réseau.

## Livraison, archivage et rétention

La sortie physique a date effective, mode et auteur. Une correction exceptionnelle historise l'erreur et invalide l'échéance d'archive, sans supprimer l'ancien événement ; la nouvelle livraison crée une nouvelle échéance à J+30. La conversation close/rouverte reste cohérente dans la transaction. Contradiction de retouche : correction bloquée jusqu'à résolution explicite.

Livrée reste Livrée après archivage ; données, fichiers et conversations restent soumis aux mêmes droits. J+30 n'est pas une durée d'effacement. Les décisions de rétention/anonymisation seront validées par catégorie, avec gestion des références et minimisation des historiques, sans secret ou copie patient superflue dans l'audit.

## Validation future

Matrice à implémenter : identifications patient alternatives ; zéro dent/description ; FDI invalide/doublon ; un seul matériau/teinte ; snapshot préservé après suppression catalogue ; acceptation obsolète ; modification concurrente/demande unique ; interdiction catalogue ; instruction/fichier figés après démarrage ; suivi séparé ; idempotence après réponse perdue ; parent/version/fichier interclinique refusé ; archive/correction sans perte d'historique.

À 3.4, il s'agit de revue de modèle et de contraintes proposées, pas de tests SQL ou API exécutés. Les migrations nécessiteront chaque approbation SQL+SHA256 administrateur.
