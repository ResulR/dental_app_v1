# Chapitre6 — Client peer réel après grants, NON EXÉCUTÉ

Prérequis0010/reçu/SHA, toutes recettes précédentes et matrice ACL conformes. Identité Linux/runtime/HBA installées et reçues R19, aucun changement autorisé ici. Bloc littéral sous administrateur : processus Node protégé R19 séparé, puis psql réellement sous dental-lab-runtime. Ne jamais exécuter un script projet root. Aucun accès autre base, TCP ou service voisin.

Approbation de cette procédure requise, notamment l'INSERT audit synthétique dans une transaction annulée. Pas de données réelles ; processus/application_name de test fixes, SQL minimal sans secrets ni fichiers. Ces tests vérifient DML/DDL/SET ROLE sous véritable session peer, contrairement à session_user postgres des recettes locales. Aucun secret/mot de passe nécessaire.

```bash
set -euo pipefail
test "$(id -u)" = 0
/usr/bin/python3 -I - <<'PY'
import fcntl,hashlib,json,os,stat,subprocess
from pathlib import Path
assert os.geteuid()==0
env={'PATH':'/usr/bin:/bin','HOME':'/','LANG':'C.UTF-8'}
base=Path('/var/lib/dental-lab-migrations')
fd=os.open(base/'operator.lock',os.O_RDWR|os.O_NOFOLLOW|os.O_NONBLOCK)
try:
 st=os.fstat(fd)
 assert stat.S_ISREG(st.st_mode) and st.st_uid==0 and st.st_nlink==1 and not st.st_mode&0o077
 fcntl.flock(fd,fcntl.LOCK_EX|fcntl.LOCK_NB)
 assert not any(p.name.endswith('.pending') for p in (base/'receipts').iterdir())
 record=json.loads((base/'receipts'/'0010_application_table_privileges.sql').read_bytes())
 assert record['version']=='0010_application_table_privileges.sql' and record['sha256']=='32889ead7b3c9db974835fa2efd0394d93593e1c8d287807fb9205f661e3c64b'
 assert hashlib.sha256(Path('/usr/local/sbin/dental-lab-migrate').read_bytes()).hexdigest()=='698472ebcc0ca0f8a1d74151cb7331ecfa9e113d8231f9262b3ba6f535de9ea1'
 args=['/usr/sbin/runuser','-u','dental-lab-runtime','--','/usr/lib/postgresql/17/bin/psql','-X','-w','-U','dental-lab-runtime','-h','/var/run/postgresql','-p','5432','-d','dental_lab','-q','-A','-t','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose']
 positive="""BEGIN;
 SET LOCAL lock_timeout='2s';SET LOCAL statement_timeout='5s';
 SELECT 1/CASE WHEN current_database()='dental_lab' AND current_user='dental-lab-runtime' AND session_user='dental-lab-runtime'
 AND NOT has_schema_privilege(current_user,'public','CREATE') AND NOT has_database_privilege(current_user,'dental_lab','TEMP')
 AND NOT pg_has_role(current_user,'dental_lab_migrator','MEMBER') AND NOT pg_has_role(current_user,'dental_lab_owner','MEMBER')
 AND (SELECT count(*) FROM public.accounts)=0 AND (SELECT count(*) FROM public.audit_events)=0 THEN 1 ELSE 0 END;
 INSERT INTO public.audit_events(process_code,action,object_type,object_id,request_id)
 VALUES('fixture_peer','TECHNICAL_PROBE','process','e0000000-0000-4000-8000-000000000001','e0000000-0000-4000-8000-000000000002');
 SELECT 1/CASE WHEN (SELECT count(*) FROM public.audit_events WHERE process_code='fixture_peer')=1 THEN 1 ELSE 0 END;
 ROLLBACK;
 """
 r=subprocess.run(args+['-f','-'],input=positive,env=env,cwd='/',text=True,capture_output=True,timeout=12)
 assert r.returncode==0 and r.stdout.strip().splitlines()==['1','1'],'Real peer positive test failed'
 negatives=[
  "UPDATE public.audit_events SET action='TECHNICAL_PROBE'",
  "DELETE FROM public.audit_events",
  "TRUNCATE public.audit_events",
  "CREATE TABLE public.peer_denied_probe(id integer)",
  "CREATE TEMP TABLE peer_denied_temp(id integer)",
  "SET ROLE dental_lab_owner",
  "SET ROLE dental_lab_migrator"]
 for statement in negatives:
  r=subprocess.run(args+['-f','-'],input="BEGIN;SET LOCAL lock_timeout='2s';SET LOCAL statement_timeout='5s';"+statement+";ROLLBACK;",env=env,cwd='/',text=True,capture_output=True,timeout=12)
  assert r.returncode!=0 and '42501' in r.stderr,'Real peer negative test did not refuse as expected'
 print('Real peer DML/identity positive; 7 refusals SQLSTATE42501; no widening of administrative privileges')
finally:
 os.close(fd)
PY
```

Puis audit final consolidé : aucun objet peer_denied_probe/temp, aucune ligne fixture_peer, tables vides, sessions runtime/migrateur0, migrateurNOLOGIN, aucun verrou/pending, reçu/snapshot inchangés. Sur résultat inattendu, arrêt et audit ; pas de modification des grants/roles pour faire passer. Le client Node protégé est également vérifié via commande R19 citée dans CHAPTER_6_RECEPTION.md. Toute lecture/purge métier réelle reste hors périmètre.
