# Migrations versionnées — point6.2

## Moteur existant conservé

Le moteur est le lanceur root /usr/local/sbin/dental-lab-migrate, révision3 approuvée au point2.6, SHA256 698472ebcc0ca0f8a1d74151cb7331ecfa9e113d8231f9262b3ba6f535de9ea1. Aucun remplacement, nouveau moteur npm, table d’historique concurrente, délégation IA ou utilisation du rôle applicatif.

| Obligation | Mécanisme existant audité |
|---|---|
| Versions et octets approuvés | Nom borné, source privée UID1002/un lien, lecture bornée sans symlink, SHA256 approuvé, snapshot root conservé |
| Historique faisant autorité | Reçus root privés dans /var/lib/dental-lab-migrations/receipts ; fichiers .pending et .rollback-verified conservés |
| Exclusivité opérateur | operator.lock root protégé, flock exclusif non bloquant |
| Exclusivité SQL | pg_advisory_xact_lock(28467789), limitée à la transaction/dental_lab |
| Atomicité | psql17 -X -w ON_ERROR_STOP=1 --single-transaction avec -c préambule, -f snapshot et -c contrôle final |
| Identités | SQL comme dental-migrate avec rôle local dental_lab_migrator, jamais app/audit/root/postgres pour le SQL projet |
| Succès | Reçu seulement après succès SQL puis NOLOGIN et zéro session vérifiés |
| Rejeu | Même version réussie/archivée/incertaine refusée ; aucun SQL ni ouverture LOGIN |
| Reprise | Toute .pending bloque toutes les versions ; résolution humaine ciblée selon état SQL/snapshot/unité/session |

Le moteur n’impose pas seul l’ordre numérique des versions : l’opérateur doit appliquer une version approuvée à la fois, dans l’ordre du catalogue et des dépendances validées. Le catalogue n’autorise jamais une exécution et ne présume pas les reçus privés. Aucun rollback/rejeu automatique. Modifier une version exécutée est interdit : créer une nouvelle migration pour une correction.

## Préparation indépendante

Depuis /srv/dental-lab sous dental-ai :

```bash
python3 scripts/run-quality.py check:migrations
python3 scripts/run-quality.py test:migrations
```

scripts/migration-catalog.py lit seulement les sources privées, refuse noms/numéros dupliqués, fichiers publics/liens/répertoires/NUL/tailles invalides, contrôle le filtre exact rev3 et calcule les SHA256. Il exécute seulement les octets de validation dont l’empreinte est épinglée ; aucun appel SQL/root. Les fixtures0000/9900/9901, la sonde0001 reçue en6.2 et la migration0002 reçue en6.3 sont identifiées comme enregistrées non rejouables et leurs octets épinglés. Le catalogue est un inventaire, pas une deuxième source d’historique. Le manifeste imprimé ne signifie pas « migration installée ».

tests/migrations/test_migration_engine.py vérifie fichiers/catalogue/rejeu/pending/archive et exclusivité flock réelle sur fichiers temporaires du projet ; UIDroot/appels administrateur sont explicitement simulés et subprocess sont doublés. Les18tests existants2.6 restent inchangés et complémentaires. Aucun test hors ligne ne valide une migration SQL réelle.

## Réception réelle validée — 11/10/2026

La réception administrateur de docs/admin-proposals/POINT_6_2_ADMIN.md est validée : sonde0001/SHA approuvé réussie, identités et verrou conformes, refus de rejeu et concurrence avec reçu inchangé, snapshot/reçu vérifiés et aucunpending. Audit final NOLOGIN/sessions0/locks0/tables0 et lanceurSHA inchangé. Ces preuves sont fournies par l’administrateur ; l’IA corrobore les états SQL lisibles et les empreintes sans accès au registre protégé ni nouvelle exécution. Ne rejouer aucune version enregistrée ;0002 est également reçue au point6.3. Les preuves d’atomicité réelle2.6 restent valides ; chaque nouvelle migration/SHA exige sa propre approbation.

La base de recette est la base dédiée dental_lab, seule destination autorisée, avec zéro table applicative constatée avant cette intervention ; il ne s’agit pas d’un cluster PostgreSQL, réseau ou VPS complètement isolé. Aucun nouveau cluster/base/rôle nécessaire à cette sonde ; aucune donnée patient. La sonde n’exige ni table ni nettoyage SQL.

## Échec et résultat incertain

1. STOP les versions suivantes ; ne pas supprimer/renommer un .pending sans décision administrateur.
2. Vérifier sous administrateur uniquement identité NOLOGIN, session migration et unité précise enregistrée ; NOLOGIN ne termine pas une session.
3. Vérifier SHA du snapshot et état réel dans dental_lab. Un retour client non nul n’établit pas à lui seul un rollback si le commit est incertain.
4. Si SQL non engagé/rollback prouvé, archiver l’état après revue. Une version rollback-verified reste non rejouable ; préparer une nouvelle version si nécessaire.
5. Si SQL engagé, rapprochement du registre et de la base après revue humaine ; ne jamais relancer pour « voir ».
6. Toute réparation SQL passe par un nouveau fichier/SHA explicitement approuvé, et sauvegarde/plan de restauration selon risque. Pas de DROP OWNED/CASCADE ou restauration du cluster.

Pour la nouvelle sonde readonly uniquement : un résultat incertain peut ajouter un snapshot/état de registre mais ne modifie aucun objet métier ; la fermeture et l’archivage restent administrateur. Les effets externes/non transactionnels, séquences, extensions, fonctions privilégiées et SQL administratif ne sont pas garantis annulables par le moteur ; revue obligatoire. Rétention snapshots/receipts, capacité disque et sauvegarde du registre avec les données restent à valider avant production. Les limites systemd concernent le client, pas les ressources SQL du serveur partagé.

Sources primaires : https://www.postgresql.org/docs/17/app-psql.html ; https://www.postgresql.org/docs/17/functions-admin.html ; https://www.postgresql.org/docs/17/view-pg-locks.html .
