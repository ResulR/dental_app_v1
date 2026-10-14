#!/bin/bash
# R1 library: no command is executed merely by sourcing this file.
capture() {
 local name=$1 captured rc
 shift
 if captured=$("$@"); then
  printf -v "$name" '%s' "$captured"
 else
  rc=$?
  printf 'COMMAND_FAILED rc=%s command=%q\n' "$rc" "$1" >&2
  return "$rc"
 fi
}
install_error_handler() {
 trap_owner=$BASHPID
 trap 'failure "$?" "$LINENO" "$BASH_COMMAND"' ERR
 trap 'failure 130 "$LINENO" "SIGINT"' INT
 trap 'failure 143 "$LINENO" "SIGTERM"' TERM
}
failure() {
 local rc=$1 line=$2 command=$3
 trap - ERR INT TERM
 set +e
 printf 'STOP_R1 rc=%s line=%s command=%q subshell=%s\n' "$rc" "$line" "$command" "$BASH_SUBSHELL" >&2
 # Child failures never control a service or write diagnostic files.
 if [[ "$BASHPID" = "$trap_owner" && "$BASH_SUBSHELL" -eq 0 && "$requested" -eq 1 ]]; then
  if [[ "$unit" = dental-pg-recipe-v2@test.service ]]; then
   systemctl stop "$unit" >&2
   systemctl show "$unit" -p ActiveState -p SubState -p Result -p ExecMainStatus >&2
   journalctl -u "$unit" -b --no-pager -n 100 >&2
  fi
 fi
 printf 'Preserve evidence; no retry, no cleanup, no automatic continuation.\n' >&2
 exit "$rc"
}
no_mount_at() {
 local mounts target=$1 line
 capture mounts findmnt -rn -o TARGET
 while IFS= read -r line; do
  case "$line" in "$target"|"$target"/*)
   printf 'MOUNT_PRESENT %s\n' "$line" >&2
   return 1;;
  esac
 done <<< "$mounts"
}
no_loop_for() {
 local loops
 capture loops losetup -j "$1"
 test -z "$loops"
}
no_processes() {
 local rc account
 capture account getent passwd "$1"
 test -n "$account"
 if pgrep -a -u "$1"; then
  return 1
 else
  rc=$?
  test "$rc" -eq 1
 fi
}
property() { systemctl show "$1" -p "$2" --value; }
expect_property() {
 local value
 capture value property "$1" "$2"
 test "$value" = "$3"
}
v1_stopped() {
 local u state
 for u in dental-pg-recipe@isolation.service dental-pg-recipe@test.service; do
  capture state property "$u" ActiveState
  case "$state" in inactive|failed) ;; *) return 1;; esac
  expect_property "$u" MainPID 0
 done
 no_processes dental-pg-test
 no_mount_at /var/lib/dental-lab-pg-recipe/mount
 no_loop_for /var/lib/dental-lab-pg-recipe/sandbox.raw
}
v2_idle() {
 local u
 for u in dental-pg-recipe-v2@isolation.service dental-pg-recipe-v2@test.service; do
  expect_property "$u" ActiveState inactive
  expect_property "$u" SubState dead
  expect_property "$u" MainPID 0
  expect_property "$u" DropInPaths ""
 done
 no_processes dental-pg-test-v2
}
state() {
 systemctl show "${services[@]}" -p Id -p ActiveState -p MainPID -p ExecMainStartTimestampMonotonic
}
ready() {
 timeout 5 runuser -u postgres -- /usr/lib/postgresql/17/bin/pg_isready -h /var/run/postgresql -p 5432 -t 3
}
compare_output() {
 local baseline=$1 actual
 shift
 capture actual "$@"
 # All three baselines are nonempty, newline-terminated textual inventories.
 printf '%s\n' "$actual" | diff -u "$baseline" -
}
neighbours() {
 compare_output "$review/state-before.txt" state
 ready
}
configs() {
 /usr/bin/python3 -I - <<'PY'
import hashlib
from pathlib import Path
rows=[]
for p in Path('/etc/postgresql/17/main').rglob('*'):
 if p.is_file() and not p.is_symlink():
  rows.append(hashlib.sha256(p.read_bytes()).hexdigest()+'  '+str(p))
print('\n'.join(sorted(rows)))
PY
}
resources() {
 /usr/bin/python3 -I - "$1" <<'PY'
import os,shutil,sys
from pathlib import Path
mem=dict(x.split(':',1) for x in Path('/proc/meminfo').read_text().splitlines())
before=sys.argv[1]=='before'
assert int(mem['MemAvailable'].split()[0]) >= (2 if before else 1)*1024**2
assert os.getloadavg()[0] < 2 if before else os.getloadavg()[0] <= 3
if before:assert shutil.disk_usage('/var/lib').free >= 2*1024**3
PY
}
after() {
 state > "$control/B-r1-state-after.txt"
 diff -u "$review/state-before.txt" "$control/B-r1-state-after.txt"
 configs > "$control/B-r1-config-after.sha256"
 diff -u "$review/pg-config-before.sha256" "$control/B-r1-config-after.sha256"
 ready
 ss -H -lnt | sort > "$control/B-r1-sockets-after.txt"
 diff -u "$review/sockets-before.txt" "$control/B-r1-sockets-after.txt"
 v2_idle
 no_mount_at "$mnt"
 no_loop_for "$image"
 v1_stopped
}
monitor() {
 local deadline current started
 date -Is > "$control/B-r1-start.txt"
 requested=1
 systemctl start "$unit"
 deadline=$((SECONDS+300))
 while :; do
  resources during
  neighbours
  capture current property "$unit" ActiveState
  case "$current" in inactive) break;; activating|active|deactivating) ;; *) return 1;; esac
  test "$SECONDS" -lt "$deadline"
  sleep 2
 done
 capture started cat "$control/B-r1-start.txt"
 journalctl -u "$unit" -b --no-pager --since="$started" > "$control/B-r1-journal.txt"
 systemctl show "$unit" -p ActiveState -p SubState -p Result -p ExecMainStatus > "$control/B-r1-service.txt"
 cat "$control/B-r1-service.txt"
 expect_property "$unit" Result success
 expect_property "$unit" ExecMainStatus 0
 v2_idle
}
