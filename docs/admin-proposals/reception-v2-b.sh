#!/bin/bash
# Execute only after review of v2 A and separate explicit approval of v2 B.
set -Eeuo pipefail
phase=B
cd /root/dental-pg-recipe-v2-review
sha256sum -c SHA256SUMS
source ./reception-v2-common.sh
test "$(cat A.ok)" = A_V2_OK_NO_POSTGRES_STARTED
test ! -e B.attempt
test ! -L B.attempt
(set -C; : > B.attempt)
v1_stopped
v2_idle
resources before
neighbours
diff -u pg-config-before.sha256 <(configs)
cmp dental-pg-recipe-v2@.service /run/systemd/system/dental-pg-recipe-v2@.service
test ! -L "$image"
test "$(stat -c '%u:%a:%s' "$image")" = 0:600:536870912
test -z "$(findmnt -rn -M "$mnt")"
test -z "$(losetup -j "$image")"
mount -o loop,ro,noload,nodev,nosuid "$image" "$mnt"
/usr/bin/python3 -I - <<'PY'
import hashlib,json,os,pwd,tarfile
from pathlib import Path
r=Path('/var/lib/dental-lab-pg-recipe-v2/mount')
p=r/'var/lib/dental-lab-bootstrap-reception'
u=pwd.getpwnam('dental-pg-test-v2')
identity=json.loads((r/'etc/reception-identity.json').read_text())
assert identity==json.loads(Path('/var/lib/dental-lab-pg-recipe-v2/identity.json').read_text())
assert (identity['uid'],identity['gid'])==(u.pw_uid,u.pw_gid)
proof=json.loads((p/'isolation.json').read_text())
assert proof['result']=='isolation-passed' and proof['mode']=='isolation' and proof['uid']==u.pw_uid
assert proof['cgroup']=='dental-pg-recipe-v2@isolation.service'
assert proof['netns']!=identity['host_netns']
for f in (p/'pgdata',p/'test.pending',r/'etc/reception-test-approved'):assert not os.path.lexists(f)
assert (r/'recipe/runner.sh').read_bytes()==Path('isolated-pg-recipe-v2-runner.sh').read_bytes()
release=r/'var/lib/dental-lab-owner-bootstrap-v1/release'
with tarfile.open('owner-bootstrap-review-v2.tar.gz') as t:
 for m in t.getmembers():
  assert m.isfile() and not m.name.startswith('/') and '..' not in Path(m.name).parts
  f=release/m.name
  assert not f.is_symlink() and f.stat().st_uid==0 and not f.stat().st_mode&0o022
  assert f.read_bytes()==t.extractfile(m).read()
print('B_V2_PREFLIGHT_IMAGE_OK')
PY
umount "$mnt"
mount -o loop,nodev,nosuid "$image" "$mnt"
/usr/bin/python3 -I - <<'PY'
import os
from pathlib import Path
r=Path('/var/lib/dental-lab-pg-recipe-v2/mount')
p=r/'var/lib/dental-lab-bootstrap-reception'
assert not os.path.lexists(p/'pgdata') and not os.path.lexists(p/'test.pending')
approval=r/'etc/reception-test-approved'
with approval.open('x') as f:
 f.write('approved-test-v2\n');f.flush();os.fsync(f.fileno())
approval.chmod(0o444)
PY
umount "$mnt"
test -z "$(losetup -j "$image")"
unit=dental-pg-recipe-v2@test.service
monitor
after
mount -o loop,ro,noload,nodev,nosuid "$image" "$mnt"
/usr/bin/python3 -I - <<'PY'
import json,os,pwd
from pathlib import Path
p=Path('/var/lib/dental-lab-pg-recipe-v2/mount/var/lib/dental-lab-bootstrap-reception')
proof=json.loads((p/'test.pending').read_text())
assert proof['result']=='isolation-passed' and proof['mode']=='test'
assert proof['uid']==pwd.getpwnam('dental-pg-test-v2').pw_uid
assert proof['cgroup']=='dental-pg-recipe-v2@test.service'
for filename,name in [('result.json','owner_bootstrap_postgres'),('linked-result.json','linked_works_postgres_v2')]:
 result=json.loads((p/filename).read_text())
 assert result['test']==name and result['result']=='passed'
 if name=='linked_works_postgres_v2':assert len(result['checks'])==8
 with Path('B-'+filename).open('x') as f:json.dump(result,f,indent=2);f.write('\n')
 print(json.dumps(result))
assert not os.path.lexists(p/'pgdata/postmaster.pid')
assert (p/'stop.log').stat().st_size>0
print((p/'stop.log').read_text())
PY
umount "$mnt"
after
printf 'B_V2_TECHNICAL_CHECKS_OK — stop, preserve fixtures and evidence.\n' > B.ok
cat B.ok
