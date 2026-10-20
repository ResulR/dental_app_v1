# File des actions — 10.14

Implémentation sans activation, sur les données existantes. `POST /api/v1/orders/actions`, interface albanaise placée avant le suivi laboratoire. La liste n'inclut pas les informations patient, descriptions, versions, pièces jointes ou secrets.

- Commandes En attente : nouveaux dépôts, renvois de correction (dernier événement de statut), retouches distinctes.
- Demandes de modification ou annulation encore pendantes sur une commande Acceptée.
- Inscriptions cliniques dont la décision est encore pendante.

Chaque branche est conditionnée par les permissions effectives relues sous verrous compte/grants/session. Les commandes demandent au moins un droit accept/reject/request_correction avec leurs prérequis ; modifications edit_instructions ; annulations cancel ; inscriptions clinics.manage. Aucun accès clinique à cette file laboratoire. La liste expose les permissions courantes pour afficher les commandes ; chaque mutation conserve sa revalidation serveur indépendante.

Priorité retouche (y compris ses demandes), puis priorité manuelle, puis autres actions. À priorité identique, ordre stable UUID/type ; aucun ordre chronologique ou délai métier supplémentaire n'est déduit. Le curseur composite priorité/UUID/type évite de perdre la précision des timestamps PostgreSQL. 50 éléments par page, chargement manuel, pas de polling.

La liste est calculée sur les états métier ; elle ne lit ni ne modifie une notification, ne marque rien « traité » et n'enlève pas une action parce qu'elle est ouverte. Une décision réussie doit être suivie d'un rechargement. Si un autre acteur décide entre lecture et action, les contrôles de révision/statut existants restent applicables. Des insertions ou changements de priorité entre pages peuvent déplacer une action : recharger la première page pour retrouver l'état courant ; aucune promesse de snapshot multipage.

Les boutons utilisent les API et composants existants : revue ciblée avec relecture du détail officiel, correction via cycle de vie, avant/après des modifications, décision d'annulation, revue clinique avec révision. Aucune décision simulée, aucune nouvelle règle d'approbation. La présence dans la file n'est jamais une autorisation de mutation.

Flag `DENTAL_LAB_ACTION_INBOX_ENABLED` absent/false par défaut. Dépendances explicites : order_modification et clinic_management, avec leurs contrôles de démarrage transitifs. Aucun changement de schéma ou de privilège. PostgreSQL réel (requête, ACL, états concurrents) et recette navigateur restent à réceptionner séparément. Tests ciblés par doubles et HTTP local ; ils ne valident pas le moteur SQL.
