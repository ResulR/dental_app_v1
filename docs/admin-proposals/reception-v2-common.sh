#!/bin/bash
# Reviewed v2 admin helper. Source only from the root-private checked directory.
set -Eeuo pipefail
umask 077
export PATH=/usr/sbin:/usr/bin:/sbin:/bin LC_ALL=C
review=/root/dental-pg-recipe-v2-review
base=/var/lib/dental-lab-pg-recipe-v2
image="$base/sandbox.raw"
mnt="$base/mount"
requested=0
unit=""
services=(postgresql@17-main nginx pm2-debian dental-site dental-ai-remote)
failure() {
 trap - ERR INT TERM
 if [ "$requested" -eq 1 ]; then
  systemctl stop "$unit" || true
  systemctl show "$unit" -p ActiveState -p SubState -p Result -p ExecMainStatus || true
  journalctl -u "$unit" -b --no-pager -n 100 | tee -a "$review/diagnostic-$phase.txt" || true
 fi
 printf '\nSTOP v2: preserve all evidence; no retry, no cleanup, no quota change.\n' >&2
 printf 'If mounted, retain this state for diagnosis; never start with image mounted.\n' >&2
 exit 1
}
trap failure ERR INT TERM
test "$(id -u)" = 0
test "$(hostname)" = vps-28bf7789
test "$(stat -c '%u:%a' "$review")" = 0:700
cd "$review"
sha256sum -c SHA256SUMS
no_processes() {
 local rc
 if pgrep -a -u "$1"; then return 1; else rc=$?; test "$rc" -eq 1; fi
}
v1_stopped() {
 local u state
 for u in dental-pg-recipe@isolation.service dental-pg-recipe@test.service; do
  state="$(systemctl show "$u" -p ActiveState --value)"
  case "$state" in inactive|failed) ;; *) return 1;; esac
  test "$(systemctl show "$u" -p MainPID --value)" = 0
 done
 no_processes dental-pg-test
 test -z "$(findmnt -rn -M /var/lib/dental-lab-pg-recipe/mount)"
 test -z "$(losetup -j /var/lib/dental-lab-pg-recipe/sandbox.raw)"
}
v2_idle() {
 local u
 for u in dental-pg-recipe-v2@isolation.service dental-pg-recipe-v2@test.service; do
  test "$(systemctl show "$u" -p ActiveState --value)" = inactive
  test "$(systemctl show "$u" -p MainPID --value)" = 0
  test -z "$(systemctl show "$u" -p DropInPaths --value)"
 done
 no_processes dental-pg-test-v2
}
state() {
 systemctl show "${services[@]}" -p Id -p ActiveState -p MainPID -p ExecMainStartTimestampMonotonic
}
ready() {
 timeout 5 runuser -u postgres -- /usr/lib/postgresql/17/bin/pg_isready -h /var/run/postgresql -p 5432 -t 3
}
configs() { find /etc/postgresql/17/main -type f -exec sha256sum {} + | sort; }
resources() {
 /usr/bin/python3 -I - "$1" <<'PY'
import os,shutil,sys
from pathlib import Path
mem=dict(x.split(':',1) for x in Path('/proc/meminfo').read_text().splitlines())
before=sys.argv[1]=='before'
assert int(mem['MemAvailable'].split()[0]) >= (2 if before else 1)*1024**2
assert os.getloadavg()[0] < 2 if before else os.getloadavg()[0] <= 3
if before: assert shutil.disk_usage('/var/lib').free >= 2*1024**3
PY
}
neighbours() {
 diff -u state-before.txt <(state)
 ready
}
after() {
 state > "state-after-$phase.txt"
 diff -u state-before.txt "state-after-$phase.txt"
 configs > "pg-config-after-$phase.sha256"
 diff -u pg-config-before.sha256 "pg-config-after-$phase.sha256"
 ready
 ss -H -lnt | sort > "sockets-after-$phase.txt"
 diff -u sockets-before.txt "sockets-after-$phase.txt"
 v2_idle
 test -z "$(findmnt -rn -M "$mnt")"
 test -z "$(losetup -j "$image")"
 v1_stopped
}
monitor() {
 local deadline current
 date -Is > "$phase-start.txt"
 requested=1
 systemctl start "$unit"
 deadline=$((SECONDS + 300))
 while :; do
  resources during
  neighbours
  current="$(systemctl show "$unit" -p ActiveState --value)"
  case "$current" in inactive) break;; activating|active|deactivating) ;; *) return 1;; esac
  test "$SECONDS" -lt "$deadline"
  sleep 2
 done
 journalctl -u "$unit" -b --no-pager --since="$(cat "$phase-start.txt")" > "$phase-journal.txt"
 systemctl show "$unit" -p ActiveState -p SubState -p Result -p ExecMainStatus > "$phase-service.txt"
 cat "$phase-service.txt"
 test "$(systemctl show "$unit" -p Result --value)" = success
 test "$(systemctl show "$unit" -p ExecMainStatus --value)" = 0
 v2_idle
}
