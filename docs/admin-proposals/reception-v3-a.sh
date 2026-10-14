#!/bin/bash
# Phase A v3: distinct, never reuse v1/v2 images/units/receipts.
set -Eeuo pipefail
set -C
umask 077
export PATH=/usr/sbin:/usr/bin:/sbin:/bin LC_ALL=C
review=/root/dental-pg-recipe-v3-review
base=/var/lib/dental-lab-pg-recipe-v3
image="$base/sandbox.raw"
mnt="$base/mount"
unit=dental-pg-recipe-v3@isolation.service
phase=A
requested=0
services=(postgresql@17-main nginx pm2-debian dental-site dental-ai-remote)
cd "$review"
sha256sum -c SHA256SUMS
source ./reception-v3-common.sh
install_error_handler
capture operator_uid id -u
test "$operator_uid" = 0
test "$(hostname)" = vps-28bf7789
v1_stopped
v2_stopped
resources before
test ! -e "$base"
test ! -L "$base"
test ! -e /run/systemd/system/dental-pg-recipe-v3@.service
test ! -L /run/systemd/system/dental-pg-recipe-v3@.service
if getent passwd dental-pg-test-v3 >/dev/null; then exit 1; fi
for svc in "${services[@]}"; do systemctl is-active --quiet "$svc"; done
state > state-before.txt
configs > pg-config-before.sha256
ss -H -lnt | sort > sockets-before.txt
ready
(: > A.attempt)
DENTAL_PG_RECIPE_ENVELOPE_APPROVED=v3 /usr/bin/python3 -I ./prepare-isolated-pg-envelope-v3.py
cmp dental-pg-recipe-v3@.service "$base/dental-pg-recipe-v3@.service"
systemd-analyze verify ./dental-pg-recipe-v3@.service
install -o root -g root -m 644 "$base/dental-pg-recipe-v3@.service" /run/systemd/system/dental-pg-recipe-v3@.service
systemctl daemon-reload
monitor
grep -F '"result": "isolation-passed"' A-journal.txt
after A
printf 'A_V3_OK_NO_POSTGRES_STARTED\n' > A.ok
cat A.ok
