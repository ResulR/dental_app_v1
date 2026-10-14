#!/bin/bash
# Execute only after explicit approval of v2 phase A.
set -Eeuo pipefail
phase=A
cd /root/dental-pg-recipe-v2-review
# SHA256SUMS must first be verified against the externally reviewed digest.
sha256sum -c SHA256SUMS
source ./reception-v2-common.sh
test ! -e A.attempt
test ! -L A.attempt
(set -C; : > A.attempt)
v1_stopped
resources before
test ! -e "$base"
test ! -L "$base"
test ! -e /run/systemd/system/dental-pg-recipe-v2@.service
test ! -L /run/systemd/system/dental-pg-recipe-v2@.service
if getent passwd dental-pg-test-v2; then false; fi
for svc in "${services[@]}"; do systemctl is-active --quiet "$svc"; done
state > state-before.txt
configs > pg-config-before.sha256
ss -H -lnt | sort > sockets-before.txt
ready
DENTAL_PG_RECIPE_ENVELOPE_APPROVED=v2 /usr/bin/python3 -I ./prepare-isolated-pg-envelope-v2.py
cmp dental-pg-recipe-v2@.service "$base/dental-pg-recipe-v2@.service"
systemd-analyze verify ./dental-pg-recipe-v2@.service
install -o root -g root -m 644 "$base/dental-pg-recipe-v2@.service" /run/systemd/system/dental-pg-recipe-v2@.service
systemctl daemon-reload
unit=dental-pg-recipe-v2@isolation.service
monitor
grep -F '"result": "isolation-passed"' A-journal.txt
after
printf 'A_V2_OK_NO_POSTGRES_STARTED\n' > A.ok
cat A.ok
