# Droits granulaires — noyau 7.10

État : registre et calcul effectif implémentés/testés hors ligne ; aucune permission PostgreSQL ou utilisateur réel modifiée. Les 29 codes et prérequis sont exactement ceux de 0002 réceptionnée. Un test compare le registre au SQL immuable et vérifie les chaînes acycliques ; ce n'est pas une lecture des grants réels ni une recette des routes.

validateGrantSet refuse codes inconnus, doublons, prérequis manquants et capacités réservées au mauvais profil, sans ajouter de droits. effectivePermissionCodes calcule récursivement les droits dont tous les prérequis actuels existent ; retirer un parent invalide ses descendants, sans retirer un droit indépendant. Fichiers view/download, conversations générale/travail, lecture/réponse sont indépendants selon le modèle approuvé. Un accès logistique seul n'accorde ni détail patient, fichiers ou conversation.

delivery.correct et administration employés exigent owner/admin conformément au modèle métier ; un grant brut employee ne contourne pas ce contrôle. Aucun grant ne permet de gérer un administrateur ou lire l'audit global. isCurrentOwner exige profil owner et relation owner_slot actuelle vérifiée côté serveur, ainsi que session/compte actifs sans verrou/reset. Les 29 capacités sont connues pour owner, mais contraintes métier/ressource/audit demeurent distinctes.

PermissionContext est exclusivement un contexte serveur actuel : session/epoch vérifiés, compte et grants chargés sous contrôle serveur ; pour une clinique, suspension courante connue et false obligatoire (flag absent ou true = refus). Ne jamais accepter les booléens/profile/grants d'un DTO client ou d'un cache de session obsolète. clinicOwnsResource ne teste que l'appartenance à la clinique active ; il ne remplace pas approbation de soumission, statut, partage, catégorie ou permission de contenu. Les endpoints/SSE/jobs/projections doivent appliquer tous leurs prédicats supplémentaires au moment de l'action et de la diffusion.

Le noyau est raccordé à la validation locale des changements de droits d'administrateurs 7.9 ; le port validatePermissions et mutateAtomic conserve le recontrôle du registre/prérequis courant dans la transaction. Le module ne prétend pas filtrer des routes/repositories encore absents.

Restent : adaptateurs de contexte/permissions PostgreSQL, mises à jour et audit atomiques, middleware/projections/recherche/fichiers/SSE/jobs, UI et tests négatifs de toutes les frontières réelles. 7.11 traitera l'enveloppe de délégation, sans auto-élévation. Réception PostgreSQL/API/navigateur différée ; aucun RLS ni protection par simple masquage React annoncé.

## Lecture effective intégrée — 14/10/2026

GET `/api/v1/auth/permissions` est relié au runtime authentifié : session cookie vérifiée puis lecture SQL unique des compte/session/limites/grants/owner_slot/clinique courants. Révocation, epoch, expiration absolue, suspension, verrou/reset et propriétaire obsolète échouent fermés. Aucun identifiant/grant client accepté. Contrat strict additif des 29 codes, réponse no-store sans secret ni données patient. Readiness exige désormais SELECT account_grants déjà prévu par0010 ; aucune migration ou activation effectuée.

L'interface albanaise affiche la gestion clinique seulement après vérification du droit effectif clinics.manage ; une clinique active accède à son panneau propre. Relecture lors de chaque validation de session (focus/visibilité/période30s), absence de persistance navigateur, réponse invalide/indisponible masque le panneau. Une revalidation identique préserve le formulaire non enregistré ; changement d'identité masque immédiatement. Le délai de rafraîchissement visuel n'accorde aucun droit : les opérations serveur recontrôlent leur propre contexte transactionnel.

25 tests ciblés réussis (registre, lecture courante, refus, transport, HTTP, authentification/runtime/readiness), doubles SQL uniquement. API/contrats compilés, types web et snapshot validés. Pas de preuve PostgreSQL réel ni navigateur supplémentaire ; les futurs endpoints fichiers/SSE/jobs ne sont pas déclarés couverts.
