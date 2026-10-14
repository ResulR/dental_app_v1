#!/usr/bin/env python3
"""Build v2 exclusively from verified v1 plus reviewed deltas. No database access."""
import gzip,hashlib,io,json,tarfile
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
source=ROOT/'.local/owner-bootstrap-review-v1.tar.gz'
old_sha='961ac181518d132a6d25c43c4a7d989d31024bcf58606834c31205a8912a8a00'
assert hashlib.sha256(source.read_bytes()).hexdigest()==old_sha
with tarfile.open(source) as t:
 members=t.getmembers()
 assert len(members)==len({m.name for m in members})==1646
 assert all(m.isfile() and not m.name.startswith('/') and '..' not in Path(m.name).parts for m in members)
 files={m.name:t.extractfile(m).read() for m in members}
old=json.loads(files.pop('MANIFEST.json'))
assert set(old)==set(files)
assert all(hashlib.sha256(v).hexdigest()==old[k] for k,v in files.items())
deltas=['migrations/0005_requests_linked_works.sql','scripts/linked-works-postgres-v2.mjs','tests/postgres/linked-works-v2-seed.sql']
for name in deltas:files[name]=(ROOT/name).read_bytes()
manifest={k:hashlib.sha256(v).hexdigest() for k,v in sorted(files.items())}
files['MANIFEST.json']=(json.dumps(manifest,indent=2)+'\n').encode()
target=ROOT/'.local/owner-bootstrap-review-v2.tar.gz'
with target.open('xb') as out:
 with gzip.GzipFile(fileobj=out,mode='wb',mtime=0,compresslevel=1) as z:
  with tarfile.open(fileobj=z,mode='w') as t:
   for name,data in sorted(files.items()):
    e=tarfile.TarInfo(name);e.mode=0o444;e.size=len(data);e.mtime=e.uid=e.gid=0;e.uname=e.gname='root'
    t.addfile(e,io.BytesIO(data))
target.chmod(0o600)
report={'archive':str(target),'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'count':len(files),'baseV1Sha256':old_sha,'deltas':deltas,'files':manifest}
with (ROOT/'docs/admin-proposals/OWNER_BOOTSTRAP_V2_ARTIFACTS.json').open('x') as f:json.dump(report,f,indent=2);f.write('\n')
print(json.dumps({k:v for k,v in report.items() if k!='files'}))
