# Point6.2 — Réception ciblée du moteur existant, NON EXÉCUTÉE

Lanceur2.6 conservé strictement : /usr/local/sbin/dental-lab-migrate rev3,
SHA256698472ebcc0ca0f8a1d74151cb7331ecfa9e113d8231f9262b3ba6f535de9ea1,
root:root555. Aucun rôle/HBA/service/permission à modifier.

## Fichier soumis à approbation

/srv/dental-lab/migrations/0001_migration_engine_probe.sql —395octets, UID1002/mode600/un lien.
SHA256 **a40fcba1147515f7b9dd4eeceb37e876b4ec032f9d4254f5f80c3495524d1413**.

Deux SELECT : marqueur technique et identités ; assertion du verrou advisory déjà pris par le préambule du lanceur. Aucune création/modification de table, séquence, données, rôles ou schéma. Si le verrou attendu manque, division par zéro et état pending à résoudre humainement. Les trois fixtures2.6 restent inchangées et ne sont PAS invoquées.

Cette revue doit approuver explicitement le fichier/SHA et le premier passage, le refus de rejeu et le test flock ci-dessous. Les commandes sont destinées à l’administrateur ; l’IA ne les exécute pas. Les scripts projet sont uniquement relus, jamais exécutés comme root.

Chaque bloc Bash arrête sur un code non nul ; ne pas poursuivre après un contrôle échoué. Les refus attendus sont capturés et vérifiés dans le bloc Python, sans désactiver cet arrêt. Les audits PostgreSQL utilisent un environnement vide et une identité explicite, sans variables PG héritées.

## 1. Contrôles préalables en lecture seule, administrateur

```bash
set -euo pipefail
test "$(id -u)" = 0
printf '%s  %s\n' \
 698472ebcc0ca0f8a1d74151cb7331ecfa9e113d8231f9262b3ba6f535de9ea1 \
 /usr/local/sbin/dental-lab-migrate | /usr/bin/sha256sum -c -
/usr/bin/stat -c '%U:%G %a %h %n' /usr/local/sbin/dental-lab-migrate
printf '%s  %s\n' \
 a40fcba1147515f7b9dd4eeceb37e876b4ec032f9d4254f5f80c3495524d1413 \
 /srv/dental-lab/migrations/0001_migration_engine_probe.sql | \
 /usr/sbin/runuser -u dental-ai -- /usr/bin/sha256sum -c -
/usr/sbin/runuser -u dental-ai -- /usr/bin/cat \
 /srv/dental-lab/migrations/0001_migration_engine_probe.sql
/usr/bin/python3 -I - <<'PY'
from pathlib import Path
base=Path('/var/lib/dental-lab-migrations/receipts')
assert not any(p.name.endswith('.pending') for p in base.iterdir())
for suffix in ['', '.pending', '.rollback-verified']:
    assert not (base/('0001_migration_engine_probe.sql'+suffix)).exists()
print('No pending and new version absent')
PY
/usr/sbin/runuser -u postgres -- /usr/bin/env -i \
 PATH=/usr/bin:/bin HOME=/ LANG=C.UTF-8 \
 /usr/lib/postgresql/17/bin/psql -X -w -U postgres \
 -h /var/run/postgresql -p 5432 -d dental_lab -P pager=off -v ON_ERROR_STOP=1 <<'SQL'
BEGIN READ ONLY;
SELECT rolname,rolcanlogin FROM pg_roles WHERE rolname='dental-migrate';
SELECT count(*) AS sessions FROM pg_stat_activity WHERE usename='dental-migrate';
SELECT count(*) AS application_tables FROM pg_class c
JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname<>'information_schema' AND c.relkind IN ('r','p');
COMMIT;
SQL
```

Attendus : empreintesexactes, root:root555/un lien, no pending/versionabsente, migrateurNOLOGIN/session0, tablesapp0. STOP sinon ; ne pas nettoyer pour contourner. Lire le source comme dental-ai évite tout accès root suivant un éventuel lien projet vers un secret.

## 2. Premier passage, seulement après approbation explicite

```bash
set -euo pipefail
/usr/local/sbin/dental-lab-migrate 0001_migration_engine_probe.sql \
 a40fcba1147515f7b9dd4eeceb37e876b4ec032f9d4254f5f80c3495524d1413
```

Attendu code0, marker migration_engine_v1, dental_lab/dental-migrate/dental_lab_migrator,
transaction_lock_ok=1 et Succès contrôlé avec SHA exact. Pas de donnée métier créée.
Impact durable : snapshot SQL root + reçu dans le registre2.6, version jamais rejouable.
L’unité transitoire de migration existante est utilisée par le lanceur ; aucun service de production créé/démarré/redémarré.

## 3. Refus de rejeu et verrou opérateur sur installation réelle

Bloc Python littéral contrôlé, pas un fichier projet exécuté root. Il vérifie le reçu et le snapshot avant tests et n’altère aucun reçu. Le même fichier est invoqué seulement pour prouver le refus AVANT SQL/LOGIN ; cette approbation n’autorise pas un deuxième passage SQL.

```bash
set -euo pipefail
/usr/bin/python3 -I - <<'PY'
import fcntl,hashlib,json,os,stat,subprocess
from pathlib import Path
assert os.geteuid()==0
launcher=Path('/usr/local/sbin/dental-lab-migrate')
assert hashlib.sha256(launcher.read_bytes()).hexdigest()=='698472ebcc0ca0f8a1d74151cb7331ecfa9e113d8231f9262b3ba6f535de9ea1'
base=Path('/var/lib/dental-lab-migrations')
version='0001_migration_engine_probe.sql'
sha='a40fcba1147515f7b9dd4eeceb37e876b4ec032f9d4254f5f80c3495524d1413'
receipt=base/'receipts'/version
st=receipt.lstat()
assert stat.S_ISREG(st.st_mode) and st.st_uid==0 and st.st_nlink==1 and not st.st_mode&0o077
before=receipt.read_bytes()
record=json.loads(before)
assert record['version']==version and record['sha256']==sha
snapshot=Path(record['snapshot'])
assert snapshot.is_absolute() and snapshot.name==version
assert snapshot.resolve().is_relative_to(base.resolve()) and not snapshot.is_symlink()
assert hashlib.sha256(snapshot.read_bytes()).hexdigest()==sha
assert not any(p.name.endswith('.pending') for p in receipt.parent.iterdir())
command=[str(launcher),version,sha]
env={'PATH':'/usr/bin:/bin','HOME':'/','LANG':'C.UTF-8'}

result=subprocess.run(command,env=env,cwd='/',stdin=subprocess.DEVNULL,
                      capture_output=True,text=True)
assert result.returncode!=0 and 'Version exécutée ou état incertain' in result.stdout+result.stderr
assert receipt.read_bytes()==before
print('Replay rejected before SQL; receipt unchanged')

fd=os.open(base/'operator.lock',os.O_RDWR|os.O_NOFOLLOW|os.O_NONBLOCK)
try:
    st=os.fstat(fd)
    assert stat.S_ISREG(st.st_mode) and st.st_uid==0 and st.st_nlink==1 and not st.st_mode&0o077
    fcntl.flock(fd,fcntl.LOCK_EX|fcntl.LOCK_NB)
    result=subprocess.run(command,env=env,cwd='/',stdin=subprocess.DEVNULL,
                          capture_output=True,text=True)
    assert result.returncode!=0 and 'BlockingIOError' in result.stderr
    assert receipt.read_bytes()==before
    print('Concurrent operator rejected before source/SQL; receipt unchanged')
finally:
    os.close(fd)
assert not any(p.name.endswith('.pending') for p in receipt.parent.iterdir())
print('Receipt/snapshot SHA verified; no pending')
PY
```

Le sous-processus bénéficie des limites du lanceur existant si un défaut l’amenait à l’exécution ; aucune interruption automatique supplémentaire ne masque un état incertain. Si verrou déjà détenu par un autre opérateur : STOP et attendre la fin contrôlée, pas de suppression de lock. Ne pas transmettre les chemins internes/unités si inutiles au rapport.

## 4. Contrôles finaux administrateur, lecture seule

```bash
set -euo pipefail
/usr/sbin/runuser -u postgres -- /usr/bin/env -i \
 PATH=/usr/bin:/bin HOME=/ LANG=C.UTF-8 \
 /usr/lib/postgresql/17/bin/psql -X -w -U postgres \
 -h /var/run/postgresql -p 5432 -d dental_lab -P pager=off -v ON_ERROR_STOP=1 <<'SQL'
BEGIN READ ONLY;
SELECT rolname,rolcanlogin FROM pg_roles WHERE rolname='dental-migrate';
SELECT count(*) AS sessions FROM pg_stat_activity WHERE usename='dental-migrate';
SELECT count(*) AS application_tables FROM pg_class c
JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname<>'information_schema' AND c.relkind IN ('r','p');
SELECT count(*) AS migration_locks FROM pg_locks l
JOIN pg_stat_activity a ON a.pid=l.pid
WHERE a.usename='dental-migrate' AND a.datname='dental_lab' AND l.locktype='advisory';
COMMIT;
SQL
printf '%s  %s\n' \
 698472ebcc0ca0f8a1d74151cb7331ecfa9e113d8231f9262b3ba6f535de9ea1 \
 /usr/local/sbin/dental-lab-migrate | /usr/bin/sha256sum -c -
```

Attendus : NOLOGIN/sessions0/tablesapp0/locks0, SHA installé inchangé.
Rapportminimal attendu : approbation SQL/SHA, premier passagecode0 et verrou1, reçu/snapshotSHAexact,
refusrejeu/refusconcurrence avec motifs corrects et reçu inchangé, aucunpending, fermeture.
Aucun accès voisin, changement HBA/rôle/runtime, fixturehistorique rejouée ou donnée médicale.

## Échec / retour arrière

Pas de rollback SQL métier pour cette sonde SELECT : aucun objet modifié. Ne pas supprimer son reçu ou snapshot pour refaire le test ; ils font partie de l’historique. Si pending ou rôle/session non fermés, STOP et appliquer la procédure de diagnostic2.6/MIGRATIONS.md avec l’unité exacte, sans arrêt global. Résolution humaine du registre après preuve que seuls ces SELECT approuvés ont tourné ; aucune archive/renommage automatique proposé. Si un contrôle annonce un SQL exécuté une deuxième fois, conserver les preuves et arrêter : ne pas marquer6.2 validé.

Les preuves réelles2.6 de DDL/DML transactionnel réussi et rollback22012 restent valables pour le même SHA, sans réexécution. Ces tests6.2 ajoutent historique/rejeu/verrous. Réception sur la seule base dédiée dental_lab, actuellement sans tableapp ; elle reste dans un cluster/VPS partagé. Pas d’isolation complète ni de readinessproduction.

Statut :6.2 préparation et11tests nouveaux +18tests2.6 hors ligne disponibles ; réception administrateur NON REÇUE. Ne pas commencer6.3 avant validation réelle.
