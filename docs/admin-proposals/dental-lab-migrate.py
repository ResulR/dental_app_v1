#!/usr/bin/python3 -I
"""PROPOSITION v3 : contrôle root protégé, SQL sous dental-migrate uniquement."""
import hashlib
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import fcntl
import json
import signal
import stat
import uuid
from contextlib import nullcontext

BASE = Path('/var/lib/dental-lab-migrations')
PSQL = '/usr/lib/postgresql/17/bin/psql'
ENV = {'PATH': '/usr/bin:/bin', 'HOME': '/', 'LANG': 'C.UTF-8'}
VERSION = r'[0-9]{4}_[a-z0-9_]{1,64}\.sql'
INSTALLED = Path('/usr/local/sbin/dental-lab-migrate')
IDENTITY = """SELECT 1 / CASE WHEN current_database() = 'dental_lab'
 AND session_user = 'dental-migrate' AND current_user = 'dental_lab_migrator'
 AND current_setting('server_version_num')::int / 10000 = 17
 THEN 1 ELSE 0 END;"""
PREAMBLE = """SET LOCAL ROLE dental_lab_migrator;
SET LOCAL search_path = pg_catalog, public;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '5min';
SET LOCAL idle_in_transaction_session_timeout = '30s';
SELECT pg_advisory_xact_lock(28467789);
""" + IDENTITY


def migration_psql_args(snapshot):
    # -1 exige -c/-f ; aucun SQL reçu sur stdin, aucune méta-commande wrapper.
    return [PSQL, '-X', '-w', '-h', '/var/run/postgresql', '-p', '5432',
            '-U', 'dental-migrate', '-d', 'dental_lab', '-P', 'pager=off',
            '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=sqlstate', '--single-transaction',
            '-c', PREAMBLE, '-f', str(snapshot), '-c', IDENTITY]


def protected(path, directory=False):
    st = path.lstat()
    correct_type = stat.S_ISDIR(st.st_mode) if directory else stat.S_ISREG(st.st_mode)
    if not correct_type or st.st_uid != 0 or st.st_mode & 0o022:
        raise ValueError('Chemin de contrôle non protégé : ' + str(path))


def protected_tree(path):
    for ancestor in reversed([path, *path.parents]):
        protected(ancestor, directory=True)


def interrupted(signum, frame):
    raise InterruptedError('Interruption : état incertain, conserver pending')


def validate_case_end(sql):
    """END non cité autorisé uniquement s'il ferme un CASE de la même instruction.

    Analyse lexicale ciblée, pas un parseur SQL général ni un sandbox.
    Chaînes, identifiants cités et commentaires ne peuvent ouvrir un faux CASE.
    """
    i, depth, n = 0, 0, len(sql)
    while i < n:
        if sql.startswith('--', i):
            end = re.compile(r'[\r\n]').search(sql, i + 2)
            i = n if end is None else end.end()
            continue
        if sql.startswith('/*', i):
            comments = 1
            i += 2
            while i < n and comments:
                if sql.startswith('/*', i):
                    comments += 1; i += 2
                elif sql.startswith('*/', i):
                    comments -= 1; i += 2
                else:
                    i += 1
            if comments:
                raise ValueError('Commentaire SQL non fermé')
            continue
        if sql[i] in ('\'', '"'):
            quote = sql[i]
            i += 1
            while i < n:
                if sql[i] == quote:
                    if i + 1 < n and sql[i + 1] == quote:
                        i += 2
                        continue
                    i += 1
                    break
                i += 1
            else:
                raise ValueError('Citation SQL non fermée')
            continue
        if sql[i] == '$':
            match = re.compile(r'\$(?:[A-Za-z_][A-Za-z_0-9]*)?\$').match(sql, i)
            if match:
                delimiter = match.group(0)
                end = sql.find(delimiter, i + len(delimiter))
                if end < 0:
                    raise ValueError('Chaîne dollar non fermée')
                i = end + len(delimiter)
                continue
            raise ValueError('Syntaxe dollar non prise en charge')
        if sql[i].isalpha() or sql[i] == '_' or ord(sql[i]) >= 128:
            start = i
            i += 1
            while i < n and (sql[i].isalnum() or sql[i] in '_$' or ord(sql[i]) >= 128):
                i += 1
            token = sql[start:i].upper()
            if token == 'CASE':
                depth += 1
            elif token == 'END':
                if depth == 0:
                    raise ValueError('END transactionnel interdit')
                depth -= 1
            continue
        if sql[i] == ';' and depth:
            raise ValueError('CASE non fermé avant la fin de l’instruction')
        i += 1
    if depth:
        raise ValueError('CASE non fermé')


def validate(version, expected, data):
    if not re.fullmatch(VERSION, version):
        raise ValueError('Version interdite')
    if not re.fullmatch(r'[a-f0-9]{64}', expected):
        raise ValueError('SHA256 invalide')
    if not 0 < len(data) <= 1048576:
        raise ValueError('Taille SQL interdite')
    if hashlib.sha256(data).hexdigest() != expected:
        raise ValueError('SHA256 différent du SQL approuvé')
    sql = data.decode('utf-8')
    if not sql.strip() or '\x00' in sql or '\\' in sql or '\ufeff' in sql:
        raise ValueError('SQL vide, NUL, antislash ou BOM interdit')
    # Filtre volontairement conservateur, y compris dans commentaires/chaînes.
    # Ce filtre ne remplace PAS la revue humaine et ne constitue pas un sandbox SQL.
    if re.search(r'\b(BEGIN|START|COMMIT|ROLLBACK|ABORT|SAVEPOINT|RELEASE|PREPARE|DISCARD|RESET|SET|SET_CONFIG|NEXTVAL|SETVAL|CALL|DO|COPY)\b', sql, re.I):
        raise ValueError('Contrôle de transaction/session ou effet interdit')
    validate_case_end(sql)


def admin(sql):
    if sql not in ADMIN_SQL:
        raise ValueError('Commande administrative non autorisée')
    subprocess.run(['/usr/sbin/runuser', '-u', 'postgres', '--', PSQL,
                    '-X', '-w', '-h', '/var/run/postgresql', '-p', '5432',
                    '-d', 'dental_lab', '-v', 'ON_ERROR_STOP=1', '-c', sql],
                   env=ENV, check=True, cwd='/', stdin=subprocess.DEVNULL, timeout=15)


PREFLIGHT = """DO $check$ BEGIN
 IF current_database() <> 'dental_lab' OR current_setting('server_version_num')::int / 10000 <> 17
 THEN RAISE EXCEPTION 'Destination inattendue'; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='dental-migrate'
  AND NOT rolcanlogin AND NOT rolinherit AND NOT rolsuper AND NOT rolcreatedb
  AND NOT rolcreaterole AND NOT rolreplication AND NOT rolbypassrls AND rolconnlimit=1)
 THEN RAISE EXCEPTION 'Identité au repos invalide'; END IF;
 IF (SELECT count(*) FROM pg_auth_members a JOIN pg_roles m ON m.oid=a.member
  WHERE m.rolname='dental-migrate') <> 1 OR NOT EXISTS
  (SELECT 1 FROM pg_auth_members a JOIN pg_roles m ON m.oid=a.member
   JOIN pg_roles r ON r.oid=a.roleid WHERE m.rolname='dental-migrate'
   AND r.rolname='dental_lab_migrator' AND NOT a.admin_option
   AND NOT a.inherit_option AND a.set_option)
 THEN RAISE EXCEPTION 'Appartenance inattendue'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='dental_lab_migrator'
  AND NOT rolcanlogin AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole
  AND NOT rolreplication AND NOT rolbypassrls)
 OR EXISTS(SELECT 1 FROM pg_auth_members a JOIN pg_roles m ON m.oid=a.member
  WHERE m.rolname='dental_lab_migrator')
 OR pg_has_role('dental-ai','dental_lab_migrator','MEMBER')
 OR pg_has_role('dental-ai','dental_lab_owner','MEMBER')
 THEN RAISE EXCEPTION 'Séparation des privilèges non conforme'; END IF;
 IF EXISTS (SELECT 1 FROM pg_stat_activity WHERE usename='dental-migrate')
 THEN RAISE EXCEPTION 'Session existante : audit humain requis'; END IF;
END $check$;"""
CLOSED = """DO $check$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='dental-migrate' AND rolcanlogin)
 OR EXISTS(SELECT 1 FROM pg_stat_activity WHERE usename='dental-migrate')
 THEN RAISE EXCEPTION 'Fermeture non démontrée : conserver pending'; END IF;
END $check$;"""
ADMIN_SQL = {PREFLIGHT, CLOSED, 'ALTER ROLE "dental-migrate" LOGIN;',
             'ALTER ROLE "dental-migrate" NOLOGIN;'}


def main():
    if os.geteuid() != 0:
        raise SystemExit('Invocation réservée à l’administrateur root')
    if len(sys.argv) != 3:
        raise SystemExit('Usage: dental-lab-migrate VERSION.sql SHA256')
    version, expected = sys.argv[1:]
    # Valider les arguments AVANT tout accès au fichier source.
    if not re.fullmatch(VERSION, version) or not re.fullmatch(r'[a-f0-9]{64}', expected):
        raise SystemExit('Arguments interdits')
    if Path(__file__).absolute() != INSTALLED:
        raise SystemExit('Exécuter uniquement la copie installée et approuvée')
    protected_tree(INSTALLED.parent)
    protected(INSTALLED)
    protected_tree(BASE)
    protected(BASE / 'receipts', directory=True)
    os.umask(0o077)
    lock_fd = os.open(BASE / 'operator.lock', os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW | os.O_NONBLOCK, 0o600)
    with os.fdopen(lock_fd, 'a') as lock:
        protected(BASE / 'operator.lock')
        if os.fstat(lock.fileno()).st_nlink != 1:
            raise ValueError('Verrou avec liens multiples interdit')
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        # Lecture bornée et sans symlink/FIFO, sous dental-ai uniquement.
        reader = """import os,stat,sys
d=os.open('/srv/dental-lab',os.O_DIRECTORY|os.O_NOFOLLOW)
m=os.open('migrations',os.O_DIRECTORY|os.O_NOFOLLOW,dir_fd=d)
f=os.open(sys.argv[1],os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK,dir_fd=m)
s=os.fstat(f)
if not stat.S_ISREG(s.st_mode) or s.st_uid!=1002 or s.st_nlink!=1 or s.st_mode&0o077 or s.st_size>1048576:
 raise SystemExit('Source non conforme')
data=b''
while len(data)<=1048576:
 chunk=os.read(f,min(65536,1048577-len(data)))
 if not chunk: break
 data+=chunk
if len(data)>1048576: raise SystemExit('Source trop grande')
sys.stdout.buffer.write(data)
"""
        data = subprocess.run(['/usr/sbin/runuser', '-u', 'dental-ai', '--',
                               '/usr/bin/python3', '-I', '-c', reader, version], env=ENV, cwd='/',
                              check=True, stdout=subprocess.PIPE, timeout=10).stdout
        validate(version, expected, data)
        # Registre root protégé : une version réussie n’est jamais rejouée.
        receipt = BASE / 'receipts' / version
        pending = BASE / 'receipts' / (version + '.pending')
        archived = BASE / 'receipts' / (version + '.rollback-verified')
        if (os.path.lexists(receipt) or os.path.lexists(pending) or os.path.lexists(archived)
                or any(p.name.endswith('.pending') for p in receipt.parent.iterdir())):
            raise SystemExit('Version exécutée ou état incertain : intervention humaine nécessaire')
        admin(PREFLIGHT)
        gid = __import__('grp').getgrnam('dental-migrate').gr_gid
        # Conserver les octets approuvés pour auditer un résultat incertain.
        # Pas de suppression automatique du snapshot, même après succès.
        with nullcontext(tempfile.mkdtemp(prefix='approved-', dir=BASE)) as folder:
            os.chown(folder, 0, gid)
            os.chmod(folder, 0o750)
            snapshot = Path(folder) / version
            with snapshot.open('xb') as target:
                target.write(data); target.flush()
                os.fchown(target.fileno(), 0, gid)
                os.fchmod(target.fileno(), 0o640)
                os.fsync(target.fileno())
            for directory in [Path(folder), BASE]:
                fd = os.open(directory, os.O_DIRECTORY | os.O_NOFOLLOW)
                os.fsync(fd)
                os.close(fd)
            # Seul ce SQL administratif littéral est exécuté comme postgres.
            # Le SQL de projet est TOUJOURS exécuté comme dental-migrate.
            unit = 'dental-lab-migration-' + uuid.uuid4().hex
            with pending.open('x') as marker:
                os.chmod(pending, 0o600)
                json.dump({'version': version, 'sha256': expected, 'unit': unit,
                           'snapshot': str(snapshot)}, marker)
                marker.write('\n')
                marker.flush()
                os.fsync(marker.fileno())
            directory_fd = os.open(pending.parent, os.O_DIRECTORY)
            os.fsync(directory_fd)
            os.close(directory_fd)
            signal.signal(signal.SIGTERM, interrupted)
            signal.signal(signal.SIGINT, interrupted)
            try:
                admin('ALTER ROLE "dental-migrate" LOGIN;')
                print('Unité dédiée :', unit, flush=True)
                subprocess.run(['/usr/bin/systemd-run', '--quiet', '--wait', '--pipe', '--collect',
                    '--unit=' + unit,
                    '-p', 'User=dental-migrate', '-p', 'Group=dental-migrate',
                    '-p', 'WorkingDirectory=/', '-p', 'NoNewPrivileges=yes',
                    '-p', 'CapabilityBoundingSet=', '-p', 'AmbientCapabilities=',
                    '-p', 'ProtectSystem=strict', '-p', 'ProtectHome=yes',
                    '-p', 'ProtectProc=invisible', '-p', 'PrivateTmp=yes',
                    '-p', 'PrivateDevices=yes', '-p', 'PrivateNetwork=yes',
                    '-p', 'RestrictAddressFamilies=AF_UNIX',
                    '-p', 'InaccessiblePaths=/srv /root',
                    '-p', 'MemoryMax=512M', '-p', 'CPUQuota=50%', '-p', 'TasksMax=64',
                    '-p', 'RuntimeMaxSec=6min', '-p', 'TimeoutStopSec=10s',
                    '/usr/bin/env', '-i', 'PATH=/usr/bin:/bin', 'HOME=/', 'LANG=C.UTF-8',
                    'PGCLIENTENCODING=UTF8', 'PGAPPNAME=' + unit,
                    *migration_psql_args(snapshot)],
                    stdin=subprocess.DEVNULL, env=ENV, cwd='/', check=True)
            finally:
                signal.signal(signal.SIGINT, signal.SIG_IGN)
                signal.signal(signal.SIGTERM, signal.SIG_IGN)
                admin('ALTER ROLE "dental-migrate" NOLOGIN;')
                admin(CLOSED)
            # Aucun reçu succès avant NOLOGIN confirmé ET zéro session.
            pending.rename(receipt)
            directory_fd = os.open(receipt.parent, os.O_DIRECTORY | os.O_NOFOLLOW)
            os.fsync(directory_fd)
            os.close(directory_fd)
            print('Succès contrôlé :', version, expected)


if __name__ == '__main__':
    main()
