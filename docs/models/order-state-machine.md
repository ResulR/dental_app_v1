# Automate des travaux et demandes — point 3.5

Conception finalisée avec R14 approuvée par le propriétaire le 10/10/2026. Aucun code ou SQL métier exécuté ; cette table ne prouve pas un workflow déployé. Sources : CAHIER_DES_CHARGES §§5–7 et 19, [modèle versions](orders-versions.md), [droits](permissions.md).

## Transitions établies

Toute transition recontrôle identité, périmètre clinique, droits, état/révision courants et blocages dans une transaction. Tableau limité aux règles explicitement établies ; toute autre transition ordinaire est refusée.

| Source | Action / acteur | Cible | Conditions et effets |
|---|---|---|---|
| Brouillon hors workflow officiel | Soumettre, clinique approuvée | En attente | Validation serveur, confirmation explicite, numéro/version/conversation, reçu idempotent |
| Nouveau travail labo | Créer pour clinique existante, labo habilité | Acceptée | Origine/auteur, numéro/version/conversation ; email + notification interne, sans approbation clinique |
| En attente | Accepter, labo | Acceptée | Dernière version, détail + grant ; catalogue autorisé, exception indisponibilité justifiée/confirmée ; email clinique |
| En attente | Demander correction, labo | Correction demandée | Motif obligatoire, dernière version ; email clinique |
| En attente | Refuser, labo | Refusée | Motif obligatoire ; historique, email clinique ; pas de réouverture directe |
| En attente | Modifier, clinique | En attente | Nouvelle version et fichiers autorisés ; acceptation concurrente sur ancienne version refusée |
| Correction demandée | Corriger, clinique | Correction demandée | Nouvelle version ; aucune remise en attente automatique |
| Correction demandée | Renvoyer explicitement, clinique | En attente | Revalidation ; email labo ; nouvelle décision manuelle requise |
| En attente / Correction demandée | Annuler directement, clinique | Annulée | Confirmation, trace ; sans inventer une décision labo préalable |
| En attente / Correction demandée / Acceptée / En fabrication | Annuler directement, labo habilité | Annulée | Motif obligatoire, email clinique, conservation historique ; demandes concurrentes contrôlées |
| Acceptée | Modifier directement instructions, labo | Acceptée | Avant fabrication, détail + action, motif, aucune demande pendante ; nouvelle version, email + notification interne |
| Acceptée | Créer demande modification/annulation, clinique | Acceptée | Une seule demande pending au total ; original inchangé ; email labo |
| Acceptée | Démarrer fabrication, labo | En fabrication | Détail + action, aucune demande pending, pas de référence interdite ; version/fichiers verrouillés, pas d'email systématique |
| En fabrication | Marquer prêt, labo habilité | Terminée | Transition manuelle, absence de blocage de progression ; email clinique |
| Terminée | Déclarer sortie physique, labo habilité | Livrée | Mode/date/auteur, confirmation individuelle/lot ; conversation close, J+30 UI ; pas d'email livraison |
| Livrée | Corriger livraison erronée, owner/admin autorisé | Terminée | Motif, absence de contradiction retouche ; réouverture conversation et invalidation échéance archive ; instructions restent verrouillées |
| Refusée / Annulée | Préremplir et soumettre, clinique | Nouveau travail En attente | Nouveau numéro, filiation et revalidation ; ancien travail inchangé |
| Livrée | Demander retouche, clinique | Nouveau travail En attente | Parent livré réellement concerné, aucune retouche active ; contenu simplifié, conversation/numéro propres ; ancien travail inchangé |
| En fabrication | Créer remplacement labo | Nouveau travail Acceptée + ancienne Annulée | Cas compatible avec annulation autorisée : motif, filiation bilatérale et effets atomiques, instructions originales préservées |
| En fabrication | Créer travail supplémentaire labo | Nouveau travail Acceptée | Filiation bilatérale, anciennes instructions/statut inchangés |
| Terminée / Livrée | Créer remplacement exceptionnel, labo habilité | Nouveau travail Acceptée | R14 : source conserve son statut, versions, livraison et conversation ; nouveau numéro/conversation, motif et lien bilatéral traçables |
| Terminée / Livrée | Créer travail supplémentaire, labo habilité | Nouveau travail Acceptée | Précision H35-02 de « à partir de En fabrication » : source inchangée, travail distinct et lien bilatéral |

Livrée archivée reste Livrée. Retouches suivent le même automate de travail ; « une seule active » exclut Refusée/Annulée/Livrée. Conversations générales restent actives ; aucune clôture automatique supplémentaire à Refusée/Annulée n'est inventée. L'absence d'email systématique ne signifie pas absence d'événement/historique interne.

## Automate d'une demande

| État demande | Action | Résultat sur demande | Effet sur travail |
|---|---|---|---|
| Aucune pending | Demander modification/annulation depuis Acceptée | pending | Statut/version officielle inchangés ; bloque fabrication et modification directe labo |
| pending | Retirer avant décision, clinique | withdrawn | Confirmation et historique ; original inchangé, blocage lié à demande retiré |
| pending modification | Accepter, labo habilité | accepted | Nouvelle version officielle atomique, reste Acceptée ; historique et email clinique |
| pending modification | Refuser, labo habilité | rejected | Original inchangé ; décision tracée et email clinique |
| pending annulation | Accepter, labo habilité | accepted | Annulée ; historique et email clinique |
| pending annulation | Refuser, labo habilité | rejected | Reste Acceptée ; décision tracée et email clinique |
| pending | Annulation directe du travail par labo | closed | H35-01 : cause order_cancelled, acteur/date et proposition préservés ; pas de fausse acceptation ni action pendante impossible |
| accepted / rejected / withdrawn / closed | Répéter décision sur ancienne révision | Aucune nouvelle décision | Réponse idempotente ou conflit selon intention ; aucun double effet |

Une demande terminale ne redevient pas pending : nouvelle demande distincte après décision/retrait si le travail est encore éligible. Le retrait n'efface pas sa proposition. Les opérations logistiques compatibles peuvent continuer en présence d'une demande ; elles ne changent pas les instructions.

H35-01 (hypothèse technique réversible) : l'annulation directe du travail clôture la demande pendante en closed/order_cancelled dans la même transaction. La proposition et l'historique restent consultables ; l'UI distingue cette clôture d'une acceptation/refus manuel et retire l'action devenue impossible. L'email d'annulation déjà requis porte la conséquence, sans inventer un nouvel email automatique.

## Invariants et scénarios concurrents à éprouver

| Course | Invariant |
|---|---|
| Modification clinique / acceptation labo | Une acceptation se rapporte à la dernière version ; ancienne version = conflit et relecture |
| Deux demandes (modification + annulation) | Au plus une pending, sans unicité séparée par type |
| Création demande / début fabrication | Même verrou d'agrégat : une seule décision cohérente ; pas de pending après démarrage effectif |
| Retrait / décision demande | Un seul terminal, auteur/date traçables ; autre requête refusée/idempotente |
| Édition labo / demande | Modification directe interdite tant qu'une demande pending existe |
| Interdiction référence / progression | Recontrôle courant, blocage préventif ; pas de changement automatique du statut |
| Livraison / retouche ou correction | Parent livré et unicité retouche ; correction empêchée si contradiction ; conversation et archive cohérentes |
| Lot de livraison / état devenu inéligible | Recontrôle de chaque item, aucune transition silencieuse d'un travail inéligible |
| Remplacement / annulation ou autre opération source | Création + filiation + annulation source seulement si En fabrication ; Terminée/Livrée inchangée selon R14 ; effets atomiques |
| Panne email après commit | Travail/demande et audit restent validés, retry via outbox |
| Réponse de soumission perdue | Même intention retrouve le reçu, sans double commande |
| Suspension / décision | Autorité courante sérialisée, aucune opération sous un ancien contexte permissif |

Ce sont des scénarios futurs, pas des tests exécutés. L'ordre de verrouillage interagrégats sera fixé avec 3.6 pour éviter les deadlocks et préserver les contrôles de filiation.

## R14 et précisions documentées

Décision explicite du propriétaire le 10/10/2026, intégrée au §5.5 du cahier : remplacement et supplément à partir de En fabrication ; remplacement en fabrication annule la source ; remplacement exceptionnel de Terminée/Livrée crée un nouveau travail lié sans modifier rétroactivement le statut source. Traçabilité complète.

§5.3 reste inchangé : aucune annulation ordinaire de Terminée/Livrée. §6 reste inchangé : demande clinique de retouche/refabrication soumise à décision manuelle et unicité active ; ce parcours n'est pas remplacé par la création labo exceptionnelle. Une source livrée reste livrée, sa conversation close et son échéance d'archive continuent ; le nouveau travail a sa propre conversation.

- H35-01 : clôture technique closed/order_cancelled d'une demande devenue sans objet après annulation directe ; pas d'acceptation fictive.
- H35-02 : « à partir de En fabrication » couvre En fabrication, Terminée et Livrée pour le supplément. Aucun lien métier nouveau depuis Refusée/Annulée ; leur duplication clinique reste le parcours prévu.
- H35-03 : livraison groupée vérifie tous les éléments sélectionnés avant commit et refuse le lot en cas d'inéligibilité concurrente ; aucune réussite partielle silencieuse. Choix d'implémentation réversible, aucun nombre maximum métier inventé.

La table couvre les transitions autorisées ; toute transition absente est refusée. Les états de sécurité, archives et demandes sont orthogonaux, pas de nouveaux statuts de travail. Les scénarios listés sont des critères futurs d'implémentation ; la validation 3.5 est documentaire. Suite : 3.6, filiations et unicité des retouches.
