#!/bin/bash
# V3 B: separate authorization after V3 A success; never reuse historical images.
set -Eeuo pipefail
set -C
umask 077
export PATH=/usr/sbin:/usr/bin:/sbin:/bin LC_ALL=C
review=/root/dental-pg-recipe-v3-review
phase=B
base=/var/lib/dental-lab-pg-recipe-v3
image="$base/sandbox.raw"
mnt="$base/mount"
unit=dental-pg-recipe-v3@test.service
requested=0
services=(postgresql@17-main nginx pm2-debian dental-site dental-ai-remote)
cd "$review"
# SHA256SUMS is externally pinned at staging.
sha256sum -c SHA256SUMS
source ./reception-v3-common.sh
install_error_handler
capture operator_uid id -u
test "$operator_uid" = 0
# Only accept a successful, unique V3 A receipt and unchanged historical baselines.
test "$(cat A.ok)" = A_V3_OK_NO_POSTGRES_STARTED
grep -qx "Result=success" A-service.txt
grep -qx "ExecMainStatus=0" A-service.txt
grep -qx "ActiveState=inactive" A-service.txt
grep -qx "SubState=dead" A-service.txt
v1_stopped
v2_stopped
v3_idle
test ! -e B.attempt
test ! -L B.attempt
cmp dental-pg-recipe-v3@.service /run/systemd/system/dental-pg-recipe-v3@.service
test ! -L "$image"
test "$(stat -c "%u:%a:%s" "$image")" = 0:600:536870912
resources before
neighbours
compare_output "$review/pg-config-before.sha256" configs
no_mount_at "$mnt"
no_loop_for "$image"
# No receipt bypass and no auto-retry. Historical B.attempt is checked by validator.
(set -C; : > B.attempt)
mount -o loop,ro,noload,nodev,nosuid "$image" "$mnt"
/usr/bin/python3 -I - <<'PY'
import hashlib,json,os,pwd,tarfile
from pathlib import Path
r=Path('/var/lib/dental-lab-pg-recipe-v3/mount')
p=r/'var/lib/dental-lab-bootstrap-reception'
u=pwd.getpwnam('dental-pg-test-v3')
identity=json.loads((r/'etc/reception-identity.json').read_text())
assert identity==json.loads(Path('/var/lib/dental-lab-pg-recipe-v3/identity.json').read_text())
assert (identity['uid'],identity['gid'])==(u.pw_uid,u.pw_gid)
proof=json.loads((p/'isolation.json').read_text())
assert proof['result']=='isolation-passed' and proof['mode']=='isolation' and proof['uid']==u.pw_uid
assert proof['cgroup']=='dental-pg-recipe-v3@isolation.service'
assert proof['netns']!=identity['host_netns']
for f in (p/'pgdata',p/'test.pending',r/'etc/reception-test-approved'):assert not os.path.lexists(f)
assert (r/'recipe/runner.sh').read_bytes()==Path('/root/dental-pg-recipe-v3-review/isolated-pg-recipe-v3-runner.sh').read_bytes()
release=r/'var/lib/dental-lab-owner-bootstrap-v1/release'
with tarfile.open('/root/dental-pg-recipe-v3-review/owner-bootstrap-review-v3.tar.gz') as t:
 for m in t.getmembers():
  assert m.isfile() and not m.name.startswith('/') and '..' not in Path(m.name).parts
  f=release/m.name
  assert not f.is_symlink() and f.stat().st_uid==0 and not f.stat().st_mode&0o022
  assert f.read_bytes()==t.extractfile(m).read()
print('B_V3_PREFLIGHT_IMAGE_OK')
PY
umount "$mnt"
mount -o loop,nodev,nosuid "$image" "$mnt"
/usr/bin/python3 -I - <<'PY'
import os
from pathlib import Path
r=Path('/var/lib/dental-lab-pg-recipe-v3/mount')
p=r/'var/lib/dental-lab-bootstrap-reception'
assert not os.path.lexists(p/'pgdata') and not os.path.lexists(p/'test.pending')
approval=r/'etc/reception-test-approved'
with approval.open('x') as f:
 f.write('approved-test-v3\n');f.flush();os.fsync(f.fileno())
approval.chmod(0o444)
PY
umount "$mnt"
no_loop_for "$image"
unit=dental-pg-recipe-v3@test.service
monitor
v3_idle
no_mount_at "$mnt"
no_loop_for "$image"
mount -o loop,ro,noload,nodev,nosuid "$image" "$mnt"
/usr/bin/python3 -I - <<'PY'
import json,os,pwd
from pathlib import Path
p=Path('/var/lib/dental-lab-pg-recipe-v3/mount/var/lib/dental-lab-bootstrap-reception')
proof=json.loads((p/'test.pending').read_text())
assert proof['result']=='isolation-passed' and proof['mode']=='test'
assert proof['uid']==pwd.getpwnam('dental-pg-test-v3').pw_uid
assert proof['cgroup']=='dental-pg-recipe-v3@test.service'
for filename,name in [('result.json','owner_bootstrap_postgres'),('linked-result.json','linked_works_postgres_v3')]:
 result=json.loads((p/filename).read_text())
 assert result['test']==name and result['result']=='passed'
 if name=='linked_works_postgres_v3':assert len(result['checks'])==8
 with Path('B-'+filename).open('x') as f:json.dump(result,f,indent=2);f.write('\n')
 print(json.dumps(result))
assert not os.path.lexists(p/'pgdata/postmaster.pid')
assert (p/'stop.log').stat().st_size>0
print((p/'stop.log').read_text())
PY
umount "$mnt"
after B
printf 'B_V3_TECHNICAL_CHECKS_OK — stop, preserve fixtures and evidence.\n' > B.ok
cat B.ok
