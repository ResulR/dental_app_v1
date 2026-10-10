# 4.10 — Calendrier et sorties
Sources CDC§7, ../models/order-state-machine.md (H35-03), droits3.3.
Conception indépendante FDI : uniquement projection logistique autorisée.

## Calendrier
H410-01 réversible : onglets Semaine/Mois avec boutons précédent/suivant/aujourd'hui et période explicite. Desktop semaine sept colonnes si place suffisante, mois grille sept jours avec noms des jours et bouton du jour indiquant nombre autorisé ; pas de patient dans cellule. Mobile même période sous liste chronologique groupée par jour, titres complets, action ouvrir en une activation.
Travail positionné date planifiée ; à défaut souhaitée et étiquette Repère provisoire. Ne jamais faire passer date souhaitée pour engagement labo. Détail conserve les deux valeurs.
Glisser-déposer desktop propose nouvelle date planifiée puis confirmation Ancienne→Nouvelle ; Annuler rétablit visuel original. Toujours bouton Modifier date dans détail utilisable clavier/mobile (aucun drag obligatoire).
Pas de modification de date souhaitée par drag. Dateplanification autorisée sans décision clinique, revision/historique/auteur, serveur final ; droits/logistique peuvent permettre planning sans patient. Conflit de révision = relire, aucune date faussement confirmée.
UrgenceJ-2 et retard selon planifiée, sinon souhaitée provisoire ; priorité manuelle séparée. Travaux Livrés/Refusés/Annulés sans alertes de progression ni e-mail urgence.

## Prêts à livrer
Liste = Terminée et non Livrée, cases sélection accessibles avec numéro/clinique/date ; compteur sélection explicite. Individual ou lot. Confirmation liste intégrale des sélectionnés et mode(s) de sortie : livraison labo / retrait clinique / coursier externe. Date réelle, mode et auteur enregistrés ; pas d'adresse patient dans vue logistique.
Texte « Confirmez la sortie physique du laboratoire ou le retrait » ; pas confirmation dentiste, pas email livraison. Conversation travail passe lecture seule, horloge archive30jours démarrée à sortie effective.
Case sélectionner tout porte seulement éléments visibles dans portée autorisée ; indiquer portée, pas inclure hors filtre ou autrepage à l'insu de l'utilisateur. H410-02 réversible présentation, pas limite métier nombre de fichiers/travaux.
Prévalidation UI ne remplace pas transaction serveur. H35-03 : recontrôler tout lot avant commit, refus total si état/droit/révision d'un item change, message articles concernés autorisés ; aucune réussite partielle silencieuse. En cas timeout vérifier reçu idempotent plutôt que déclarer deux fois.

## Correction exceptionnelle
Commande Livrée : action secondaire seulement owner/admin spécifiquement autorisé. Motif obligatoire et confirmation retour Terminée ; réouvre conversation, invalide compteur archive, instructions restent verrouillées. Si retouche liée contradiction : refus explicite et résolution humaine, pas forcer. Source ne disparaît jamais du journal.
Scénarios revus : sans planification repère souhaitée provisoire ; drag annulé = aucune écriture ; mobile édition détail ; lot avec article devenu livré refuse tous ; correction bloquée retouche ; aucun email livraison.
Maquette ne réalise aucun drag/lot ni test navigateur. Recette manipulations mobile/clavier/rendu semaine/mois et tests concurrence aux étapes dédiées.
