#!/bin/bash
# Reviewed independent VM recipe only. No installation and no production access.
set -euo pipefail
umask 077
test "$(hostname)" = dental-reception-v4
test "$(id -un)" = dental-v4
test "${DENTAL_RECEPTION_V4_APPROVED-}" = independent-empty-vm
root=/var/lib/dental-lab-reception-v4
release=/opt/dental-registration-v4
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
printf '%s\n' 'recipe dental-v4 postgres' > "$root/pgdata/pg_ident.conf"
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
