# Planification de livraison — code intégré, activation différée

Le laboratoire peut charger le contexte d'une commande et modifier ou effacer sa
**date planifiée**, distincte de la date souhaitée clinique. Les routes privées
`/api/v1/orders/delivery-plan-context` et `...-update` vérifient session/origine,
identité courante et droit `delivery.plan` (avec prérequis `orders.read_logistics`).
Un compte clinique n'écrit jamais ce champ. Les commandes Livrée, Refusée et
Annulée sont en lecture seule ; la date peut évoluer dans les autres états sans
approbation de la clinique, conformément au cahier des charges.

L'édition verrouille la commande puis sa logistique, exige la version courante
et les deux révisions attendues, et incrémente les deux révisions sous transaction.
Une valeur identique ne produit ni événement ni audit. Un changement enregistre
les valeurs logistiques avant/après, l'événement `logistics_changed`, la sortie
outbox et l'audit `DELIVERY_PLAN_CHANGED` atomiquement. Les réponses distinguent
conflit, état clôturé et absence de modification ; une erreur ou un commit
incertain ne provoque aucune répétition automatique. Le contexte affiche les
20 derniers changements de date et signale si l'historique est plus long ; la
table conserve l'historique entier. Aucun e-mail n'est envoyé.

Le serveur exige `DENTAL_LAB_DELIVERY_PLAN_ENABLED=true` et le suivi des commandes
activé ; sinon aucune de ces routes n'est montée. Au build web, le panneau
albanais exige `VITE_DENTAL_LAB_DELIVERY_PLAN_ENABLED=true` et la permission.
Ces drapeaux restent absents/désactivés ; aucune activation ni déploiement.
Avant activation : réception SQL réelle des permissions, verrous, événements,
transactions concurrentes et rollback ; recette navigateur puis décision de
publication séparée. Tests locaux avec doubles ne constituent pas cette preuve.
