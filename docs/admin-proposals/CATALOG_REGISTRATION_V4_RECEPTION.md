# Réception 6.4 / 7.3 indépendante — préparation v4

Statut : NON EXÉCUTÉE. Ni autorisation de créer une VM, ni autorisation d'exécuter PostgreSQL, ni migration de production. Ne pas utiliser les commandes historiques de POINT_6_4_ADMIN.md pour rejouer 0003.

## 6.4 : état et preuves manquantes

Audit direct du 14/10/2026 : dental_lab, dental-ai, PostgreSQL 170011 ; trois tables et une vue catalogue, propriétaire dental_lab_migrator ; 19 contraintes catalogue validées. registration_current_terms absente. Transaction d'audit READ ONLY terminée, aucune donnée métier lue.

| Élément | État |
|---|---|
| Migration 0003 | Application rapportée précédemment, objets corroborés ; NE PAS rejouer |
| Empreinte du source | 9118fd82740fb914b69fd79946bebca1ca0c1b32b679709b48217edec7df7c5c |
| Reçu et snapshot administrateur | Correspondance actuelle encore à produire |
| 15 refus, renommage/suppression préservant historique/interdiction | Recette préparée, pas de preuve d'exécution fournie |
| Rollback et absence de fixtures résiduelles | À démontrer dans la nouvelle base indépendante |
| Équivalence de schéma indépendant/production | À comparer avant clôture ; un succès v4 seul ne clôt pas la réception de production |

### Commande administrateur de preuve — lecture seule sur le VPS

À proposer pour autorisation ; n'exécute aucun SQL et ne lance aucun script du dépôt.

```bash
test "$(id -u)" = 0 || exit 1
/usr/bin/python3 -I - <<'PY'
import hashlib,json
from pathlib import Path
base=Path('/var/lib/dental-lab-migrations')
receipt=base/'receipts/0003_catalog_snapshots.sql'
assert not receipt.is_symlink() and receipt.is_file()
record=json.loads(receipt.read_bytes())
expected='9118fd82740fb914b69fd79946bebca1ca0c1b32b679709b48217edec7df7c5c'
assert record['version']=='0003_catalog_snapshots.sql'
assert record['sha256']==expected
snapshot=Path(record['snapshot'])
assert snapshot.is_absolute() and not snapshot.is_symlink()
assert snapshot.resolve().is_relative_to(base.resolve())
assert snapshot.name=='0003_catalog_snapshots.sql'
assert hashlib.sha256(snapshot.read_bytes()).hexdigest()==expected
assert not any(p.name.endswith('.pending') for p in (base/'receipts').iterdir())
print('CATALOG_RECEIPT_SNAPSHOT_MATCH_NO_PENDING')
PY
```

Risque : lecture de métadonnées administrateur uniquement. STOP à toute assertion ; conserver le registre, aucun effacement de pending, aucune relance de migration.

## Recette SQL indépendante proposée

Cible choisie dans cette proposition : VM Debian distincte, nom exact dental-reception-v4, sans applications hébergées ni données réelles. Le VPS vps-28bf7789 est explicitement refusé par le harness. Aucune image v1/v2/v3 n'est réutilisée. Le bundle copie uniquement des octets de dépendances de l'archive v3 figée, plus le code compilé actuel ; l'archive source reste intacte.

Fichiers :
- tests/postgres/run-registration-v4.sh : démarrage/arrêt bornés du cluster indépendant ;
- tests/postgres/catalog-registration-v4-fixture.sql : schéma 0002–0014 et propriétaire/conditions strictement synthétiques ;
- tests/postgres/catalog-registration-v4.mjs : catalogue puis véritable adaptateur d'inscription sous dental_lab_app ;
- .local/registration-v4-review.tar.gz et REGISTRATION_V4_ARTIFACTS.json : archive et empreintes exactes.

Les conditions synthétiques ne constituent pas une validation juridique. Le compte synthétique n'a pas de credential utilisable.

### Préconditions de la VM — à confirmer avant autorisation

VM dédiée disponible et autorisée ; PostgreSQL 17, Node 22.22.2, Python3, systemd déjà installés. Aucun achat ni installation n'est effectué ici. Archive transférée par l'opérateur dans /root/registration-v4-review.tar.gz, fichier régulier root:root privé ; empreinte comparée au rapport versionné. Aucun compte dental-v4, unité dental-registration-v4, /opt/dental-registration-v4 ou /var/lib/dental-lab-reception-v4 existant. Au moins 2 Gio de RAM disponible et 2 Gio de disque libre. STOP si une condition manque.

### Installation du bundle — uniquement dans la VM dédiée, après accord

Relire le manifeste et comparer EXPECTED au SHA-256 du rapport versionné. Cette empreinte est figée pour ce bundle ; ne jamais la remplacer par celle d'une archive non approuvée.

```bash
set -euo pipefail
test "$(id -u)" = 0
test "$(hostname)" = dental-reception-v4
export EXPECTED='5f9221df52a9285079fd6cc8dd42eda7d668f58bce8980bd1ba1a6451ae651c7'
python3 -I - <<'PY'
import hashlib,io,json,os,stat,tarfile
from pathlib import Path
p=Path('/root/registration-v4-review.tar.gz')
s=p.lstat()
assert stat.S_ISREG(s.st_mode) and s.st_uid==0 and not s.st_mode&0o077
raw=p.read_bytes()
assert len(raw)<=52428800 and hashlib.sha256(raw).hexdigest()==os.environ['EXPECTED']
target=Path('/opt/dental-registration-v4')
assert not target.exists() and not target.is_symlink()
with tarfile.open(fileobj=io.BytesIO(raw),mode='r:gz') as t:
    members=t.getmembers()
    assert len(members)==len({m.name for m in members})
    assert sum(m.size for m in members)<104857600
    assert all(m.isfile() and not m.name.startswith('/') and '..' not in Path(m.name).parts for m in members)
    manifest=json.load(t.extractfile('MANIFEST.json'))
    assert set(manifest)=={m.name for m in members if m.name!='MANIFEST.json'}
    contents={m.name:t.extractfile(m).read() for m in members}
    assert all(hashlib.sha256(contents[n]).hexdigest()==h for n,h in manifest.items())
    target.mkdir(mode=0o755)
    for name,data in contents.items():
        f=target/name
        f.parent.mkdir(parents=True,exist_ok=True,mode=0o755)
        with f.open('xb') as out:out.write(data)
        f.chmod(0o444)
print('V4_BUNDLE_INSTALLED_NOT_EXECUTED')
PY
```

### Préparer le compte et lancer la recette — accord distinct requis

Ce bloc crée seulement le compte et le répertoire de la VM dédiée, puis une unité transitoire plafonnée. Il est interdit sur le VPS partagé. Pas de relance en présence de l'un des chemins/marqueurs.

```bash
set -euo pipefail
test "$(id -u)" = 0
test "$(hostname)" = dental-reception-v4
test "$(/usr/bin/node --version)" = v22.22.2
/usr/lib/postgresql/17/bin/postgres --version
test ! -e /var/lib/dental-lab-reception-v4
if getent passwd dental-v4 >/dev/null; then exit 1; fi
python3 -I - <<'PY'
import os,shutil
from pathlib import Path
assert shutil.disk_usage('/var/lib').free>=2*1024**3
m=dict(line.split(':',1) for line in Path('/proc/meminfo').read_text().splitlines())
assert int(m['MemAvailable'].split()[0])>=2*1024**2
assert os.getloadavg()[0]<2
PY
useradd --system --user-group --no-create-home --home-dir /nonexistent --shell /usr/sbin/nologin dental-v4
install -d -m 0700 -o dental-v4 -g dental-v4 /var/lib/dental-lab-reception-v4
systemd-run --unit=dental-registration-v4 --wait \
 --property=User=dental-v4 --property=Group=dental-v4 \
 --property=MemoryMax=768M --property=MemorySwapMax=0 \
 --property=CPUQuota=50% --property=TasksMax=48 \
 --property=RuntimeMaxSec=240 --property=TimeoutStopSec=30 \
 --property=NoNewPrivileges=yes --property=PrivateNetwork=yes \
 --property=PrivateTmp=yes --property=PrivateDevices=yes \
 --property=ProtectSystem=strict --property=ProtectHome=yes \
 --property=RestrictAddressFamilies=AF_UNIX \
 --property=ReadWritePaths=/var/lib/dental-lab-reception-v4 \
 --setenv=DENTAL_RECEPTION_V4_APPROVED=independent-empty-vm \
 /bin/bash /opt/dental-registration-v4/tests/postgres/run-registration-v4.sh
```

Attendus : résultat catalog_registration_v4 passed avec cinq groupes : catalogue 15 refus/historique/rollback ; rollback à chacune des huit écritures ; concurrence email (created/duplicate avec attente de verrou observée) ; publication des conditions bloquée puis consentement obsolète refusé ; six refus ACL 42501, singleton invalide refusé 23514 et readiness applicative. État final : 1 clinique/acceptation/conversation/événement synthétiques conservés. Aucun mail envoyé.

### Contrôles après exécution, y compris échec

```bash
systemctl show dental-registration-v4 -p Result -p ExecMainStatus -p MainPID -p ActiveState -p SubState
journalctl -u dental-registration-v4 --no-pager
cat /var/lib/dental-lab-reception-v4/result.json
cat /var/lib/dental-lab-reception-v4/test-error.log
cat /var/lib/dental-lab-reception-v4/stop.log
test ! -e /var/lib/dental-lab-reception-v4/pgdata/postmaster.pid
```

Attendus : success/0, MainPID=0, cluster arrêté. Conserver aussi la sortie et le code retour de systemd-run --wait : une unité transitoire terminée peut être déchargée par systemd ; son absence ultérieure ne constitue ni une preuve de succès ni une anomalie à corriger en la relançant. Croiser alors la sortie --wait, le journal et les fichiers de résultats. Si ces preuves manquent, réception incomplète. Conserver VM, données, journaux, attempt et archive. En échec, ne pas relancer, modifier les rôles, effacer les fixtures ou réinitialiser l'unité. Le trap tente uniquement l'arrêt de ce cluster ; un arrêt forcé/timeout peut rendre la preuve incomplète : diagnostic humain obligatoire. Aucun nettoyage automatique.

Risques bornés à la nouvelle VM : création de rôle Linux, DDL/DML synthétiques dans un nouveau cluster, charge plafonnée, verrous et conflits volontairement provoqués. La connexion et la perte/ambiguïté du COMMIT sont encore couvertes hors ligne par les tests de l'enveloppe, pas par cette nouvelle recette v4. La livraison fournisseur et la recette navigateur sont séparées.

## Portes de 7.3

La variable DENTAL_LAB_REGISTRATION_ENABLED reste absente/false en exploitation ; aucune configuration réelle modifiée. Son activation nécessite AUTH_ENABLED=true, schéma/ACL reçus, conditions humaines approuvées publiées avec SHA exact et validation du partage du budget anti-abus avec login. L'API ne fabrique aucune version juridique. Le formulaire est en albanais, affiche le texte sans HTML, exige une acceptation explicite et ne conserve aucun brouillon/mot de passe. Résultat ambigu : aucun retry automatique.

Le planificateur e-mail prépare des intentions durables idempotentes pour le propriétaire éligible et les administrateurs sélectionnés disposant de clinics.manage ; aucun employé/clinique, aucune adresse copiée. Il n'acquitte pas globalement l'outbox et ne démarre aucun worker. Le futur expéditeur doit revalider destinataires/droits juste avant envoi. Fournisseur, secrets et textes légaux restent à fournir/valider ; aucun message n'est livré par ce lot.
