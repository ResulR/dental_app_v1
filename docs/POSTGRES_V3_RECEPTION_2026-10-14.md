# Réception PostgreSQL v3 — 14 octobre 2026

## Portée et provenance

Résultats administrateur communiqués par le propriétaire dans cette session, rapprochés du dépôt au commit `6e523bed57ecc55c10872d56d1c11669aee3d15b`. Les journaux privés sous /root n'ont pas été relus par dental-ai. Cette note consigne la réception rapportée ; elle ne remplace pas les preuves originales et ne constitue aucune autorisation de migration, de bootstrap réel ou de déploiement.

## Résultats rapportés

- Phase A : ENVELOPE_PREPARED_NO_POSTGRES_STARTED ; isolation-passed, UID 991 ; Result=success, ExecMainStatus=0, inactive/dead ; A_V3_OK_NO_POSTGRES_STARTED.
- Phase B : B_V3_PREFLIGHT_IMAGE_OK ; owner_bootstrap_postgres passed (atomicité, rollback, perte de connexion, concurrence du premier propriétaire et refus de réutilisation).
- linked_works_postgres_v3 passed : intégrité, permissions, transitions, rollback et six scénarios concurrents. Les 23505 rapportées sont les conflits attendus des scénarios.
- Arrêt propre du PostgreSQL isolé ; B_V3_TECHNICAL_CHECKS_OK.
- Contrôles indépendants rapportés : production accessible, services actifs, unités v3 arrêtées avec MainPID=0, aucun processus PostgreSQL de test résiduel identifié, v1/v2 préservés.

Ces succès couvrent les scénarios et le bundle v3 testés. Ils ne prouvent ni l'application des migrations de production, ni un propriétaire réel, ni la réception HTTPS/navigateur/e-mail, ni la restauration d'une sauvegarde. Le défaut de permissions v2 est corrigé pour ces scénarios.

## Vérifications directes non privilégiées de cette reprise

Identité dental-ai (UID 1002), /srv/dental-lab, cgroup dental-ai-remote.service. Git main propre au début, origin/main identique après fetch.

Les six scripts/unité listés dans PG_RECIPE_V3_SHA256SUMS correspondent à leurs empreintes. L'archive est dans `.local/owner-bootstrap-review-v3.tar.gz`, pas dans docs/admin-proposals ; l'appel initial sha256sum -c depuis ce dernier répertoire a donc signalé un fichier absent. Le contrôle au chemin réel a ensuite confirmé l'empreinte attendue, sans déplacer, extraire ou recréer l'archive.

- Manifeste : cbd1b6e0bb125f262d01f36072f7f5f2516da515ae7cec97c13dd2e78556ec6f
- Archive v3 : 488be4f1277fbc933157252f270f0cc7e3c66b8218535265b87c809ecba365dd

Unités v3 test et isolation : success/0, inactive/dead, MainPID=0. Services observés actifs avec les PID initiaux : PostgreSQL 246009, Nginx 895970, PM2 842, dental-site 619021, Remote 1892718. Aucun processus de recette parmi les processus accessibles relevés. La visibilité de dental-ai n'est pas un inventaire administrateur universel.

Aucune recette A/B, migration, opération de nettoyage, création de propriétaire ou modification de service exécutée. Les artefacts historiques, images et preuves restent à conserver sans changement.

## Conséquences roadmap

Le succès v3 retire la mention « jamais testé sur PostgreSQL réel » pour le bootstrap et les travaux liés du bundle v3. Il ne clôt pas globalement les points 6.4 à 6.11, dont réception de production/reçus restent distincts, ni 7.1–7.3. Le dernier point de fondation SQL entièrement marqué validé reste 6.3 ; 6.4 est la première réception SQL incomplète. Les exceptions UX R17 demeurent.

Les noyaux 7.1/7.2 ont déjà leurs adaptateurs/API ; leurs portes runtime/HTTPS/e-mail restent ouvertes. Le premier besoin applicatif repris est l'intégration 7.3 (inscription clinique), puis les dépendances d'admission asynchrone de 7.6–7.9. Ne pas réimplémenter les noyaux existants.
