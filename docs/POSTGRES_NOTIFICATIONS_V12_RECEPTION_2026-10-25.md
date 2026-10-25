# Réception isolée PostgreSQL v12 — notifications et intentions e-mail

**Date :** 25/10/2026. **Commit reçu :** `ea88aa8` (`main`, synchronisé et propre avant/après). **Statut :** réussite **du périmètre de la recette v12**, pas validation de l’application complète ni autorisation de mise en production.

## Préflight et périmètre

- Hôte `vps-28bf7789`, UID Linux 1002 (`dental-ai`), cgroup `dental-ai-remote.service` ; limites vérifiées : CPU `50000 100000`, mémoire 1073741824 octets, 100 tâches. Marges mémoire/disque/tâches satisfaites.
- Répertoire `.local/notifications-v12` absent avant lancement ; Git `ea88aa8` propre et aligné avec `origin/main` ; syntaxe Bash/JavaScript valide.
- Manifeste `tests/postgres/notifications-v12.sha256` : 241 fichiers vérifiés. SHA-256 du manifeste : `4ae97344c26bdab806a76651a18036faeae699dac4466c3ee23e16fdff71bd33`.
- PostgreSQL 17 de production répondait sur `/var/run/postgresql:5432` avant et après. Cluster de test neuf et indépendant dans `.local/notifications-v12/pgdata`, socket privée 0700, port 55442, sans écoute TCP, données entièrement synthétiques.

## Exécution unique et résultat constaté

Commande autorisée et exécutée **une seule fois** :

```bash
DENTAL_NOTIFICATIONS_V12_APPROVED=private-unix-socket-one-shot bash tests/postgres/run-notifications-v12.sh
```

Résultat réel dans `.local/notifications-v12/result.json` :

```json
{"result":"real-postgres-notification-outbox-v12-passed","assertions":107}
```

- Runner terminé avec code **0** ; `.local/notifications-v12/ok` contient `V12_SQL_OK_STOPPED`.
- `.local/notifications-v12/test-error.log` vide (0 octet).
- `pg_ctl status` : aucun serveur ; `stop.log` confirme l’arrêt ; socket `.s.PGSQL.55442` absente ; aucun processus de cluster v12 actif.
- Captures `services-before/after`, `production-before/after` et `sockets-before/after` **identiques** ; nginx, PostgreSQL 17 principal, dental-site et dental-ai-remote actifs avec leurs PID inchangés. Git resté propre.
- Journaux et captures conservés sous `.local/notifications-v12` ; ne pas rejouer ni effacer cette réception. Les preuves v8–v11 et leurs bundles restent inchangés.

Les assertions v12 incluent les refus de privilèges sous le rôle applicatif, la visibilité des avis, la pagination et lecture individuelle, le cloisonnement clinique, les permissions courantes, les intentions e-mail, l’idempotence, le rollback, les révisions obsolètes et les courses de verrous. Le succès est limité aux cas synthétiques effectivement couverts.

## Vérifications supplémentaires après la recette

- `python3 scripts/run-quality.py test:internal-notifications` : **15 tests réussis** sur trois fichiers (dont une intégration HTTP locale ; refus d’origine étrangère, session absente et requêtes malformées). Ce n’est pas une recette HTTP complète contre un serveur déployé.
- `python3 -m unittest discover -s tests/migrations -p test_proposed_validator.py -v` : **8 tests réussis**, uniquement sur le validateur candidat hors chemin privilégié.
- `python3 scripts/migration-catalog.py` : **échec toujours présent** avec `ValueError: Contrôle de transaction/session ou effet interdit`. Le validateur historique ne reconnaît pas correctement certaines constructions SQL des migrations 0022/0023. Voir `docs/admin-proposals/MIGRATIONS_0022_0023_GATE_REVIEW.md`.
- SHA-256 des migrations conservées : 0022 `e259575c72f6c9b84aca172bcbdbcd7a67f5245f18f1902a926d33118e838cd4` ; 0023 `5eaa63d58c26e3b49377313ba9739a6b4d38daecbb0c4152e29d50a47d6e45bf`. SHA-256 du lanceur historique : `698472ebcc0ca0f8a1d74151cb7331ecfa9e113d8231f9262b3ba6f535de9ea1`.

## Portes ouvertes et interdictions

1. **Migrations 0022/0023 :** le validateur proposé est uniquement un prototype testé hors ligne. Le lanceur installé et les reçus administrateur ne sont pas modifiés ni vérifiés par cette recette. Toute nouvelle version du lanceur exige revue humaine des octets et privilèges, approbation administrateur, tests isolés du chemin complet et stratégie de retour arrière. **Aucune migration de production.**
2. **Notifications / e-mail :** aucun worker, fournisseur, envoi réel, retry/backoff de livraison ni revalidation finale des destinataires lors de l’envoi n’est reçu. Les intentions ne sont pas des e-mails délivrés.
3. **Application :** navigateur/PWA, scénarios de bout en bout, HTTP déployé, permissions de production et obligations de conformité non reçus. Ne pas activer les drapeaux ni déclarer la plateforme prête à produire.

**Décision :** réception **v12 isolée validée** pour les 107 assertions exécutées ; **chapitres 14 et 21 non clôturés**. Aucun service, migration ou déploiement de production n’a été modifié.
