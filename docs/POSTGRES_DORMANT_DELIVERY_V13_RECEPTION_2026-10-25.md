# Réception PostgreSQL isolée v13 — 25 octobre 2026

**Réussite historique, recette exécutée une seule fois. Ne jamais la relancer.**

- Commit réceptionné : `4c4a3d0`.
- Manifeste : 248 fichiers ; SHA-256 du manifeste :
  `41ad166bb384ca2dc5ca783d9349f193437f6ca2ef56fb01ec09c82d567b8a5b`.
- Résultat réel : `{"result":"real-postgres-dormant-delivery-v13-passed","assertions":39}`.
- Sortie du runner : code 0 ; marqueur `V13_SQL_OK_STOPPED`.
- Preuves immuables : `.local/notifications-v13` (non versionné).
- Cluster PostgreSQL v13 arrêté ; `pg_ctl` confirme « no server running » ;
  socket privée absente, aucun processus v13 restant.
- Journal `test-error.log` vide.
- Captures avant/après des services, du PostgreSQL de production et des sockets
  identiques ; PostgreSQL de production accepte les connexions ; services
  `nginx`, `postgresql@17-main`, `dental-site` et `dental-ai-remote` actifs.
- Git resté propre et synchronisé après la recette.
- Les 107 assertions v12 et `V12_SQL_OK_STOPPED` restent inchangés.

**Portée :** 39 assertions SQL sur réservation, concurrence, prévol,
permissions, récupération de bail, retry, tentative et fournisseur fictif.

**Non couvert :** la seconde transaction `authorize` ajoutée ensuite au
commit `10f0a08`, le fournisseur externe, les révocations postérieures à la
dernière transaction, la livraison exactement une fois, les parcours navigateur
et l'installation administrative des migrations 0022/0023.

La recette v14 est distincte et n'est pas autorisée par ce document.

**Note sur le manifeste historique :** après `10f0a08`, les sources et
artefacts compilés du repository/worker ont changé. La vérification
`sha256sum -c tests/postgres/notifications-v13.sha256` contre le HEAD actuel
signale donc quatre écarts attendus. Cela n'invalide pas les preuves de
réception enregistrées sous `.local/notifications-v13` ; ne pas modifier ni
rejouer le bundle historique pour tenter de faire passer son contrôle statique.
Le manifeste v14 est calculé sur le code actuel.
