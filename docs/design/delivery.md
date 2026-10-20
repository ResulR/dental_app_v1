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

## Intégration calendrier du chapitre 16 (code non déployé)

La recherche des travaux accepte `date_kind=effective` : PostgreSQL filtre avec `COALESCE(date_planifiée,date_souhaitée)` sous le même cloisonnement clinique et les mêmes permissions que la liste. L'interface albanaise affiche une semaine ou un mois, grille de sept colonnes sur grand écran et jours groupés sur mobile. Les cellules ne contiennent pas de patient. L'ouverture du détail exige le droit de lecture détaillée ; les rôles logistiques peuvent consulter leur calendrier sans accéder au patient. Au-delà de 50 résultats, la pagination reste explicite et aucun compteur affiché ne prétend couvrir les pages non chargées. Les deux dates restent visibles dans la fiche et aucune opération d'écriture n'est déclenchée par le calendrier. Tests locaux sur le calcul des périodes et la forme de la requête ; SQL PostgreSQL réel, volume, écran/clavier et transitions de permissions restent à réceptionner avant activation.

Le raccourci « Punët gati për dorëzim » dans le suivi est visible uniquement au laboratoire avec `delivery.mark_delivered`. Il recharge la liste avec le statut `completed`, sans patient dans le calendrier, et conserve la pagination ; l'action individuelle existante récupère le contexte à jour, choisit le mode et demande confirmation de sortie physique avant la transaction serveur. En cas de résultat incertain, elle refuse une répétition automatique et demande une nouvelle lecture. La sélection multiple et sa transaction tout-ou-rien de 16.6 restent à implémenter et à réceptionner.
