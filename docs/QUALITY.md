# Qualité — 5.4 et décision R18

TypeScript 6 strict : unchecked indexed access, exact optional properties, compilation NodeNext API/contrats, Bundler/React web. ESLint/TypeScript-eslint, hooks React, exports FastRefresh et Prettier ciblent uniquement code/config ; références et prototypes approuvés restent conservés.

`check:boundaries` analyse imports/exports/imports dynamiques littéraux, entrées publiques intermodules, direction app/features/shared, séparation API/web/contracts, repository/routes et cycles. Il refuse les symlinks sources et les chemins sortant du projet avant inspection. Les imports publics passent uniquement par `@dental-lab/contracts`. Les imports dynamiques non littéraux sont interdits par convention et doivent être revus ; ce contrôle n'analyse pas le SQL.

## Exécution reproductible et bornée

Depuis `/srv/dental-lab`, sous UID 1002 dans `dental-ai-remote.service` :

```sh
python3 scripts/run-quality.py quality
python3 scripts/test-quality-runner.py
```

La première commande exécute séquentiellement build contrats/API, trois typechecks, lint, format:check, boundaries et résolution workspace. Un contrôle individuel utilise le même lanceur : `python3 scripts/run-quality.py typecheck` (ou `build:packages`, `lint`, `format:check`, `check:boundaries`, `check:workspace`). `format` écrit seulement les fichiers code/config ciblés. Les alias npm racine délèguent au lanceur ; préférer Python directement pour éviter le processus npm supplémentaire. Ne pas exécuter directement les binaires de compilation en contournant cette admission.

Chaque outil Node est appelé directement depuis `node_modules`, sans npm imbriqué, avec `UV_THREADPOOL_SIZE=1`, `RAYON_NUM_THREADS=1`, `--v8-pool-size=1`, heap 192 MiB. Ces valeurs concernent exclusivement ses enfants. Aucun environnement Remote/systemd global n'est modifié. Deadline de 90 secondes par outil, verrou exclusif `.local/quality.lock`, réserve minimale de 24 tâches avant lancement. La limite du service reste 100. Admission mémoire : marge de 448 MiB sur anon+kernel ; le cache de fichiers réutilisable n'est pas assimilé à de la mémoire anonyme. Surveillance pendant l'outil : arrêt avant les dix dernières tâches ou les 64 derniers MiB hors cache. Ces marges sont prudentes, pas une isolation des ressources du VPS.

En timeout/échec/interruption, TERM puis KILL si nécessaire ciblent uniquement le nouveau groupe de processus créé par ce lanceur, avec contrôle des membres UID/cgroup. Le résultat est non nul ; aucune compilation interrompue n'est validée. Ne jamais tuer globalement Node/npm ou Remote. Si l'admission refuse, réauditer les seuls processus autorisés ; ne pas augmenter les limites. Les métriques du dernier succès sont écrites dans `.local/quality-last.json` ignoré par Git. Sorties d'outils et JSON indiquent statut, durée et pic de tâches ; un ancien résultat n'est pas une preuve de l'exécution actuelle.

## Diagnostic R18

Le 10/10/2026, deux processus Node Remote ont chacun 23 threads dont 16 libuv-workers. L'origine a été constatée dans le bootstrap installé de `@wonderwhy-er/desktop-commander` : `DEFAULT_THREADPOOL_SIZE = 16`, affecté seulement si aucune valeur fournie. La commande enfant hérite effectivement de 16. Le fichier `/proc/PID/environ` des processus initiaux ne montrait pas cette affectation JavaScript ultérieure ; aucune sortie d'environnement complète ni secret n'a été recueilli. Le service et ce bootstrap sont restés inchangés.

Node documente que libuv lit la taille au démarrage du pool ; l'environnement doit être fourni avant le lancement de l'enfant. Références : https://nodejs.org/api/cli.html#uv_threadpool_sizesize et https://nodejs.org/api/cli.html#--v8-pool-sizenum. Un probe local avec ces paramètres a observé cinq threads après une lecture asynchrone, au lieu des 23 du processus Remote. Cela n'est pas un plafond universel : des outils peuvent créer d'autres workers, d'où la surveillance et les marges.

Les régressions couvrent les refus d'admission, l'environnement local sans changement du parent, un timeout avec enfant résistant à TERM et les refus d'import/entrée publique. Aucun test ne provoque volontairement la saturation de 100 tâches.

Recette navigateur reportée R17 ; aucun succès tactile, clavier, lecteur d'écran, responsive ou aptitude production n'est déclaré. Aucune migration SQL, modification privilégiée ou opération sur un service voisin.
