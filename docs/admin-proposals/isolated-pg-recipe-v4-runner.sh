#!/bin/bash
# PROPOSAL ONLY: run by the approved isolated systemd unit, never on the host.
set -euo pipefail
umask 077
export PATH=/usr/bin:/bin
export LANG=C.UTF-8
export LC_ALL=C.UTF-8
export UV_THREADPOOL_SIZE=1
unset PGHOST PGPORT PGUSER PGDATABASE PGPASSWORD PGSERVICE PGSERVICEFILE PGOPTIONS NODE_OPTIONS
mode="${1-}"
test "$mode" = isolation || test "$mode" = test
root=/var/lib/dental-lab-reception-v4
release=/opt/dental-registration-v4
test "$(id -un)" = dental-pg-test-v4
cd "$root"
/usr/bin/python3 -I - "$mode" <<'PY'
import errno,json,os,socket,stat,sys
from pathlib import Path
mode=sys.argv[1]
root=Path('/var/lib/dental-lab-reception-v4')
expected=json.loads(Path('/etc/reception-identity.json').read_text())
assert os.getuid()==expected['uid'] and os.getgid()==expected['gid']
assert os.getuid() not in (0,103,994,1002)
assert os.getgroups()==[expected['gid']] or os.getgroups()==[]
assert os.readlink('/proc/self/ns/net') != expected['host_netns']
assert os.readlink('/proc/self/ns/mnt') != expected['host_mntns']
status=Path('/proc/self/status').read_text().splitlines()
fields=dict(line.split(':',1) for line in status if ':' in line)
assert fields['NoNewPrivs'].strip()=='1'
assert int(fields['CapEff'].strip(),16)==0
assert fields['Seccomp'].strip()=='2'
for family in (socket.AF_INET,socket.AF_INET6):
 try:
  s=socket.socket(family,socket.SOCK_STREAM)
 except OSError as e:
  assert e.errno in (errno.EAFNOSUPPORT,errno.EPERM,errno.EACCES)
 else:
  s.close();raise AssertionError('IP_SOCKET_ALLOWED')
for path in ('/srv/dental-lab','/home/debian','/var/lib/postgresql',
             '/etc/postgresql','/run/postgresql','/var/run/postgresql',
             '/run/dbus/system_bus_socket','/run/systemd/private'):
 assert not os.path.exists(path), 'HOST_PATH_VISIBLE'
s=socket.socket(socket.AF_UNIX,socket.SOCK_STREAM)
try:
 s.connect('/var/run/postgresql/.s.PGSQL.5432')
except OSError as e:
 assert e.errno in (errno.ENOENT,errno.EACCES)
else:
 raise AssertionError('PRODUCTION_SOCKET_REACHABLE')
finally:
 s.close()
cg=Path('/sys/fs/cgroup'+Path('/proc/self/cgroup').read_text().strip().split('0::',1)[1])
assert cg.name=='dental-pg-recipe-v4@'+mode+'.service'
assert int((cg/'memory.max').read_text())==805306368
assert int((cg/'memory.swap.max').read_text())==0
assert int((cg/'pids.max').read_text())==48
quota,period=map(int,(cg/'cpu.max').read_text().split())
assert quota/period <= 0.5
v=os.statvfs(root)
assert v.f_blocks*v.f_frsize <= 536870912
assert Path('/usr').stat().st_uid==0
assert os.statvfs('/usr/bin').f_flag & os.ST_RDONLY
assert os.statvfs('/etc').f_flag & os.ST_RDONLY
assert os.statvfs('/recipe').f_flag & os.ST_RDONLY
for f in ('/recipe/runner.sh','/etc/reception-identity.json'):
 st=os.stat(f)
 assert st.st_uid==0 and not st.st_mode & 0o022
proof={'result':'isolation-passed','uid':os.getuid(),'mode':mode,
       'netns':os.readlink('/proc/self/ns/net'),'cgroup':cg.name}
if mode=='isolation':
 assert not (root/'pgdata').exists()
 with (root/'isolation.json').open('x') as f:json.dump(proof,f)
else:
 assert json.loads((root/'isolation.json').read_text())['result']=='isolation-passed'
 approval=Path('/etc/reception-test-approved')
 st=approval.stat()
 assert st.st_uid==0 and stat.S_ISREG(st.st_mode) and st.st_mode&0o777==0o444
 assert approval.read_text()=='approved-test-v4\n'
 with (root/'test.pending').open('x') as f:json.dump(proof,f)
print(json.dumps(proof))
PY
if [ "$mode" = isolation ]; then exit 0; fi
export DENTAL_RECEPTION_V4_APPROVED=shared-v4-isolated
pgbin=/usr/lib/postgresql/17/bin
test ! -e "$root/attempt"
test ! -e "$root/pgdata"
set -C
printf '%s\n' attempted > "$root/attempt"
set +C
unset PGHOST PGPORT PGUSER PGDATABASE PGPASSWORD PGSERVICE PGSERVICEFILE PGOPTIONS NODE_OPTIONS
export UV_THREADPOOL_SIZE=1
"$pgbin/initdb" -D "$root/pgdata" -U postgres --encoding=UTF8 --locale=C.UTF-8 --auth-local=reject --auth-host=reject --no-instructions > "$root/initdb.log" 2>&1
printf '%s\n' 'local all postgres peer map=recipe' 'local all all reject' 'host all all 0.0.0.0/0 reject' 'host all all ::0/0 reject' > "$root/pgdata/pg_hba.conf"
printf '%s\n' 'recipe dental-pg-test-v4 postgres' > "$root/pgdata/pg_ident.conf"
mkdir "$root/socket"
stop_cluster() {
  local rc=$?
  trap - EXIT
  if [ -f "$root/pgdata/postmaster.pid" ]; then
    if ! "$pgbin/pg_ctl" -D "$root/pgdata" -m fast -t 20 -w stop >> "$root/stop.log" 2>&1; then exit 1; fi
  fi
  exit "$rc"
}
trap stop_cluster EXIT
"$pgbin/pg_ctl" -D "$root/pgdata" -l "$root/server.log" -t 30 -o "-c listen_addresses='' -c port=55434 -c unix_socket_directories=$root/socket -c unix_socket_permissions=0700 -c max_connections=10 -c shared_buffers=32MB -c work_mem=2MB -c maintenance_work_mem=16MB -c max_wal_size=64MB -c min_wal_size=32MB -c max_worker_processes=0 -c max_parallel_workers=0 -c autovacuum=off -c fsync=on -c synchronous_commit=on -c full_page_writes=on" -w start
"$pgbin/createdb" -h "$root/socket" -p 55434 -U postgres dental_lab
"$pgbin/psql" -X -w -P pager=off -v ON_ERROR_STOP=1 -h "$root/socket" -p 55434 -U postgres -d dental_lab -f "$release/tests/postgres/catalog-registration-v4-fixture.sql" > "$root/fixture.log" 2>&1
/usr/bin/timeout 120 /usr/bin/node --v8-pool-size=1 --max-old-space-size=192 "$release/tests/postgres/catalog-registration-v4.mjs" > "$root/result.json" 2> "$root/test-error.log"
cat "$root/result.json"
