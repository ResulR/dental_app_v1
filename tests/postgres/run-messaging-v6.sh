#!/bin/bash
# PREPARATION ONLY. One-shot v6, never run without separate explicit authorization.
set -euo pipefail
umask 077
test "$(hostname)" = vps-28bf7789
test "$(id -u)" = 1002
test "$(cat /proc/self/cgroup)" = '0::/system.slice/dental-ai-remote.service'
test "$(cat /sys/fs/cgroup/system.slice/dental-ai-remote.service/cpu.max)" = '50000 100000'
test "$(cat /sys/fs/cgroup/system.slice/dental-ai-remote.service/memory.max)" = 1073741824
test "$(cat /sys/fs/cgroup/system.slice/dental-ai-remote.service/pids.max)" = 100
test "${DENTAL_MESSAGING_V6_APPROVED-}" = private-unix-socket-one-shot
cd /srv/dental-lab
test -z "$(git status --porcelain=v1)"
root=/srv/dental-lab/.local/messaging-v6
pgbin=/usr/lib/postgresql/17/bin
test ! -e "$root"
test -x "$pgbin/initdb"
test -x "$pgbin/pg_ctl"
test "$(df -B1 --output=avail /srv/dental-lab | tail -1)" -ge 1073741824
tasks=$(cat /sys/fs/cgroup/system.slice/dental-ai-remote.service/pids.current)
limit=$(cat /sys/fs/cgroup/system.slice/dental-ai-remote.service/pids.max)
test "$((limit-tasks))" -ge 24
used=$(awk '$1=="anon" || $1=="kernel" {s+=$2} END {print s}' /sys/fs/cgroup/system.slice/dental-ai-remote.service/memory.stat)
total=$(cat /sys/fs/cgroup/system.slice/dental-ai-remote.service/memory.max)
test "$((total-used))" -ge 469762048
"$pgbin/pg_isready" -h /var/run/postgresql -p 5432 -q
sha256sum -c tests/postgres/messaging-v6.sha256 >/dev/null
mkdir -m 700 "$root"
printf 'attempted\n' > "$root/attempt"
git rev-parse HEAD > "$root/commit"
cp tests/postgres/messaging-v6.sha256 "$root/sha256"
sha256sum -c "$root/sha256" > "$root/sha256-check.log"
systemctl show nginx.service postgresql.service postgresql@17-main.service dental-site.service dental-ai-remote.service -p Id -p ActiveState -p SubState -p MainPID > "$root/services-before"
"$pgbin/pg_isready" -h /var/run/postgresql -p 5432 > "$root/production-before"
ss -xl > "$root/sockets-before"
stop_v6() {
  local rc=$?
  trap - EXIT
  if test -f "$root/pgdata/postmaster.pid"; then
    /usr/bin/timeout -k 5 30 "$pgbin/pg_ctl" -D "$root/pgdata" -m fast -t 20 -w stop >> "$root/stop.log" 2>&1 || rc=1
  fi
  if "$pgbin/pg_ctl" -D "$root/pgdata" status > "$root/status-after-stop.log" 2>&1; then rc=1; fi
  if test -e "$root/socket/.s.PGSQL.55436"; then rc=1; fi
  systemctl show nginx.service postgresql.service postgresql@17-main.service dental-site.service dental-ai-remote.service -p Id -p ActiveState -p SubState -p MainPID > "$root/services-after" || rc=1
  "$pgbin/pg_isready" -h /var/run/postgresql -p 5432 > "$root/production-after" || rc=1
  ss -xl > "$root/sockets-after" || rc=1
  cmp -s "$root/services-before" "$root/services-after" || rc=1
  cmp -s "$root/production-before" "$root/production-after" || rc=1
  cmp -s "$root/sockets-before" "$root/sockets-after" || rc=1
  if test "$rc" -eq 0; then printf 'V6_SQL_OK_STOPPED\n' > "$root/ok"; fi
  exit "$rc"
}
trap stop_v6 EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
/usr/bin/timeout -k 5 90 "$pgbin/initdb" -D "$root/pgdata" -U postgres --encoding=UTF8 --locale=C.UTF-8 --auth-local=reject --auth-host=reject --no-instructions > "$root/initdb.log" 2>&1
printf '%s\n' 'local all postgres peer map=messaging-v6' 'local all all reject' 'host all all 0.0.0.0/0 reject' 'host all all ::0/0 reject' > "$root/pgdata/pg_hba.conf"
printf '%s\n' 'messaging-v6 dental-ai postgres' > "$root/pgdata/pg_ident.conf"
mkdir -m 700 "$root/socket"
/usr/bin/timeout -k 5 40 "$pgbin/pg_ctl" -D "$root/pgdata" -l "$root/server.log" -t 30 -o "-c listen_addresses='' -c port=55436 -c unix_socket_directories=$root/socket -c unix_socket_permissions=0700 -c max_connections=10 -c shared_buffers=32MB -c work_mem=2MB -c maintenance_work_mem=16MB -c max_wal_size=64MB -c min_wal_size=32MB -c max_worker_processes=0 -c max_parallel_workers=0 -c autovacuum=off -c fsync=on -c synchronous_commit=on -c full_page_writes=on" -w start
/usr/bin/timeout -k 5 30 "$pgbin/createdb" -h "$root/socket" -p 55436 -U postgres dental_lab
/usr/bin/timeout -k 5 90 "$pgbin/psql" -X -w -P pager=off -v ON_ERROR_STOP=1 -h "$root/socket" -p 55436 -U postgres -d dental_lab -f tests/postgres/messaging-v6-fixture.sql > "$root/fixture.log" 2>&1
/usr/bin/timeout -k 5 90 /usr/bin/node --v8-pool-size=1 --max-old-space-size=192 tests/postgres/messaging-v6.mjs > "$root/result.json" 2> "$root/test-error.log"
cat "$root/result.json"
