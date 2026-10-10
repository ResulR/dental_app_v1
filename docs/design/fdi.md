# Schéma FDI tactile — préparation 4.4

Sources : CDC§4.1, [versions](../models/orders-versions.md), [direction R16](visual-direction.md). Prototype [fdi-preview.html](fdi-preview.html) et logique [fdi-model.js](fdi-model.js) : données synthétiques en mémoire uniquement, sans réseau, stockage, commande ou information patient réelle.

## Modèle et disposition

32 dents permanentes exactement : 11–18, 21–28, 31–38 et41–48. Appui/clic natif : none → normal → pontic/antar → none. Une seule sélection par FDI, désélection retire l'entrée, aucune dent obligatoire, aucun regroupement bridge automatique. Matériau/teinte communs au travail, pas par dent ; ce prototype n'ajoute aucun choix à ce niveau.

H44-01, choix graphique réversible : quadrants clairement étiquetés du point de vue du patient ; maxillaire droit1/gauche2, mandibulaire droit4/gauche3. Disposition de référence :18→11 puis21→28 en haut ;48→41 puis31→38 en bas. Téléphone : quadrants groupés,4colonnes ; tablette portrait8colonnes/quadrant ; largeur1024px et plus deux quadrants par ligne. Pas de réduction des cibles sous44px ni de défilement horizontal imposé. Les quadrants conservent leurs labels et numéros, plutôt qu'une illusion anatomique ambiguë.

État indiqué par chiffre+N(normal)/A(antar)/tiret(non sélectionné), légende complète et texte accessible ; couleur en renfort seulement. Résumé texte des dents normales/pontics, sans pontic→bridge ou diagnostic automatique. Zéro dent → message non bloquant, description facultative dans le futur formulaire ; ne pas transformer l'avertissement en required.

## Clavier et lecteur

Chaque dent est un button natif type=button, ordre Tab égal à ordre visuel, activation Entrée/Espace, focus visible. aria-pressed = sélection ou non ; aria-label inclut numéro, état exact et prochain état, distingue normal/pontic même si tous deux pressed. Résumé role=status/aria-live=polite, pas d'annonce médicale ni secret. Pas de handler touch et click séparés qui avanceraient deux fois le cycle pour un appui. Cibles au moins44px, largeur de numéro/état non tronquée.

Le résumé initial explique que zéro dent est autorisé ; aucune soumission officielle n'est disponible dans ce prototype. Aucune récupération de mot de passe ou coffre n'est reliée à ce schéma.

## Critère réel et portée

ROADMAP4.4 exige « Test tactile + clavier/lecteur si applicable ». Vérifier logique et code ne remplace pas ce test. Chromium existant est audité ; pas de Playwright/Puppeteer installé dans ce dépôt, aucun téléchargement requis pour la première tentative. Test candidat par CDP pipe, profil temporaire privé dans le projet, sandbox Chromium conservé, sans port serveur/debugging ni visite d'autres services.

Le résultat réel sera consigné après tentative. Si le confinement empêche Chromium, ne pas ajouter --no-sandbox, affaiblir systemd, augmenter privilèges/limites ou passer4.5 silencieusement. À l'implémentation, tests tablette réelle, lecteur d'écran et appareils cibles restent nécessaires même après éventuel succès de touches émulées Chromium ; aucune certification accessibilité sur prototype.

## Scénarios de validation

- Ensemble des32FDI et cycle complet pour chacune, état vide accepté, aucun double/dent hors liste, aucune mutation de l'état d'entrée.
- Appui tactile émulé : trois appuis même dent donnent normal/antar/non sélectionné une seule fois ; résumé et attributs accessibles suivent.
- Clavier : Tab/focus natif, Entrée et Espace même cycle, visibilité du focus.
- Largeurs375/768/1024 : aucune cible<44px, aucun dépassement horizontal, labels et légende présents.
- Résumé et zéro dent, accès à l'état exact par nom accessible ; lecteur d'écran réel pas prétendu testé par contrôle DOM.
- Aucun réseau/persistance, erreur claire et aucun accès aux autres projets.

Point4.4 demeure non validé tant que sa vérification obligatoire n'est pas établie.

## Résultat réel10/10/2026

Logique Node :32FDI uniques, cycle complet pour chacune, état vide, refus dent/état invalides et absence de mutation de l'entrée : OK. Test navigateur avec Chromium154 existant et sandbox conservé : échec avant chargement, processus SIGTRAP/exit1, erreurs pthread_create EAGAIN et NETLINK refusé. Aucun appui tactile, clavier, layout ou lecteur d'écran validé.

Contrôle ciblé lecture seule dental-ai-remote.service après échec : TasksMax100, TasksCurrent48, MemoryMax1GiB, NoNewPrivilegesyes, famillesAF_INET/AF_INET6/AF_UNIX. Les symptômes de threads sont compatibles avec un plafond de ressources ; aucune attribution exclusive à TasksMax sans mesure pendant l'échec. NETLINK n'appartient pas aux familles autorisées. Les PID navigateur identifiés dans la tentative sont absents après fin du test. Aucune protection n'a été modifiée, aucun --no-sandbox utilisé.

Reprise minimale : faire éprouver les deux fichiers fdi-preview.html et fdi-model.js, conservés ensemble, dans un navigateur/tablette de test isolé permettant cette recette, puis fournir preuves du cycle tactile, Entrée/Espace, résumé et absence de débordement/cibles≥44px aux tailles375/768/1024. Ne pas élargir les permissions ou les limites du Remote actuel pour contourner ce blocage.4.5 non commencé.
