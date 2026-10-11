# Chapitre6 — Concurrence PostgreSQL réelle, proposition NON EXÉCUTÉE

Prérequis : 0004–0010 appliquées, recettes SQL/ACL réussies, dental_lab vide de données métier, aucun runtime en activité, reçu/snapshot et lanceur conformes. Aucun rôle/HBA/service/voisin modifié.

**Approbation spécifique nécessaire :** les sessions doivent voir un parent commun ; la fixture fictive sera temporairement engagée puis nettoyée. Cette recette comporte des COMMIT, contrairement aux recettes DO avec ROLLBACK. Aucun effacement hors des IDs fictifs approuvés. Arrêt si base non vide ; ne jamais la vider pour faciliter le test. Les numéros peuvent avancer sans reset.

Les cinq fichiers SQL et SHA suivants nécessitent approbation (préparés, non exécutés) :

| Fichier dans tests/migrations | SHA-256 |
|---|---|
| concurrency_seed.sql | a16191c53500099e3b3450887485db5e114b89f68b60702f14fa74c46d9da060 |
| concurrency_request.sql | 81185eeaf62fad5c79e999bec8e7cb57013f86530a812eb07c8a2cc637810e8a |
| concurrency_retouch_a.sql | d5ebbc6f5a35a4f0816fe6c3fe930d2a795828f50f03fe32a4fd99a20943dda6 |
| concurrency_retouch_b.sql | add41d4c4132ef0679f3e0c59ca99951cb41811e7994b29a2141cfa681bcebef |
| concurrency_cleanup.sql | d826df59485a9de5e675a2a3f8108511468823cf8ae45b59982fcb3b50f5da8b |

Fixture : 4 ordres/versions, 3 comptes, 2 cliniques, 3 snapshots synthétiques ; aucun fichier binaire ou donnée réelle. Nettoyage borné et garde sur données inattendues. Deux courses indépendantes : demande pendante commune et retouche active/source. La seconde session doit être observée en attente Lock avant COMMIT de la première, puis échouer 23505 sur l'index exact. L'atomicité métier R14 et les routes restent à leurs recettes.

Bloc littéral administrateur à revoir : ne jamais exécuter un script projet root. Lecture SQL sous dental-ai avec SHA/NOFOLLOW ; operator.lock détenu. SQL sous rôles locaux app/migrateur, session_user reste postgres : ces tests ne prouvent pas l'authentification peer. Contrôleur et sessions bornés, nettoyage uniquement des processus créés.

```bash
set -euo pipefail
test "$(id -u)" = 0
/usr/bin/python3 -I - <<'PY'
import fcntl,hashlib,json,os,selectors,signal,stat,subprocess,time,uuid
from pathlib import Path
assert os.geteuid()==0
env={'PATH':'/usr/bin:/bin','HOME':'/','LANG':'C.UTF-8'}
base=Path('/var/lib/dental-lab-migrations')
expected={
 'concurrency_seed.sql':'a16191c53500099e3b3450887485db5e114b89f68b60702f14fa74c46d9da060',
 'concurrency_request.sql':'81185eeaf62fad5c79e999bec8e7cb57013f86530a812eb07c8a2cc637810e8a',
 'concurrency_retouch_a.sql':'d5ebbc6f5a35a4f0816fe6c3fe930d2a795828f50f03fe32a4fd99a20943dda6',
 'concurrency_retouch_b.sql':'add41d4c4132ef0679f3e0c59ca99951cb41811e7994b29a2141cfa681bcebef',
 'concurrency_cleanup.sql':'d826df59485a9de5e675a2a3f8108511468823cf8ae45b59982fcb3b50f5da8b'}
fd=os.open(base/'operator.lock',os.O_RDWR|os.O_NOFOLLOW|os.O_NONBLOCK)
st=os.fstat(fd)
assert stat.S_ISREG(st.st_mode) and st.st_uid==0 and st.st_nlink==1 and not st.st_mode&0o077
fcntl.flock(fd,fcntl.LOCK_EX|fcntl.LOCK_NB)
assert not any(p.name.endswith('.pending') for p in (base/'receipts').iterdir())
assert hashlib.sha256(Path('/usr/local/sbin/dental-lab-migrate').read_bytes()).hexdigest()=='698472ebcc0ca0f8a1d74151cb7331ecfa9e113d8231f9262b3ba6f535de9ea1'
receipt=base/'receipts'/'0010_application_table_privileges.sql'
before=receipt.read_bytes()
assert json.loads(before)['sha256']=='32889ead7b3c9db974835fa2efd0394d93593e1c8d287807fb9205f661e3c64b'
reader="""import os,stat,sys
d=os.open('/srv/dental-lab',os.O_DIRECTORY|os.O_NOFOLLOW)
for part in ['tests','migrations']:
 n=os.open(part,os.O_DIRECTORY|os.O_NOFOLLOW,dir_fd=d);os.close(d);d=n
f=os.open(sys.argv[1],os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK,dir_fd=d)
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
sql={}
for name,sha in expected.items():
 data=subprocess.run(['/usr/sbin/runuser','-u','dental-ai','--','/usr/bin/python3','-I','-c',reader,name],env=env,cwd='/',capture_output=True,check=True,timeout=10).stdout
 assert hashlib.sha256(data).hexdigest()==sha
 sql[name]=data.decode('utf-8')
args=['/usr/sbin/runuser','-u','postgres','--','/usr/lib/postgresql/17/bin/psql','-X','-w','-U','postgres','-h','/var/run/postgresql','-p','5432','-d','dental_lab','-q','-A','-t','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose']
def run(text):
 result=subprocess.run(args+['-f','-'],input=text,env=env,cwd='/',text=True,capture_output=True,timeout=15)
 assert result.returncode==0,'Approved SQL failed; inspect administrator evidence'
 return result
run("SELECT 1/CASE WHEN EXISTS(SELECT 1 FROM pg_roles WHERE rolname='dental-migrate' AND NOT rolcanlogin) AND NOT EXISTS(SELECT 1 FROM pg_stat_activity WHERE usename IN ('dental-migrate','dental-lab-runtime')) THEN 1 ELSE 0 END;")
backup=base/'admin-backup'
st=backup.lstat();assert stat.S_ISDIR(st.st_mode) and st.st_uid==0 and not st.st_mode&0o022
marker=backup/'chapter6-concurrency.in-progress.json'
assert not (backup/'chapter6-concurrency.completed.json').exists() and not (backup/'chapter6-concurrency.failed.json').exists()
markfd=os.open(marker,os.O_CREAT|os.O_EXCL|os.O_WRONLY|os.O_NOFOLLOW,0o600)
os.write(markfd,json.dumps({'state':'in_progress','approved_sql':expected}).encode());os.fsync(markfd);os.close(markfd)
seed_committed=False;checks=[];cleanup_ok=False
preamble="BEGIN;SET LOCAL lock_timeout='5s';SET LOCAL statement_timeout='10s';SET LOCAL idle_in_transaction_session_timeout='10s';"
def race(first,second,index):
 tag='dental-lab-race-'+uuid.uuid4().hex
 processes=[]
 try:
  a=subprocess.Popen(args+['-f','-'],env={**env,'PGAPPNAME':tag+'-a'},cwd='/',stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,start_new_session=True);processes.append(a)
  a.stdin.write(preamble+'SET LOCAL ROLE dental_lab_app;'+first+"SELECT 'RACE_READY';\n");a.stdin.flush()
  selector=selectors.DefaultSelector();selector.register(a.stdout,selectors.EVENT_READ)
  assert selector.select(5),'First test session did not become ready'
  assert a.stdout.readline().strip()=='RACE_READY';selector.close()
  b=subprocess.Popen(args+['-f','-'],env={**env,'PGAPPNAME':tag+'-b'},cwd='/',stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,start_new_session=True);processes.append(b)
  b.stdin.write(preamble+'SET LOCAL ROLE dental_lab_app;'+second+'COMMIT;\n');b.stdin.close();b.stdin=None
  deadline=time.monotonic()+4;blocked=False
  while time.monotonic()<deadline:
   result=run("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname='dental_lab' AND application_name='"+tag+"-b' AND wait_event_type='Lock' AND state='active');")
   if result.stdout.strip()=='t':blocked=True;break
   if b.poll() is not None:break
   time.sleep(0.1)
  assert blocked and a.poll() is None,'No actual simultaneous lock contention established'
  a.stdin.write('COMMIT;\n');a.stdin.close();a.stdin=None
  ao,ae=a.communicate(timeout=12);bo,be=b.communicate(timeout=12)
  assert a.returncode==0 and b.returncode!=0 and '23505' in be and index in be,'Unexpected concurrency result'
  checks.append({'index':index,'blocked_observed':True,'winner_exit':0,'loser_sqlstate':'23505'})
  print('Concurrency passed:',index)
 finally:
  for p in processes:
   if p.poll() is None:
    if p.stdin is not None:p.stdin.close();p.stdin=None
    try:p.wait(timeout=2)
    except subprocess.TimeoutExpired:
     os.killpg(p.pid,signal.SIGTERM)
     try:p.wait(timeout=2)
     except subprocess.TimeoutExpired:os.killpg(p.pid,signal.SIGKILL);p.wait(timeout=2)
try:
 run(preamble+'SET LOCAL ROLE dental_lab_migrator;'+sql['concurrency_seed.sql']+'COMMIT;')
 seed_committed=True
 race(sql['concurrency_request.sql'],sql['concurrency_request.sql'],'order_requests_one_pending_idx')
 race(sql['concurrency_retouch_a.sql'],sql['concurrency_retouch_b.sql'],'work_links_one_active_retouch_idx')
finally:
 if seed_committed:
  run(preamble+'SET LOCAL ROLE dental_lab_migrator;'+sql['concurrency_cleanup.sql']+'COMMIT;')
  cleanup_ok=True
 assert receipt.read_bytes()==before and not any(p.name.endswith('.pending') for p in (base/'receipts').iterdir())
 state='completed' if len(checks)==2 and cleanup_ok else 'failed'
 marker.write_text(json.dumps({'state':state,'approved_sql':expected,'checks':checks,'cleanup_ok':cleanup_ok},indent=2)+'\n')
 marker.rename(backup/('chapter6-concurrency.'+state+'.json'))
 os.close(fd)
assert len(checks)==2 and cleanup_ok
print('Two concurrency cases passed; fictitious fixture cleaned; receipt unchanged')
PY
```

Après : audit final vide/contraintes/NOLOGIN/sessions/verrous/reçu-snapshot de CHAPTER_6_RECEPTION.md obligatoire. Rapport protégé concurrency.completed.json seulement si deux cas et nettoyage réussis. Si échec/interruption, inspecter failed/in-progress et l'état réel ; aucun rejeu automatique de seed ni effacement du registre. Un COMMIT de seed peut rester ambigu si interruption avant acquittement : contrôle humain puis nettoyage approuvé après reconnaissance des fixtures. SIGKILL peut laisser données fictives et marqueur ; aucune garantie contraire.

Le fichier cleanup est autorisé uniquement pour ces données fictives. Aucun droit permanent IA/runtime de purge historique/patients. Aucun service arrêté ou redémarré. Cette procédure n'a pas été exécutée ; validation de syntaxe seulement.
