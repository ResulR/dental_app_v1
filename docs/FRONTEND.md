# Shell web — point5.6

Implémentation indépendante de la recette R17 : React/Vite, interface albanaise, tokens R16 (#0F766E, fond clair, police système16px, actions44px), CSS mobile-first, focus visible, lien d'évitement, composants génériques Shell/Card/Button/StatusBadge. Un badge exige un libellé, pas seulement une couleur. Navigation fournie par la composition et vide tant que l'identité/les droits serveur ne sont pas implémentés ; aucune sélection libre d'un rôle ni donnée clinique/patient de démonstration dans le shell public. L'accès au compte est explicitement indisponible, sans bouton simulant une authentification.

```sh
python3 scripts/run-quality.py build:web
```

Vite est appelé via son API dans le même processus Node borné R18. La configuration ne lit aucun fichier d'environnement (`envDir:false`), aucun secret client. La sortie apps/web/dist est ignorée par Git ; aucune mise en ligne/service/port permanent créé. Icônes PNG192/512 et SVG monogramme générés localement, manifeste lang=sq/display=standalone/start_url/scope racine. Base racine suppose une origine dédiée pour le futur runtime ; déploiement non effectué et à valider aux étapes prévues.

Service worker généré à partir de la liste exacte des ressources publiques de build et de leur empreinte. Le build refuse les fichiers hors HTML/CSS/JS/manifeste/icônes autorisés. Préchargement avec credentials omit, aucune réponse API/commande/fichier/brouillon/URL avec query ni origine externe mise en cache. Les réponses réseau à des ressources manquantes ne sont pas ajoutées au cache. Seule la navigation racine reçoit le shell hors ligne ; coffre, synchronisation, routes métier et mises à jour interactives viendront aux chapitres correspondants. Pas de skipWaiting/activation forcée risquant une session ouverte. Le préfixe de cache propre dental-lab-shell est seul nettoyé. La publication doit servir ce HTML statique public, jamais un HTML personnalisé patient/session aux chemins précachés.

Contrôles effectués : build natif sous limites, typage/lint/imports/formatage et tests de refus de cache privé. Ces tests de politique ne simulent pas une validation réelle du service worker dans un navigateur.

Statut5.6 reste en cours : implémentation et build vérifiables, recette navigateur responsive/installation/offline/contrastes/clavier/lecteur/tactile reportée sous R17. Points4.4/4.14 et leurs archives conservés. La suite serveur indépendante est autorisée ; aucune interface prête pour production déclarée.
