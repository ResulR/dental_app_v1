# Recette navigateur FDI — point 4.4

Statut : NON EXÉCUTÉE sur appareil de recette. Ce dossier ne valide pas le navigateur.
Le prototype ne contient aucune donnée médicale ni connexion serveur.

## Préparation locale
Extraire fdi-review.zip dans un dossier privé sur un ordinateur ou appareil de test isolé.
Conserver fdi-preview.html et fdi-model.js dans le même dossier ; ne pas déplacer un seul fichier.
Vérifier les empreintes de SHA256SUMS, puis ouvrir fdi-preview.html dans un navigateur local.
Aucune modification du VPS, de ses services, limites ou protections n'est nécessaire.
Si le navigateur bloque le script local, noter le refus et utiliser un environnement de test isolé autorisé ; ne pas désactiver ses protections pour obtenir un succès.

## Fiche à retourner
Date et fuseau :
Testeur :
Appareil / OS :
Navigateur et version :
Mode d'ouverture :
Empreintes vérifiées :
Pour chaque ligne : RÉUSSI / ÉCHEC / NON EXÉCUTÉ, comportement observé et capture ou courte vidéo sans données réelles.

| Essai | Résultat attendu | Résultat / preuve |
|---|---|---|
| Chargement | 32 dents FDI, aucune sélection initiale, aucun chargement externe | NON EXÉCUTÉ |
| Tactile réel | Sur 11, trois touches successives : Normal, Antar (pontic), aucune ; une seule transition par touche | NON EXÉCUTÉ |
| Autres dents | Les 32 numéros sont disponibles, états indépendants ; pas de bridge automatique | NON EXÉCUTÉ |
| Clavier | Tab atteint chaque dent ; Entrée puis Espace changent chacun l'état une seule fois ; focus visible, pas de piège | NON EXÉCUTÉ |
| Résumé | Normal et pontic distingués textuellement ; résumé actualisé ; retour à vide compréhensible, sélection facultative | NON EXÉCUTÉ |
| Mobile | Téléphone portrait puis paysage ; largeurs 375/768/1024 px si disponibles ; pas de débordement horizontal, boutons utilisables ≥44 px | NON EXÉCUTÉ |
| Texte et couleur | États lisibles sans couleur ; zoom 200 % et texte long ne masquent pas les actions | NON EXÉCUTÉ |
| Lecteur d'écran | Si disponible : indiquer outil/version, noms des dents, état, prochaine action et annonce du résumé ; sinon justifier NON EXÉCUTÉ | NON EXÉCUTÉ |

Un échec doit être décrit et corrigé puis retesté avant clôture. L'émulation seule ne remplace pas le tactile réel.
Retourner la fiche remplie avec les preuves. Ne pas inscrire des informations de patients.
Les tests structurels et de logique déjà exécutés sur le VPS ne prouvent pas ces résultats.
