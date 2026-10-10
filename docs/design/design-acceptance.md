# 4.14 — Recette du design et accessibilité, en attente
Aucune certification, aucun rendu navigateur réel déclaré.
Sources : ROADMAP4.14, R16 et exception ciblée4.4 dans ../../CONSIGNE.md.
La poursuite4.5–4.13 a concerné les conceptions indépendantes ; le câblage chapitre5 n'est pas commencé.

## Dossier
design-review.zip contient les13 maquettes, fdi-model.js avec fdi-preview.html, tokens, descriptions et fiches de recette, SHA256SUMS. Extraire ensemble dans un dossier privé de test isolé, ouvrir design-review.html localement. Aucun profil Chromium, secret ou donnée réelle. Pas installation/service sur VPS.
Les contrôles structurels sont dans design-validation.json. Reproduction sous dental-ai : python3 docs/design/check-design.py ; ne lance aucun navigateur. Les contrastes calculés des tokens ne prouvent pas le rendu final.
La fiche spécifique4.4 est fdi-acceptance.md ; son archive dédiée fdi-review.zip reste autonome et inchangée.

## À renseigner pour recette réelle
Date/fuseau, testeur, appareil/OS, navigateur/version, largeur/zoom, fichier/SHA.
Chaque ligne RÉUSSI / ÉCHEC / NON EXÉCUTÉ + preuve et observation. Aucun succès par défaut.

| Critère | Parcours / preuve attendue | État actuel |
|---|---|---|
| Responsive | Smartphone portrait/paysage, tablette, desktop ; widths375/768/1024, texte long/zoom200%, actions nonmasquées | NON EXÉCUTÉ |
| Albanais | Relecture locale qualifiée des labels/aides/erreurs ; matériaux/teintes techniques conservés | À REVOIR |
| FDI | Tactile réel, Tab/Entrée/Espace,32dents/cycle/résumé, lecteur si applicable selon fiche4.4 | NON EXÉCUTÉ |
| Contrastes | Ratios tokens calculés, puis vérifier états/focus/texte rendus sans dépendance couleur | Calculs OK ; navigateur NON EXÉCUTÉ |
| Clavier/focus | Ordre DOM et navigation, retour/liaisons/details, cible44px observée ; controls inertes non preuve formulairefonctionnel | NON EXÉCUTÉ |
| Lecteur | Noms/états FDI, titres/liens/sections/annonces ; outil/version et justification si indisponible | NON EXÉCUTÉ |
| Loading/empty/error | Listevidevsfiltre, transfert100%encorevérification, offline/quota/reconnexion ; erreurs lisibles | Maquettes présentes ; rendu NON EXÉCUTÉ |
| Confirmation/modale | Texte conséquence/Retour/actionnommée ; focus/Escape/retour à tester sur dialogue réellement implémenté | Règles conçues ; dialogue fonctionnel NON IMPLÉMENTÉ |
| Confidentialité | Projections logistique/détail distinctes, données fictives ; aucune maquette ne prouve ACL serveur | Conception revue ; tests ACL ultérieurs |
| Parcours métier | Choix patient alternatif ; pending≠statut ; retoucheparentréel ; livraisonphysique ; sync≠envoi | Conception revue ; recette réelle attendue |
| Acceptation | Maquettes et règlesvisuelles acceptées avant câblage, conformément critère4.14 | R16 approuve direction ; revue des maquettes suivantes attendue |

Toutes les maquettes sont statiques avec champs/actions officiels désactivés. Une capture permet revue visuelle, pas simulation de backend. Les vrais formulaires/modales/PWA/cryptographie/transferts seront testés aux points d'implémentation ; cette préparation ne les certifie pas.
Ne pas étendre sandbox/CPU/mémoire/tâches/systemd pour obtenir un navigateur. Aucun test voisin ni service local.
Arrêt ciblé4.14 : dépendance4.4 et preuves navigateur/acceptation maquettes manquantes. Action attendue : retourner fiches complétées et preuve de revue ; corriger et retester échecs avantvalidation. Historique Git garde tous commits séparés.
