# Chapitre6 — Dossier de réception consolidée, NON EXÉCUTÉ

## États séparés et ordre

6.1–6.3 réceptionnés selon rapports et suivi. 6.4/0003 APPLIQUÉE, recette finale enattente. 6.5–6.11 implémentation préparée/validations horsligne réussies, migrations0004–0010 NON APPLIQUÉES. Aucun succès SQL des nouveaux tests annoncé. Lancer chaque étape seulement après approbation de son fichier/SHA et de sa recette, puis contrôler résultat avant suivante. Aucun script de migration en lot.

D'abord POINT_6_4_ADMIN.md phases3et4 seulement :15refus/préservationhistorique/ROLLBACK/audit/reçu/snapshot. NE PAS lancer phases1/2 obsolètes ni rejouer0003. Ensuite0004→0005→0006→0007→0008→0009→0010, recette et audit aprèschaque. Enfin testspeer etdeuxcoursesréelles.

| Point | Migration à approuver | SHA-256 | Recette à approuver | SHA-256 |
|---|---|---|---|---|
| 6.5 | 0004_orders_versions.sql | 4f4ce930b1422394e410ba5f9c3ee0ab90ce593718cfcf350f0c6c24a736c395 | orders_constraints.sql | 959891f4413f720f9db62e9476db83350710d621b5342ec28e4a4b5c133bd60a |
| 6.6 | 0005_requests_linked_works.sql | facd59495b8c8778f0a105a7b26e9253642afe8dbe64eaa07f570de0c800b61b | linked_constraints.sql | 6f1aeacec743fc97c811cdd222e29d52e1e12f3b1127273256f2f35739c2d975 |
| 6.7 | 0006_files_uploads.sql | 1d0a45256b7921d6e0198991fdc1c5f38fb16446c31ed9cfe81ed433a681b65f | files_constraints.sql | 2f605500259559f5148feb56a26d7827f1447be036bd0206ead0a842f05898eb |
| 6.8 | 0007_messaging_reads.sql | a0b4001b05d963cf64171f7093b2e663bae37497ce6b41304fc96da298d38c08 | messaging_constraints.sql | 1d810462bc483a3db7239517b778f76a3bddeab2b9c3b4f37ccd70c72a2134c5 |
| 6.9 | 0008_events_notifications_audit.sql | 118d11a1c0608e7e1a19c26c2b1d143d3ce8fcd2e4304f7fc9597876fc28f54c | events_constraints.sql | 019e45f1d83ffb4e9a0c4ce64dd78b742d58b7340b4752a689fdea96c02a8c61 |
| 6.10 | 0009_drafts_conflicts.sql | ddec9bd1d7b27a625d6fbab87580d97fc1ffae888225caa6103fa51508588d21 | drafts_constraints.sql | e0723e1ea0a8a8ed92559b3a275a9f1bbb187267939606e370efc34842391605 |
| 6.11 | 0010_application_table_privileges.sql | 32889ead7b3c9db974835fa2efd0394d93593e1c8d287807fb9205f661e3c64b | privileges_constraints.sql | 267a95afd402d70932a1f60eef4518fa76eca79e95ba2afb432bda5c08690449 |

LesSQL de migration sontprivés600/liensuniques sousdental-ai. Lanceurroot555 SHA698472ebcc0ca0f8a1d74151cb7331ecfa9e113d8231f9262b3ba6f535de9ea1 inchangé. 0010 change uniquementACLapp explicites :approbation de permissions nécessaire, jamaispermissionsIA. Aucunsecret/HBA/service/compte/installationruntime modifié. DDL etGRANT durables : arrêt surerreur,pasDROP/rejeu/resetsequence/cascade/effacementreceipts. Si retour nécessaire, nouvelle migrationcorrective précise à approuver aprèsauditACL, sansannulerR19 ni effets d'autrespoints.

## Précontrôle exact, une version à la fois

Bloc littéral administrateur, nepasexécuter unprogrammeéditableduprojet root. Choisir uniquement la version déjàexplicitementapprouvée. Ilcontrôlele fichier source sousUID1002, le registre/snapshotprécédent etschémaréel ; arrêt àtoutedivergence.

```bash
set -euo pipefail
test "$(id -u)" = 0
/usr/bin/python3 -I - <<'PY'
import hashlib,json,os,stat,subprocess
from pathlib import Path
assert os.geteuid()==0
env={'PATH':'/usr/bin:/bin','HOME':'/','LANG':'C.UTF-8'}
base=Path('/var/lib/dental-lab-migrations')
launcher=Path('/usr/local/sbin/dental-lab-migrate')
s=launcher.lstat()
assert stat.S_ISREG(s.st_mode) and s.st_uid==0 and s.st_gid==0 and stat.S_IMODE(s.st_mode)==0o555 and s.st_nlink==1
assert hashlib.sha256(launcher.read_bytes()).hexdigest()=='698472ebcc0ca0f8a1d74151cb7331ecfa9e113d8231f9262b3ba6f535de9ea1'
version='0004_orders_versions.sql'  # Revoir/modifier seulement pour une version approuvée.
records=[{'point': '6.5', 'version': '0004_orders_versions.sql', 'sha': '4f4ce930b1422394e410ba5f9c3ee0ab90ce593718cfcf350f0c6c24a736c395', 'test': 'orders_constraints.sql', 'test_sha': '959891f4413f720f9db62e9476db83350710d621b5342ec28e4a4b5c133bd60a', 'objects': ['orders', 'order_versions', 'order_version_teeth', 'order_logistics', 'order_status_events', 'order_logistics_events', 'order_security_blocks', 'submission_receipts']}, {'point': '6.6', 'version': '0005_requests_linked_works.sql', 'sha': 'facd59495b8c8778f0a105a7b26e9253642afe8dbe64eaa07f570de0c800b61b', 'test': 'linked_constraints.sql', 'test_sha': '6f1aeacec743fc97c811cdd222e29d52e1e12f3b1127273256f2f35739c2d975', 'objects': ['order_requests', 'work_links', 'active_retouch_slots']}, {'point': '6.7', 'version': '0006_files_uploads.sql', 'sha': '1d0a45256b7921d6e0198991fdc1c5f38fb16446c31ed9cfe81ed433a681b65f', 'test': 'files_constraints.sql', 'test_sha': '2f605500259559f5148feb56a26d7827f1447be036bd0206ead0a842f05898eb', 'objects': ['file_objects', 'upload_sessions', 'upload_chunks', 'order_version_files', 'order_followup_files', 'file_derivatives', 'file_events']}, {'point': '6.8', 'version': '0007_messaging_reads.sql', 'sha': 'a0b4001b05d963cf64171f7093b2e663bae37497ce6b41304fc96da298d38c08', 'test': 'messaging_constraints.sql', 'test_sha': '1d810462bc483a3db7239517b778f76a3bddeab2b9c3b4f37ccd70c72a2134c5', 'objects': ['conversations', 'messages', 'message_versions', 'message_version_files', 'conversation_reads', 'message_reminder_cycles']}, {'point': '6.9', 'version': '0008_events_notifications_audit.sql', 'sha': '118d11a1c0608e7e1a19c26c2b1d143d3ce8fcd2e4304f7fc9597876fc28f54c', 'test': 'events_constraints.sql', 'test_sha': '019e45f1d83ffb4e9a0c4ce64dd78b742d58b7340b4752a689fdea96c02a8c61', 'objects': ['outbox_events', 'outbox_dispatches', 'internal_notifications', 'email_category_recipients', 'notification_deliveries', 'notification_attempts', 'audit_events']}, {'point': '6.10', 'version': '0009_drafts_conflicts.sql', 'sha': 'ddec9bd1d7b27a625d6fbab87580d97fc1ffae888225caa6103fa51508588d21', 'test': 'drafts_constraints.sql', 'test_sha': 'e0723e1ea0a8a8ed92559b3a275a9f1bbb187267939606e370efc34842391605', 'objects': ['drafts', 'draft_revisions', 'draft_revision_files', 'draft_sync_receipts', 'draft_conflicts']}, {'point': '6.11', 'version': '0010_application_table_privileges.sql', 'sha': '32889ead7b3c9db974835fa2efd0394d93593e1c8d287807fb9205f661e3c64b', 'test': 'privileges_constraints.sql', 'test_sha': '267a95afd402d70932a1f60eef4518fa76eca79e95ba2afb432bda5c08690449', 'objects': []}]
selected=next(r for r in records if r['version']==version)
index=records.index(selected)
previous=records[index-1] if index else {'version':'0003_catalog_snapshots.sql','sha':'9118fd82740fb914b69fd79946bebca1ca0c1b32b679709b48217edec7df7c5c'}
assert not any(p.name.endswith('.pending') for p in (base/'receipts').iterdir())
assert not (base/'receipts'/version).exists() and not (base/'receipts'/(version+'.rollback-verified')).exists()
prior=json.loads((base/'receipts'/previous['version']).read_bytes())
assert prior['version']==previous['version'] and prior['sha256']==previous['sha']
p=Path(prior['snapshot'])
assert p.is_absolute() and p.name==previous['version'] and not p.is_symlink()
assert p.resolve().is_relative_to(base/'snapshots') and hashlib.sha256(p.read_bytes()).hexdigest()==previous['sha']
reader="""import os,stat,sys
d=os.open('/srv/dental-lab',os.O_DIRECTORY|os.O_NOFOLLOW)
n=os.open('migrations',os.O_DIRECTORY|os.O_NOFOLLOW,dir_fd=d);os.close(d)
f=os.open(sys.argv[1],os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK,dir_fd=n)
s=os.fstat(f)
assert stat.S_ISREG(s.st_mode) and s.st_uid==1002 and s.st_nlink==1 and not s.st_mode&0o077 and 0<s.st_size<65536
data=b''
while len(data)<=65536:
 c=os.read(f,min(4096,65537-len(data)))
 if not c:break
 data+=c
assert 0<len(data)<65536
sys.stdout.buffer.write(data)
"""
data=subprocess.run(['/usr/sbin/runuser','-u','dental-ai','--','/usr/bin/python3','-I','-c',reader,version],env=env,cwd='/',stdin=subprocess.DEVNULL,capture_output=True,check=True,timeout=10).stdout
assert hashlib.sha256(data).hexdigest()==selected['sha']
expected_tables=[12,20,22,29,35,42,47][index]
expected_views=[2,2,3,3,3,3,3][index]
absent=' AND '.join("to_regclass('public."+name+"') IS NULL" for name in selected['objects']) or 'true'
query=f"BEGIN READ ONLY; SELECT 1/CASE WHEN current_database()='dental_lab' AND current_setting('server_version_num')::integer/10000=17 AND (SELECT count(*) FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='r')={expected_tables} AND (SELECT count(*) FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='v')={expected_views} AND NOT EXISTS(SELECT 1 FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind IN ('r','v') AND pg_get_userbyid(relowner)<>'dental_lab_migrator') AND NOT EXISTS(SELECT 1 FROM pg_constraint WHERE connamespace='public'::regnamespace AND NOT convalidated) AND {absent} AND EXISTS(SELECT 1 FROM pg_roles WHERE rolname='dental-migrate' AND NOT rolcanlogin) AND NOT EXISTS(SELECT 1 FROM pg_stat_activity WHERE usename IN ('dental-migrate','dental-lab-runtime')) THEN 1 ELSE 0 END AS safe_baseline; COMMIT;"
subprocess.run(['/usr/sbin/runuser','-u','postgres','--','/usr/lib/postgresql/17/bin/psql','-X','-w','-U','postgres','-h','/var/run/postgresql','-p','5432','-d','dental_lab','-P','pager=off','-v','ON_ERROR_STOP=1','-c',query],env=env,cwd='/',check=True,timeout=15)
print('Preflight passed for',version,'only; no migration executed')
PY
```

## Applications individuelles et recettes

### 6.5

```bash
set -euo pipefail
test "$(id -u)" = 0
/usr/local/sbin/dental-lab-migrate 0004_orders_versions.sql \
 4f4ce930b1422394e410ba5f9c3ee0ab90ce593718cfcf350f0c6c24a736c395
```

Puis recette littérale de POINT_6_5_ADMIN.md, SHA de tableau contrôlé avant SQL. Arrêt si notice attendue/code0/ROLLBACK/reçu inchangé absent. Audit suivant obligatoire avant version suivante.

### 6.6

```bash
set -euo pipefail
test "$(id -u)" = 0
/usr/local/sbin/dental-lab-migrate 0005_requests_linked_works.sql \
 facd59495b8c8778f0a105a7b26e9253642afe8dbe64eaa07f570de0c800b61b
```

Puis recette littérale de POINT_6_6_ADMIN.md, SHA de tableau contrôlé avant SQL. Arrêt si notice attendue/code0/ROLLBACK/reçu inchangé absent. Audit suivant obligatoire avant version suivante.

### 6.7

```bash
set -euo pipefail
test "$(id -u)" = 0
/usr/local/sbin/dental-lab-migrate 0006_files_uploads.sql \
 1d0a45256b7921d6e0198991fdc1c5f38fb16446c31ed9cfe81ed433a681b65f
```

Puis recette littérale de POINT_6_7_ADMIN.md, SHA de tableau contrôlé avant SQL. Arrêt si notice attendue/code0/ROLLBACK/reçu inchangé absent. Audit suivant obligatoire avant version suivante.

### 6.8

```bash
set -euo pipefail
test "$(id -u)" = 0
/usr/local/sbin/dental-lab-migrate 0007_messaging_reads.sql \
 a0b4001b05d963cf64171f7093b2e663bae37497ce6b41304fc96da298d38c08
```

Puis recette littérale de POINT_6_8_ADMIN.md, SHA de tableau contrôlé avant SQL. Arrêt si notice attendue/code0/ROLLBACK/reçu inchangé absent. Audit suivant obligatoire avant version suivante.

### 6.9

```bash
set -euo pipefail
test "$(id -u)" = 0
/usr/local/sbin/dental-lab-migrate 0008_events_notifications_audit.sql \
 118d11a1c0608e7e1a19c26c2b1d143d3ce8fcd2e4304f7fc9597876fc28f54c
```

Puis recette littérale de POINT_6_9_ADMIN.md, SHA de tableau contrôlé avant SQL. Arrêt si notice attendue/code0/ROLLBACK/reçu inchangé absent. Audit suivant obligatoire avant version suivante.

### 6.10

```bash
set -euo pipefail
test "$(id -u)" = 0
/usr/local/sbin/dental-lab-migrate 0009_drafts_conflicts.sql \
 ddec9bd1d7b27a625d6fbab87580d97fc1ffae888225caa6103fa51508588d21
```

Puis recette littérale de POINT_6_10_ADMIN.md, SHA de tableau contrôlé avant SQL. Arrêt si notice attendue/code0/ROLLBACK/reçu inchangé absent. Audit suivant obligatoire avant version suivante.

### 6.11

```bash
set -euo pipefail
test "$(id -u)" = 0
/usr/local/sbin/dental-lab-migrate 0010_application_table_privileges.sql \
 32889ead7b3c9db974835fa2efd0394d93593e1c8d287807fb9205f661e3c64b
```

Puis recette littérale de POINT_6_11_ADMIN.md, SHA de tableau contrôlé avant SQL. Arrêt si notice attendue/code0/ROLLBACK/reçu inchangé absent. Audit suivant obligatoire avant version suivante.

## Audit exact après chaque migration/recette

Choisir version approuvée/applicable etobjetsproposés ci-dessus ; le bloc vérifie toutschéma actuel, pas desrésultats inventés de schémainstallé.

```bash
set -euo pipefail
test "$(id -u)" = 0
/usr/bin/python3 -I - <<'PY'
import hashlib,json,os,subprocess
from pathlib import Path
assert os.geteuid()==0
env={'PATH':'/usr/bin:/bin','HOME':'/','LANG':'C.UTF-8'}
base=Path('/var/lib/dental-lab-migrations')
records=[{'point': '6.5', 'version': '0004_orders_versions.sql', 'sha': '4f4ce930b1422394e410ba5f9c3ee0ab90ce593718cfcf350f0c6c24a736c395', 'test': 'orders_constraints.sql', 'test_sha': '959891f4413f720f9db62e9476db83350710d621b5342ec28e4a4b5c133bd60a', 'objects': ['orders', 'order_versions', 'order_version_teeth', 'order_logistics', 'order_status_events', 'order_logistics_events', 'order_security_blocks', 'submission_receipts']}, {'point': '6.6', 'version': '0005_requests_linked_works.sql', 'sha': 'facd59495b8c8778f0a105a7b26e9253642afe8dbe64eaa07f570de0c800b61b', 'test': 'linked_constraints.sql', 'test_sha': '6f1aeacec743fc97c811cdd222e29d52e1e12f3b1127273256f2f35739c2d975', 'objects': ['order_requests', 'work_links', 'active_retouch_slots']}, {'point': '6.7', 'version': '0006_files_uploads.sql', 'sha': '1d0a45256b7921d6e0198991fdc1c5f38fb16446c31ed9cfe81ed433a681b65f', 'test': 'files_constraints.sql', 'test_sha': '2f605500259559f5148feb56a26d7827f1447be036bd0206ead0a842f05898eb', 'objects': ['file_objects', 'upload_sessions', 'upload_chunks', 'order_version_files', 'order_followup_files', 'file_derivatives', 'file_events']}, {'point': '6.8', 'version': '0007_messaging_reads.sql', 'sha': 'a0b4001b05d963cf64171f7093b2e663bae37497ce6b41304fc96da298d38c08', 'test': 'messaging_constraints.sql', 'test_sha': '1d810462bc483a3db7239517b778f76a3bddeab2b9c3b4f37ccd70c72a2134c5', 'objects': ['conversations', 'messages', 'message_versions', 'message_version_files', 'conversation_reads', 'message_reminder_cycles']}, {'point': '6.9', 'version': '0008_events_notifications_audit.sql', 'sha': '118d11a1c0608e7e1a19c26c2b1d143d3ce8fcd2e4304f7fc9597876fc28f54c', 'test': 'events_constraints.sql', 'test_sha': '019e45f1d83ffb4e9a0c4ce64dd78b742d58b7340b4752a689fdea96c02a8c61', 'objects': ['outbox_events', 'outbox_dispatches', 'internal_notifications', 'email_category_recipients', 'notification_deliveries', 'notification_attempts', 'audit_events']}, {'point': '6.10', 'version': '0009_drafts_conflicts.sql', 'sha': 'ddec9bd1d7b27a625d6fbab87580d97fc1ffae888225caa6103fa51508588d21', 'test': 'drafts_constraints.sql', 'test_sha': 'e0723e1ea0a8a8ed92559b3a275a9f1bbb187267939606e370efc34842391605', 'objects': ['drafts', 'draft_revisions', 'draft_revision_files', 'draft_sync_receipts', 'draft_conflicts']}, {'point': '6.11', 'version': '0010_application_table_privileges.sql', 'sha': '32889ead7b3c9db974835fa2efd0394d93593e1c8d287807fb9205f661e3c64b', 'test': 'privileges_constraints.sql', 'test_sha': '267a95afd402d70932a1f60eef4518fa76eca79e95ba2afb432bda5c08690449', 'objects': []}]
version='0004_orders_versions.sql'
r=next(r for r in records if r['version']==version)
record=json.loads((base/'receipts'/version).read_bytes())
assert record['version']==version and record['sha256']==r['sha']
snapshot=Path(record['snapshot'])
assert snapshot.is_absolute() and snapshot.name==version and not snapshot.is_symlink() and snapshot.resolve().is_relative_to(base/'snapshots')
assert hashlib.sha256(snapshot.read_bytes()).hexdigest()==r['sha']
assert not any(p.name.endswith('.pending') for p in (base/'receipts').iterdir())
index=records.index(r)
expected_tables=[20,22,29,35,42,47,47][index]
expected_views=[2,3,3,3,3,3,3][index]
query=f"BEGIN READ ONLY; SELECT 1/CASE WHEN (SELECT count(*) FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='r')={expected_tables} AND (SELECT count(*) FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='v')={expected_views} AND NOT EXISTS(SELECT 1 FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind IN ('r','v') AND pg_get_userbyid(relowner)<>'dental_lab_migrator') THEN 1 ELSE 0 END AS applied_objects_owned;"+"""
SELECT c.relname,c.relkind,pg_get_userbyid(c.relowner) owner FROM pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relkind IN ('r','v') ORDER BY c.relname;
SELECT 1/CASE WHEN NOT EXISTS(SELECT 1 FROM pg_constraint WHERE connamespace='public'::regnamespace AND NOT convalidated) AND (SELECT count(*) FROM public.permission_definitions)=29 AND EXISTS(SELECT 1 FROM pg_roles WHERE rolname='dental-migrate' AND NOT rolcanlogin) AND NOT EXISTS(SELECT 1 FROM pg_stat_activity WHERE usename IN ('dental-migrate','dental-lab-runtime')) AND NOT EXISTS(SELECT 1 FROM pg_locks WHERE locktype='advisory' AND classid=0 AND objid=28467789 AND objsubid=1) THEN 1 ELSE 0 END AS constraints_permissions_closed;
DO $empty_check$ DECLARE t record; n bigint; BEGIN
 FOR t IN SELECT relname FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='r' AND relname<>'permission_definitions' LOOP
  EXECUTE format('SELECT count(*) FROM public.%I',t.relname) INTO n;
  IF n<>0 THEN RAISE EXCEPTION 'Fixture remains in %',t.relname; END IF;
 END LOOP;
END; $empty_check$;
SELECT rolname,rolcanlogin,rolsuper,rolcreatedb,rolcreaterole,rolbypassrls FROM pg_roles WHERE rolname IN ('dental-ai','dental-lab-runtime','dental-migrate');
SELECT c.relname,has_table_privilege('dental-ai',c.oid,'SELECT') audit_select,has_table_privilege('dental_lab_app',c.oid,'SELECT') app_select,has_table_privilege('dental_lab_app',c.oid,'TRUNCATE') app_truncate,has_any_column_privilege('dental_lab_app',c.oid,'UPDATE') app_any_update FROM pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relkind IN ('r','v') ORDER BY c.relname;
COMMIT;
"""
subprocess.run(['/usr/sbin/runuser','-u','postgres','--','/usr/lib/postgresql/17/bin/psql','-X','-w','-U','postgres','-h','/var/run/postgresql','-p','5432','-d','dental_lab','-P','pager=off','-v','ON_ERROR_STOP=1','-c',query],env=env,cwd='/',check=True,timeout=20)
print('Snapshot/receipt/empty-fixtures audit passed; compare ACL to approved matrix')
PY
```

Attendus ownershipmigrateur, contraintesvalidées,permissiondefs29/zérofixture, migrateurNOLOGIN/zérosessions/verrou/pending, reçu/snapshotSHAexact. AuditSELECTfalse toujours. AppSELECTfalse avant0010, puistrue surmatriceexplicite ; TRUNCATEfalse toujours, UPDATEseulementcolonnes approuvées. Legraphe métier/permissionUI/rétention/securityproduction ne sont pasvalidés parce contrôle.

## Client réel peer après0010

Reprendre seulement B5 clientpositif R19 (archiveprotégée déjàinstallée, nepasréinstaller). Aucun testcontre autrebase/service ; règlesconnexiondéjà réceptionnées R19.

```bash
set -euo pipefail
test "$(id -u)" = 0
/usr/bin/env -i PATH=/usr/bin:/bin UV_THREADPOOL_SIZE=1 \
 /usr/bin/timeout --signal=TERM --kill-after=3s 25s \
 /usr/sbin/runuser -u dental-lab-runtime -- \
 /usr/bin/node --v8-pool-size=1 --max-old-space-size=128 \
 /var/lib/dental-lab-client-test/release/scripts/database-probe.mjs
```

Attendu real_pg_client passed/code0. Confirmer hash/clientinstallé selon réceptionR19 avantlancement ; ceclient vérifie identités etprivilègesadministratifs, pas les nouvellesroutesmétier. Les17refus SQL sousSETLOCALROLE dans6.11 ne prouventpas l'authentificationpeer.

## Tests restant hors schéma

101refusSQL etcaspositifs attendus pour6.4–6.11 (15+15+11+12+11+11+9+17), tous NON exécutés IA. Recettes révisions/CAS/slots SQL ne prouventpas encoreIDOR/service/instructionsverrouillées/SSE/coffre/transfert/ZIP/antimalware/stockage/retention. Course réelle deuxsessions préparée dans CHAPTER_6_CONCURRENCY_ADMIN.md ci-joint, approbation spécifique supplémentaire etcleanupborne obligatoire. Aucun chapitre entièrementvalidé sans testsdifférés de sescritères.

Aucunproblèmemétierstructurant nouveau identifié. Paramètres capacité/TTL/fournisseurs/rétention légale/navigateurs restent leurs portes antérieures ; aucune valeurinventée. Runtime apptrusted doit filtrer toutesrequêtes/flux etownerseulaudit ; aucune isolationcomplète/réglementaireannoncée.

Complément obligatoire : CHAPTER_6_PEER_ADMIN.md vérifie véritable session peer/INSERTaudit annulé et7refusDDL/SETROLE/mutationshistoriques ; NON exécuté. CHAPTER_6_CONCURRENCY_ADMIN.md vérifie2coursesréelles avecfixturetemporairementengagéeetcleanupspécifique ; NON exécuté, approbationdistincte obligatoire. Les recettes locales restent101refus préparés, ne pasadditionner comme tests déjàréussis.
