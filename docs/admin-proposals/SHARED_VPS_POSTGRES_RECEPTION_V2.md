# Réception PostgreSQL v2 — préparation uniquement, NON EXÉCUTÉE

Date : 14 octobre 2026. Base de la v1 conservée : a9d0123.
Autorisation reçue : correction dans le dépôt, tests statiques, bundle, commit.
Aucune autorisation de création d'enveloppe v2, de démarrage PostgreSQL ou de migration production.

## Correction et dépendances

0005 : la FK composite incluant child_kind généré ne permet pas ON UPDATE CASCADE sous PG17.
Deux FK nommées remplacent cette FK : (enfant,clinique,type) NO ACTION et (enfant,clinique,statut) CASCADE.
Deux UNIQUE correspondants remplacent orders_id_clinic_kind_status_unique.
Recherche sur 0002–0013 : aucune autre référence ne dépend de l'ancienne clé à quatre colonnes ou de son nom.
Les clés existantes (id,clinique) et (id,clinique,kind,origin) restent intactes.
Source, absence d'auto-lien, qualification, statut historique, motif, idempotence, index partiel et vue inchangés.
Les changements de statut ne modifient pas source_revision/source_status_at_creation.

Aucun repository/route applicatif de travaux liés n'existe dans apps/api/src au commit de base.
Les INSERT des fixtures omettent child_kind, toujours généré.
0010 conserve UPDATE limité sur orders et aucun UPDATE direct sur work_links.
La vérification du statut réel/révision de la source avec verrou transactionnel demeure une responsabilité du futur service métier.
La FK ne transforme pas source_status_at_creation en preuve du statut réel historique.
Les parcours SQL de contrainte ne constituent pas une validation des transitions autorisées par les futures routes métier.

## Reçus production : inconnu, aucune décision de déploiement

Lecture de /var/lib/dental-lab-migrations/receipts refusée à dental-ai.
Ne pas conclure que 0005 est absente ou appliquée. Aucun changement de reçu/lanceur/snapshot.
La correction de 0005 est destinée à une nouvelle base de recette vide uniquement.
Une 0014 ne pourrait pas réparer un parcours neuf qui s'arrête déjà à 0005.
Si un reçu 0005 existe, STOP pour rapprochement du SHA, du snapshot archivé et du schéma réel :
ni remplacement d'un reçu ni rejeu automatique. Les anciennes instructions du chapitre 6 gardent
leurs anciennes empreintes ; elles ne sont PAS une autorisation d'appliquer la v2.

Commande administrateur proposée, lecture seule :
```bash
sudo python3 -I - <<'PY'
import hashlib,json,os,stat
from pathlib import Path
assert os.getuid()==0
assert os.uname().nodename=='vps-28bf7789'
d=Path('/var/lib/dental-lab-migrations/receipts')
assert d.is_dir() and not d.is_symlink()
for p in sorted(d.iterdir()):
    st=p.lstat()
    assert stat.S_ISREG(st.st_mode) and st.st_uid==0 and st.st_size<1048576
    if p.name.endswith('.pending'):
        print('STOP_PENDING',p.name)
    raw=p.read_bytes()
    try:
        r=json.loads(raw)
        print(json.dumps({'file':p.name,'receipt_sha256':hashlib.sha256(raw).hexdigest(),
                          'migration_sha256':r.get('sha256'),'state':r.get('state'),
                          'version':r.get('version')}))
    except (ValueError,AttributeError):
        print('UNPARSED_RECEIPT_REQUIRES_REVIEW',p.name)
PY
```
Aucun accès aux autres applications ou lecture de secrets.

## Bundle et séparation des données

.local/owner-bootstrap-review-v2.tar.gz : 1648 fichiers, construit depuis la v1 vérifiée.
Trois deltas seulement : migration0005, scripts/linked-works-postgres-v2.mjs,
tests/postgres/linked-works-v2-seed.sql. Aucun rebuild/dépendance mise à jour.
MANIFEST.json donne les SHA de chaque fichier ; OWNER_BOOTSTRAP_V2_ARTIFACTS.json décrit l'ensemble.
prepare-owner-bootstrap-v2.py refuse d'écraser le bundle ou le rapport existants.
Les autres migrations0002–0013 et les tests du premier propriétaire conservent les octets de la v1.

Après fixture0002–0013 réussie, le runner clone la base vide dental_lab en dental_lab_links,
avant le test de premier propriétaire. Même cluster synthétique, bases distinctes.
Le test propriétaire original s'exécute dans dental_lab, puis les régressions dans dental_lab_links.
Les rôles SQL ne sont créés que dans ce cluster neuf. Aucun compte réel.
Les données des scénarios réussis sont réinitialisées entre courses dans dental_lab_links uniquement ;
aucune remise à zéro après échec. Le dernier état et les résultats sont conservés.
Le runner conserve les chemins INTERNES attendus par le harness v1 dans la racine privée ;
cela n'est pas un accès à l'image v1 de l'hôte.

Nouveaux objets hôte proposés :
- /root/dental-pg-recipe-v2-review
- /var/lib/dental-lab-pg-recipe-v2/sandbox.raw et mount
- utilisateur dental-pg-test-v2
- /run/systemd/system/dental-pg-recipe-v2@.service
La v1 reste en place, y compris son état failed. Pas de reset-failed/stop/nettoyage de la v1.

## Tests préparés, PAS exécutés sur PostgreSQL

Deux groupes séquentiels : transitions/permissions/rollback et intégrité type/clinique/source.
Six courses : deux créations, libération contre création, réactivation contre création ;
chaque course couvre COMMIT et ROLLBACK de la première session.
Le second writer doit être observé dans pg_stat_activity avec wait_event_type=Lock.
23505 doit citer work_links_one_active_retouch_idx ; état relu depuis une nouvelle connexion.
Les opérations métier testées utilisent SET LOCAL ROLE dental_lab_app.
Les tentatives directes de modification des liens doivent échouer42501 ;
les falsifications de statut/type testées sous migrateur doivent échouer23503.
Cela teste les ACL SQL, pas l'authentification peer du vrai runtime.
Une retouche completed reste active. rejected/cancelled/delivered libèrent l'index.
delivered→completed reacquiert l'emplacement ou échoue atomiquement si déjà occupé.

## Préparation administrateur proposée — ne pas exécuter maintenant

Vérifier d'abord les reçus si une décision production est envisagée.
Pour la recette seule : fenêtre calme, aucune autre intervention, sauvegarde récente vérifiée
avec limites connues (restauration OVH non démontrée), ≥2Gio RAM/disque et load<2.
Nouvelle phase A puis STOP et revue ; phase B seulement après autorisation distincte.
Garder une deuxième console et vérifier la réactivité métier avant/pendant/après.

Copie root privée des artefacts après autorisation de préparation v2 :
```bash
sudo bash <<'SH'
set -euo pipefail
umask 077
test "$(id -u)" = 0
test "$(hostname)" = vps-28bf7789
review=/root/dental-pg-recipe-v2-review
test ! -e "$review"
test ! -L "$review"
install -d -o root -g root -m 700 "$review"
cd "$review"
for n in prepare-isolated-pg-envelope-v2.py isolated-pg-recipe-v2-runner.sh \
 dental-pg-recipe-v2@.service reception-v2-common.sh reception-v2-a.sh reception-v2-b.sh; do
 runuser -u dental-ai -- cat "/srv/dental-lab/docs/admin-proposals/$n" > "$n"
done
runuser -u dental-ai -- cat /srv/dental-lab/.local/owner-bootstrap-review-v2.tar.gz > owner-bootstrap-review-v2.tar.gz
runuser -u dental-ai -- cat /srv/dental-lab/docs/admin-proposals/PG_RECIPE_V2_SHA256SUMS > SHA256SUMS
printf '%s\n' 'c5653bcf1de9393f9a93a864fede4cb6a4b17794a49b3c257c0b946e4340ac4e  SHA256SUMS' | sha256sum -c -
sha256sum -c SHA256SUMS
printf 'V2_ARTIFACTS_STAGED_ONLY\n'
SH
```

Phase A v2 uniquement, après son autorisation :
```bash
sudo bash /root/dental-pg-recipe-v2-review/reception-v2-a.sh
```
Attendu : ENVELOPE_PREPARED_NO_POSTGRES_STARTED, isolation-passed,
inactive/dead success/0, A_V2_OK_NO_POSTGRES_STARTED. Arrêt pour revue de ces preuves.
Ne pas enchaîner B dans le même bloc.

Phase B v2 uniquement, après son autorisation séparée :
```bash
sudo bash /root/dental-pg-recipe-v2-review/reception-v2-b.sh
```
Attendu : B_V2_PREFLIGHT_IMAGE_OK, owner_bootstrap_postgres/passed,
linked_works_postgres_v2/passed avec8 groupes dont6 courses, arrêt PG propre,
inactive/dead success/0, aucune divergence hôte, B_V2_TECHNICAL_CHECKS_OK.
Le succès du JSON seul ne suffit pas.

## Arrêt et preuves

Même enveloppe : RAM768Mio, swap0, CPU50% d'un CPU,48 tâches, image512Mio,
tmp32Mio, délai unité5min, harness propriétaire90s, linked120s, durabilité PG active.
IOWeight10 ne garantit pas un plafond absolu d'I/O.
RAM hôte<1Gio, load>3 (arrêt immédiat conservateur), voisin dégradé,
différence services/config/sockets, timeout, OOM, résultat incomplet : STOP.
Les scripts arrêtent UNIQUEMENT l'unité v2 demandée, sans réessai ni effacement.
Depuis la deuxième console, si B tourne :
```bash
sudo systemctl stop dental-pg-recipe-v2@test.service
```
Pour A, arrêter seulement dental-pg-recipe-v2@isolation.service.
Un montage de diagnostic peut rester après erreur : ne pas démarrer/rejouer avant inspection.
Ne pas monter une image encore utilisée. Aucun détachement global des loop.
Conserver A/B.attempt, journaux, image, test.pending, result/linked-result, fixture/server/stop logs.
Les PID/readiness/config/sockets stables ne prouvent pas à eux seuls l'absence de latence.
Aucun nettoyage, déploiement, propriétaire réel ou migration production autorisé.

## Vérifications de préparation réellement réalisées

- Dépendances SQL et absence de requêtes applicatives work_links examinées.
- Reçus production : tentative de lecture refusée, état non conclu.
- 24 tests Python hors ligne réussis, dont6 nouveaux tests v2.
- Validation du catalogue par le validateur de migrations existant réussie.
- node --check, bash -n, AST Python y compris blocs embarqués, systemd-analyze verify réussis.
- Bundle v1 inchangé ; manifeste/deltas du bundle v2 vérifiés.
- Aucun initdb, démarrage PostgreSQL, SQL de recette ou opération privilégiée exécuté.
La compatibilité DDL réelle0002–0013 et les courses restent à démontrer lors de B v2.
