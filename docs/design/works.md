# 4.6 — Listes et détail
Sources CDC§§2.3,5,7,13 ; ../models/order-state-machine.md et permissions.md.
Indépendant de l'interaction FDI : fiche affiche résumé textuel, schéma réel soumis au gate4.4.

## Accueil et liste
Boîte de réception = actions à traiter : nouvelle commande, correction renvoyée, demande modification/annulation, retouche, inscription et alertes importantes. Catégories seulement avec accès/grants utiles ; aucune fuite de compteurs non autorisés. Lecture notification ne résout pas l'action.
H46-01 : cartes compactes sur petit écran, numéro/clinique/statut textuel/date/priorité ; clic Ouvrir puis action principale = parcours nominal de deux activations, pas une mesure observée.
Liste avec recherche numéro/clinique et patient nom OU référence seulement avec accès détaillé. Filtres statut/date/normal-retouche, pas matériau. Clinique cantonnée à ses propres travaux. Recherche serveur applique projection, pas données cachées dans DOM.
Distinguer zéro résultat filtré (effacer filtres), liste vide, chargement, accès retiré et panne. Pas de faux zéro en erreur. Pagination accessible et conservation des filtres lors retour.
Dates : souhaitée et planifiée libellées séparément ; repère provisoire si pas planifiée. Urgence J-2, retard et priorité manuelle distincts, visibles textuellement ; arrêt des alertes aux Livrée/Refusée/Annulée.

## Fiche
Entête : numéro, clinique, statut, origine laboratoire si pertinente, priorité/dates/mode livraison. Résumé logistique ne contient ni patient ni instructions ni vignettes/nom de fichier sensible.
Avec détail : identification patient, dents texte + schéma, matériau/teinte/type/description ; fichiers sous grants voir/télécharger séparés ; conversations sous grants spécifiques, lien liens de travaux4.8.
Historique de versions : date/auteur, version courante et comparaison avant/après explicitement marquée historique. Ne jamais accepter depuis version ancienne ; recharger et relire.
Actions visibles par état ET droits, recontrôlées serveur : pending accepter/correction/refuser ; accepted fabrication (sans pending)/édition labo motivée/demande clinique ; manufacturing prêt/annulation labo/lié ; completed livraison ; delivered retouche clinique/correction livraison exceptionnelle habilitée. Motifs/confirmations par4.7/4.8/4.10.
Pas d'action ordinaires annulant completed/delivered ni de réouverture directe rejected. Début fabrication verrouille instructions ET fichiers fabrication.
Cliniques : modifier pending, corriger puis renvoyer explicitement correction_requested, demandes accepted, suivi lecture ensuite. Nouveau prérempli depuis refusée/annulée crée nouveau numéro, revalidation.
Logistique compatible autorisée malgré demande pending, jamais instructions/fabrication.

## Scénarios de conception revus
- Compte logistique seulement : retrouve numéro/date et livraison sans patient, FDI, instructions ou recherche patient.
- Notification déjà lue : action reste affichée tant que décision non prise.
- Version changée pendant lecture : conflit et relecture ; aucune fausse confirmation.
- Clinique sur lien d'autre clinique : refus sûr sans métadonnées ; droit retiré retire actions/contenu.
- Textes longs : retour ligne dans cartes, aucune largeur fixe ; ordre lecture identique visuel.
Contrôles réels navigateur/clavier/temps d'action et permissions serveur ultérieurs ; maquette statique n'est pas ce test.
