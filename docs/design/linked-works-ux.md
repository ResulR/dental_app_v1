# 4.8 — Retouches et chaînes
Sources CDC§§5.3,5.5,6,7 ; ../models/linked-works.md ; R14.
Indépendant de4.4 : formulaire retouche n'utilise aucun schéma FDI.

## Retouche clinique
Entrée depuis détail d'un travail Livré, même archivé. Entête source toujours visible : numéro, date de sortie et statut Livré. Bouton Demander retouche/refabrication disponible seulement sur ce parent réellement concerné et sans retouche active.
Matériau et teinte préremplis mais modifiables ; revalidation catalogue courant. Description obligatoire du problème ET des dents concernées, sous forme texte (un champ clairement aidé), pièces facultatives ; pas de FDI ni nouvelle obligation inventée. Limite200Mo/fichier, aucune limite cumulative retouche non décidée.
Revoir source, description, références et pièces, confirmer ; nouveau numéro en attente et conversation propre, décision manuelle labo. Aucun changement du statut source. Si retouche active : lien vers celle-ci au lieu seconde création ; refus concurrence serveur conserve préparation.
Active = En attente, Correction demandée, Acceptée, En fabrication, Terminée. Refusée/Annulée/Livrée libère nouvelle demande ; historique jamais retiré.

## Chaîne lisible
H48-01 réversible : liste verticale source→enfant(s), numéro/statut/type de lien en texte, date/auteur ; lien parent et enfants dans les deux sens. Pas d'arbre horizontal défilant sur téléphone. Étendue selon droits, aucun patient exposé aux logisticiens.
A remplacé par B livré : une retouche concernant B part de B, pas automatiquement A. Si B est retouche livrée, un nouveau problème concernant B part de B. Naviguer racine ne change pas la cible du formulaire.
Travail demandé et physiquement livré identifié distinctement ; filiation ne confond pas conversations. Chaque enfant a numéro/version/fichiers propres. Aucun rattachement arbitraire d'anciens travaux.

| Parcours | Confirmation explicite |
|---|---|
| Remplacement labo source En fabrication | Nouveau travail Accepté ; ancienne source Annulée avec motif, création/lien/annulation atomiques |
| Remplacement exceptionnel source Terminée/Livrée | Nouveau travail Accepté ; source garde statut, instructions et livraisonR14 ; motif traçable |
| Supplément source En fabrication/Terminée/Livrée | Travail distinct Accepté, source inchangéeH35-02 |
| Retouche clinique source Livrée | Nouveau travail En attente, décision labo requise ; ne pas appeler remplacement autoaccepté |
| Préremplir refusée/annulée | Nouveau numéro En attente, dates/catalogue/fichiers revalidés, source inchangée |

Motif et conséquences au récapitulatif ; choix Remplacement/Travail supplémentaire explicite, pas défaut annulation caché. Permission courant serveur, filiation même clinique. Aucun prix/garantie/prise en charge.
Source changée pendant confirmation : conflit, relire état et réévaluer conséquences. Aucun enfant partiel ou doublon après réponse perdue (reçu idempotent).
Correction livraison avec retouche liée : bloquée jusqu'à résolution explicite de contradiction, pas de bouton forcer.
Scénarios revus : retouche de B et non A ; source Livrée inchangée remplacement ; refus retouche conserve chaîne ; seconde active refusée ; annulation enfant ne modifie parent.
Recette navigateur réelle de la chaîne, lecture/saisie clavier et tests d'unicité/transactions restent à implémentation4.14.
