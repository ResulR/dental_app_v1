# PostgreSQL isolé — recette v3 après échec B v2 r1 (14/10/2026)

**Statut : préparation hors privilèges uniquement. A v3 et B v3 NON AUTORISÉES et NON EXÉCUTÉES.**

## Historique immuable et diagnostic

- v1 : test DDL 0005 refusé par PostgreSQL à cause de ON UPDATE CASCADE sur colonne générée.
- v2 A : isolation réussie mais réception administrative historique incomplète ; attestation r1 indépendante vérifiée.
- v2 B r1 : B-r1.attempt présent ; PostgreSQL isolé a démarré et s'est arrêté après échec.
  owner_bootstrap_postgres a renvoyé passed ; linked_works_postgres_v2 a échoué avant les 8 contrôles :
  `{"result":"failed","message":"permission denied to examine \\"data_directory\\"","code":"42501","checks":[]}`.
- Cause établie : scripts/linked-works-postgres-v2.mjs vérifie data_directory sous postgres,
  puis SET LOCAL ROLE dental_lab_migrator ; le seed SQL tente de lire data_directory
  une seconde fois sans privilège. Le contrôle initial privilégié est conservé.
- **Ne jamais rejouer A/B v1 ou v2 ; ne jamais effacer/réinitialiser leurs unités,
  images, journaux, attestation ou marqueurs.** Ne pas changer les droits PG.

## Correction minimale, séparée de l'historique

Deux fichiers de tests nouveaux, pas de changement métier :
- `tests/postgres/linked-works-v3-seed.sql` : enlève uniquement la condition
  `current_setting('data_directory')` du précontrôle SQL sous migrator.
  Conserve contrôles de base, port, rôle et vacuité.
- `scripts/linked-works-postgres-v3.mjs` : même scénario (8 groupes dont 6 courses),
  mais référence au seed v3, jeton isolated-v3 et résultat linked_works_postgres_v3.
  **Conserve le contrôle data_directory avant SET ROLE sous postgres.**

Bundle `.local/owner-bootstrap-review-v3.tar.gz` : 1650 fichiers.
Par rapport au bundle v2 (1648), **seules différences : 2 ajouts et MANIFEST.json recalculé** ;
les 1647 autres fichiers restent identiques octet pour octet.
Bundle v2 et migrations inchangés. L'archive v3 est ignorée par Git mais stockée
sur le VPS dans .local ; ne pas la supprimer.

Nouvelle enveloppe v3 indépendante : UID système `dental-pg-test-v3`,
image `/var/lib/dental-lab-pg-recipe-v3/sandbox.raw` (512 Mio),
dossier administrateur `/root/dental-pg-recipe-v3-review`,
unité `dental-pg-recipe-v3@.service`, et reçus A/B v3 uniques.
Aucune référence vers l'image v2 dans l'exécuteur v3 ; le contrôleur
v3 vérifie explicitement l'arrêt des unités et l'absence de montages/loop/processus v1/v2.
Les limites sont 768 Mio, swap 0, 50% CPU, 48 tâches, 5 min, pas de réseau IP,
RootImage isolée, aucune autorisation de production.

## Vérifications hors ligne

- Vérification exhaustive SHA-256 du bundle v3 et de ses 1650 entrées.
- Comparaison des 1648 entrées historiques : uniquement MANIFEST.json diffère.
- Vérification de la correction exacte et maintien du garde-fou privilégié.
- Syntaxes Bash, Python, Node ; tests unitaires sans démarrage PostgreSQL.
- Les contrôles statiques **ne remplacent pas les tests SQL réels**.
- Manifeste `docs/admin-proposals/PG_RECIPE_V3_SHA256SUMS`, SHA-256 externe
  à vérifier avant toute copie root :

`cbd1b6e0bb125f262d01f36072f7f5f2516da515ae7cec97c13dd2e78556ec6f`

## Étape de réception 0 : copie root seule — autorisation distincte requise

Ne pas exécuter maintenant. Fenêtre calme, console administrateur accessible.
Ce bloc crée exclusivement le dossier root v3, copie les fichiers préparés
et vérifie leurs empreintes. Pas de mount, useradd, initdb, systemctl start.

```bash
sudo bash --noprofile --norc <<'SH'
set -euo pipefail
umask 077
test "$(id -u)" = 0
test "$(hostname)" = vps-28bf7789
review=/root/dental-pg-recipe-v3-review
test ! -e "$review"
test ! -L "$review"
install -d -o root -g root -m 700 "$review"
cd "$review"
for n in prepare-isolated-pg-envelope-v3.py isolated-pg-recipe-v3-runner.sh \
         dental-pg-recipe-v3@.service reception-v3-common.sh \
         reception-v3-a.sh reception-v3-b.sh; do
 runuser -u dental-ai -- cat "/srv/dental-lab/docs/admin-proposals/$n" > "$n"
done
runuser -u dental-ai -- cat /srv/dental-lab/.local/owner-bootstrap-review-v3.tar.gz > owner-bootstrap-review-v3.tar.gz
runuser -u dental-ai -- cat /srv/dental-lab/docs/admin-proposals/PG_RECIPE_V3_SHA256SUMS > SHA256SUMS
printf '%s\n' 'cbd1b6e0bb125f262d01f36072f7f5f2516da515ae7cec97c13dd2e78556ec6f  SHA256SUMS' | sha256sum -c -
sha256sum -c SHA256SUMS
printf 'V3_ARTIFACTS_STAGED_ONLY\n'
SH
```

Attendu : SHA256SUMS: OK, 7 fichiers OK, V3_ARTIFACTS_STAGED_ONLY.
En cas d'échec, conserver le dossier partiel ; ne pas relancer.

## Phase A v3 — nouvelle autorisation explicite requise

```bash
sudo bash /root/dental-pg-recipe-v3-review/reception-v3-a.sh
```

Attendu : ENVELOPE_PREPARED_NO_POSTGRES_STARTED ; preuve JSON isolation-passed ;
unité isolation success/0 inactive/dead ; A_V3_OK_NO_POSTGRES_STARTED.
Le script vérifie l'absence de ressources v1/v2 résiduelles et les voisins.
Aucun PostgreSQL de test n'est démarré durant A. Examiner la sortie, les
services/configurations/sockets et les journaux avant toute autorisation B.

## Phase B v3 — autorisation séparée seulement après réception de A v3

```bash
sudo bash /root/dental-pg-recipe-v3-review/reception-v3-b.sh
```

Attendu : B_V3_PREFLIGHT_IMAGE_OK, deux JSON passed
(owner_bootstrap_postgres et linked_works_postgres_v3), 8 groupes linked dont
6 courses, arrêt PG isolé propre, unité success/0 inactive/dead,
services/configurations/sockets conformes, B_V3_TECHNICAL_CHECKS_OK.
Le script ne peut pas être rejoué après B.attempt.

**Arrêt obligatoire** si une preuve manque, si PostgreSQL réel est dégradé,
si un voisin change d'état/PID, si la RAM disponible tombe sous 1 Gio,
si la charge dépasse 3, si l'unité échoue, si un montage/loop/processus
reste actif, ou si un test échoue. Conserver tous les fichiers ; pas de retry,
pas de cleanup, pas de reset-failed. Le gestionnaire d'erreur n'arrête que
l'unité v3 demandée. Après incident, diagnostiquer en lecture seule.
La non-interférence ne peut pas être garantie absolument sur un VPS partagé.

**Aucune opération de production** : pas de migrations, pas de propriétaire réel,
pas de HTTPS ni de déploiement. Les sauvegardes OVH ne sont pas restaurées ici.
