# V4 sur le VPS partagé — préparation uniquement

14 octobre 2026. Aucune installation ni exécution A/B autorisée par ce fichier.

## Périmètre figé

Nouvelle image `/var/lib/dental-lab-pg-recipe-v4/sandbox.raw` de 512 Mio, utilisateur `dental-pg-test-v4`, unité `dental-pg-recipe-v4@.service`. Réseau privé, AF_UNIX seulement, aucune capacité, aucun accès au socket PostgreSQL hôte ; 768 Mio RAM, swap nul, CPU50%, 48 tâches, 5 minutes. Les chemins v1/v2/v3 restent intacts. Partage du noyau/I/O : aucun isolement absolu des ressources n'est promis.

Le bundle `.local/registration-shared-v4-review.tar.gz` reprend le code figé de la recette 98d1261 et adapte uniquement le contrôle d'entrée du harness au confinement v4. SHA256 `c753860e5eb68b6255e44dddd4da8f2fbece88fc248c92ed756f10a916897b62`. Il ne prétend pas recevoir les nouveaux adaptateurs approbation/profil du présent lot. Le bundle VM antérieur reste intact ; ne pas lancer son runner VM sur le VPS.

Artefacts nouveaux :
- `prepare-isolated-pg-envelope-v4.py` prépare seulement la nouvelle image ;
- `dental-pg-recipe-v4@.service` conserve les protections v3 ;
- `isolated-pg-recipe-v4-runner.sh isolation` vérifie les frontières sans initdb ;
- mode `test` exige isolation.json puis approbation root distincte dans l'image. Aucun marqueur d'approbation créé dans ce lot ;
- `PG_RECIPE_V4_SHA256SUMS` fixe les quatre empreintes.

Le mode test ne rejoue ni bootstrap propriétaire ni linked_works déjà validés. Il vise uniquement la réception catalogue/inscription préparée précédemment. Aucun nettoyage automatique ; tout marqueur ou chemin préexistant interdit une nouvelle tentative.

## Prochaines opérations proposées, NON exécutées

Après accord spécifique pour A : copie administrateur des quatre artefacts dans `/root/dental-pg-recipe-v4-review`, répertoire root:root 0700, fichiers réguliers non liés root:root 0600. Copier le manifeste approuvé avec eux. Vérifier que l'archive vient de `.local` et les trois autres fichiers de `docs/admin-proposals`. Ne jamais exécuter un fichier privilégié depuis `/srv/dental-lab`.

Depuis la copie privée vérifiée, la commande de préparation serait :

```bash
cd /root/dental-pg-recipe-v4-review
sha256sum --check PG_RECIPE_V4_SHA256SUMS
DENTAL_PG_RECIPE_ENVELOPE_APPROVED=v4 /usr/bin/python3 -I ./prepare-isolated-pg-envelope-v4.py
```

Attendu : `ENVELOPE_PREPARED_NO_POSTGRES_STARTED`. Le script refuse identité/hôte/préconditions incorrects, compte/image/unité préexistants, SHA/modes incorrects, RAM/disque insuffisants et charge >=2. Les commandes ci-dessus doivent être placées dans un shell administrateur avec `set -euo pipefail` lors de la future réception ; aucune poursuite après erreur.

L'installation temporaire de l'unité et son démarrage en mode isolation nécessitent aussi accord, relevés avant/après des services, sockets et configurations PostgreSQL, contrôle mounts/loops et conservation des sorties. Ne pas considérer la seule création de l'image comme une réception A. B reste interdit tant qu'isolation réelle et comparaison des services ne sont pas reçues. Le dossier opérateur A/B complet sera finalisé au moment de l'autorisation, pour coller à l'état réel du VPS ; aucune commande de démarrage fournie comme autorisation implicite.

## Vérification de préparation

Trois tests hors ligne ciblés vérifient SHA intégrales, archive, syntaxe, limites et absence de réécriture v3. Ils ne démarrent aucun service et ne démontrent pas l'isolation réelle. La vérification indépendante 6.4 des reçus et de l'équivalence de schéma demeure distincte. Toute anomalie suspend l'opération concernée, sans changer les limites ni les permissions pour contourner l'échec.
